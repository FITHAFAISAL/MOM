import os
import sys
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# Local imports
sys.path.append(os.path.dirname(__file__))
from transcriber import SherpaTranscriber
from mom_generator import MOMGenerator

app = FastAPI(title="Sherpa-ONNX Real-Time Speech-to-Text & MOM Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_PARENT_DIR = os.path.join(BASE_DIR, "models")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

def get_active_model_dir():
    if os.path.exists(MODELS_PARENT_DIR):
        for item in os.listdir(MODELS_PARENT_DIR):
            full_path = os.path.join(MODELS_PARENT_DIR, item)
            if os.path.isdir(full_path) and os.path.exists(os.path.join(full_path, "tokens.txt")):
                return full_path
    return os.path.join(MODELS_PARENT_DIR, "sherpa-onnx-streaming-zipformer-en-2023-06-26")

MODEL_DIR = get_active_model_dir()

# Initialize Transcriber & MOM Generator
transcriber = SherpaTranscriber(MODEL_DIR)
mom_generator = MOMGenerator()

class TranscriptItem(BaseModel):
    speaker: Optional[str] = "Speaker 1"
    text: str
    timestamp: Optional[str] = "00:00"

class MOMRequest(BaseModel):
    title: Optional[str] = "Executive Sync & MOM"
    attendees: Optional[List[str]] = []
    transcript: List[TranscriptItem]

@app.get("/api/status")
def get_status():
    global transcriber, MODEL_DIR
    if not transcriber.is_loaded:
        active = get_active_model_dir()
        if os.path.exists(active) and os.path.exists(os.path.join(active, "tokens.txt")):
            MODEL_DIR = active
            transcriber.load_model(MODEL_DIR)
    return {
        "status": "online",
        "engine": "sherpa-onnx-offline",
        "offline_mandatory": True,
        "model_dir": MODEL_DIR,
        "is_model_loaded": transcriber.is_loaded,
        "load_error": transcriber.load_error,
        "sample_rate": transcriber.sample_rate
    }

@app.post("/api/mom/generate")
def generate_mom(req: MOMRequest):
    items = [item.model_dump() for item in req.transcript]
    mom_result = mom_generator.generate_mom(
        transcript_items=items,
        title=req.title,
        attendees=req.attendees
    )
    return mom_result

@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("[WS] Client connected for real-time speech transcription.")

    if not transcriber.is_loaded:
        await websocket.send_json({
            "type": "status",
            "message": "Sherpa-ONNX model operating in hybrid mode.",
            "is_model_loaded": False
        })

    stream = transcriber.create_stream()
    last_interim = ""

    try:
        while True:
            message = await websocket.receive()
            
            if "bytes" in message and message["bytes"]:
                raw_bytes = message["bytes"]
                current_text, is_endpoint = transcriber.decode_chunk(stream, raw_bytes)
                clean = current_text.strip() if current_text else ""
                
                if is_endpoint and clean:
                    last_interim = ""
                    await websocket.send_json({
                        "type": "transcription",
                        "is_final": True,
                        "text": clean
                    })
                elif clean and clean != last_interim:
                    last_interim = clean
                    await websocket.send_json({
                        "type": "transcription",
                        "is_final": False,
                        "text": clean
                    })
            elif "text" in message and message["text"]:
                data = json.loads(message["text"])
                if data.get("action") == "finalize":
                    final_text = transcriber.finalize_stream(stream)
                    clean = (final_text or "").strip()
                    if clean:
                        await websocket.send_json({
                            "type": "transcription",
                            "is_final": True,
                            "text": clean
                        })
                    stream = transcriber.create_stream()
                    last_interim = ""

    except WebSocketDisconnect:
        print("[WS] Client disconnected.")
    except Exception as e:
        print(f"[WS] Exception: {e}")

# Mount Static Frontend
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
