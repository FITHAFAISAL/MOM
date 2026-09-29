# 🎙️ Sherpa-ONNX Real-Time Speech-to-Text & Minutes of Meeting (MOM) Platform

An end-to-end, high-performance platform for real-time English speech transcription, speaker tracking, and automated Minutes of Meeting (MOM) generation powered by **Sherpa-ONNX** (Zipformer English model) and FastAPI.

---

## 🌟 Key Features

1. **Real-Time Speech Recognition (ASR)**:
   - Powered by `sherpa-onnx` English streaming Zipformer model (~630 MB).
   - Real-time Web Audio API PCM streaming over WebSockets (`16,000 Hz`).
   - Browser Web Speech API & simulated demo stream fallbacks for offline testing.

2. **Automated Minutes of Meeting (MOM) Engine**:
   - **Executive Summary**: Synthesizes discussion highlights automatically.
   - **Key Decisions**: Extracts agreed decisions with timestamps and speaker attribution.
   - **Action Items Matrix**: Identifies tasks, assignees, and priority levels (`High`, `Medium`).
   - **Topic Segmentation**: Groups transcript sections into structured meeting agenda topics.

3. **Modern Visual Interface**:
   - Dark theme glassmorphism aesthetic with audio frequency waveform visualizer.
   - Session timer, active speaker selector, and live speech stream pulse indicator.
   - Transcript search & filter by speaker or keyword.

4. **Multi-Format Export**:
   - **PDF Export**: Clean print styling formatted for executive sharing.
   - **Markdown Export**: `.md` file generator for documentation repositories.
   - **Copy to Clipboard**: Quick formatted plain text export.

---

## 📁 Repository Structure

```
sherpa-mom-platform/
├── backend/
│   ├── server.py             # FastAPI Web & WebSocket Server
│   ├── transcriber.py        # Sherpa-ONNX OnlineRecognizer Wrapper
│   └── mom_generator.py      # NLP MOM Summary & Action Item Extractor
├── frontend/
│   ├── index.html            # Main User Interface
│   ├── styles.css            # Glassmorphism Styling & Responsive Layout
│   └── app.js                # Web Audio PCM Sampler & Client Logic
├── models/                   # Location for Sherpa-ONNX 630MB model
├── download_model.py         # Automated Sherpa-ONNX Model Downloader
└── README.md
```

---

## 🚀 How to Run

### 1. Requirements
- Python 3.10+
- Installed packages: `sherpa-onnx`, `fastapi`, `uvicorn`, `websockets`, `numpy`, `requests`

### 2. Download Sherpa-ONNX English Model (Optional)
To download the ~630MB English Zipformer model:
```bash
python download_model.py
```

### 3. Start Server
Run the FastAPI application:
```bash
python backend/server.py
```

### 4. Access Platform
Open your browser and navigate to:
```
http://127.0.0.1:8000
```
