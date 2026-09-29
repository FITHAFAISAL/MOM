# 🎙️ Sherpa-ONNX Real-Time Speech-to-Text & Minutes of Meeting (MOM) Platform

An end-to-end, high-performance platform for real-time English speech transcription, speaker tracking, and automated Minutes of Meeting (MOM) generation powered by **Sherpa-ONNX** (Zipformer English model) and FastAPI.

---

## 🌟 Key Features

1. **Real-Time Speech Detection Text Box**:
   - Spoken words from your **Microphone** AND **Device Audio** (system sound / Google Meet / Zoom / MS Teams / video) are detected in real time and stream directly into the text box.
   - Interim speech is displayed live in real-time as spoken.
   - Real-time word count & character count tracking.
   - Freely type, edit, format, or append text alongside voice detection.

2. **Device & System Audio Capture (Meeting Mode)**:
   - **Audio Source Selector**:
     - `🎙️+💻 Both: Mic + Device Audio (Meeting Mode)`: Captures both your speech and other attendees in Zoom/Meet/Teams!
     - `💻 Device Audio Only`: Captures incoming meeting audio or video playback.
     - `🎙️ Microphone Only`: Captures local microphone audio.
   - In Chrome/Edge: when prompted, check **"Share tab audio"** (for Meet/Teams tab) or **"Also share system audio"** (for screen share) to capture device sound.

3. **Instant Minutes of Meeting (MOM) Preparation**:
   - Click **"Prepare MOM"** on the text box toolbar to automatically generate:
     - **Executive Summary**: Synthesizes discussion highlights.
     - **Key Decisions**: Extracts decisions with checkmarks.
     - **Action Items Matrix**: Tasks, assignees, priorities (`High`, `Medium`), and completion status.
     - **Discussion Topics**: Timeline of meeting topics.
   - **Export Options**: One-click Copy MOM markdown, Save `.md` file, or Print / Save as PDF.

4. **Speech Engine & Visuals**:
   - Powered by native `sherpa-onnx` English streaming Zipformer model (`16,000 Hz`).
   - Browser Web Speech API fallback with multi-language selector support.
   - Live audio frequency waveform visualizer and pulse status badge.
   - Built-in "Test Demo Speech" stream for instant testing without a microphone.

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
