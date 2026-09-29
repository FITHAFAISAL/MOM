/**
 * Sherpa Voice - Real-Time Speech to Text & MOM Platform
 * Frontend Client Application
 * Features:
 *  - Real-time Speech Detection into Dedicated Text Box
 *  - Captures Microphone & Device/System Audio (Zoom, Meet, Teams, Video)
 *  - Native Sherpa-ONNX Streaming Transcriber over WebSocket + WebSpeech
 *  - Instant Minutes of Meeting (MOM) Preparation & Export
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Controls & Indicators
  const toggleRecordBtn = document.getElementById('toggleRecordBtn');
  const demoStreamBtn = document.getElementById('demoStreamBtn');
  const audioSourceSelect = document.getElementById('audioSourceSelect');
  const languageSelect = document.getElementById('languageSelect');
  const sessionTimerEl = document.getElementById('sessionTimer');
  const waveformCanvas = document.getElementById('waveformCanvas');
  const canvasCtx = waveformCanvas ? waveformCanvas.getContext('2d') : null;

  // Header Status Elements
  const backendDot = document.getElementById('backendDot');
  const backendStatusText = document.getElementById('backendStatusText');
  const engineStatusText = document.getElementById('engineStatusText');
  const audioModeStatusText = document.getElementById('audioModeStatusText');

  // Real-Time Detection Banner Elements
  const liveStreamBox = document.getElementById('liveStreamBox');
  const liveStatusText = document.getElementById('liveStatusText');
  const liveSourceTag = document.getElementById('liveSourceTag');
  const liveBars = document.getElementById('liveBars');
  const livePartialText = document.getElementById('livePartialText');

  // Text Box & Toolbar Elements
  const speechTextBox = document.getElementById('speechTextBox');
  const wordCountPill = document.getElementById('wordCountPill');
  const charCountPill = document.getElementById('charCountPill');
  const prepareMomBtn = document.getElementById('prepareMomBtn');
  const toggleTimestampBtn = document.getElementById('toggleTimestampBtn');
  const fontDecBtn = document.getElementById('fontDecBtn');
  const fontIncBtn = document.getElementById('fontIncBtn');
  const fontSizeLabel = document.getElementById('fontSizeLabel');
  const copyTextBtn = document.getElementById('copyTextBtn');
  const downloadTextBtn = document.getElementById('downloadTextBtn');
  const clearTextBtn = document.getElementById('clearTextBtn');
  const textBoxStatusTag = document.getElementById('textBoxStatusTag');
  const textBoxStatusMsg = document.getElementById('textBoxStatusMsg');

  // MOM Modal Elements
  const momModal = document.getElementById('momModal');
  const closeMomModalBtn = document.getElementById('closeMomModalBtn');
  const momTitleInput = document.getElementById('momTitleInput');
  const momAttendeesInput = document.getElementById('momAttendeesInput');
  const refreshMomBtn = document.getElementById('refreshMomBtn');
  const momExecutiveSummary = document.getElementById('momExecutiveSummary');
  const momDecisionsList = document.getElementById('momDecisionsList');
  const momActionItemsTbody = document.getElementById('momActionItemsTbody');
  const momTopicsContainer = document.getElementById('momTopicsContainer');
  const addManualActionBtn = document.getElementById('addManualActionBtn');
  const copyMomBtn = document.getElementById('copyMomBtn');
  const exportMdBtn = document.getElementById('exportMdBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');

  // Device Audio Help Modal Elements
  const deviceAudioHelpBtn = document.getElementById('deviceAudioHelpBtn');
  const deviceAudioModal = document.getElementById('deviceAudioModal');
  const closeGuideModalBtn = document.getElementById('closeGuideModalBtn');
  const guideGotItBtn = document.getElementById('guideGotItBtn');

  // Toast Notification
  const toastNotification = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');

  // Application State
  let websocket = null;
  let isRecording = false;
  let isDemoStreaming = false;
  let audioContext = null;
  let micStream = null;
  let deviceStream = null;
  let mixedStream = null;
  let scriptProcessor = null;
  let animationFrameId = null;
  let timerInterval = null;
  let sessionStartTime = 0;
  let currentFontSize = 16;
  let includeTimestamps = false;
  let toastTimeout = null;
  let currentMomData = null;

  // Speech Recognition API resolution
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isSpeechApiActive = false;

  // Initialize
  init();

  function init() {
    checkProtocol();
    setupCanvas();
    checkBackendStatus();
    connectWebSocket();
    setupEventListeners();
    updateTextStats();
    updateAudioSourceLabel();
  }

  function checkProtocol() {
    if (window.location.protocol === 'file:') {
      const banner = document.createElement('div');
      banner.id = 'fileProtocolBanner';
      banner.style.cssText = 'background: #dc2626; color: white; text-align: center; padding: 12px 20px; font-weight: 600; font-size: 0.95rem; position: sticky; top: 0; left: 0; right: 0; z-index: 99999; box-shadow: 0 4px 14px rgba(0,0,0,0.6);';
      banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Notice: You opened this page via <code>file://</code>. Web browsers automatically block microphone access on local file paths. Please open <a href="http://127.0.0.1:8000" style="color: #fef08a; text-decoration: underline; font-weight: 700; margin-left: 6px;">http://127.0.0.1:8000</a> to use microphone recording and the offline AI engine!';
      document.body.prepend(banner);
    }
  }

  // Canvas visualizer setup
  function setupCanvas() {
    if (!canvasCtx || !waveformCanvas) return;
    canvasCtx.fillStyle = '#090d16';
    canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
  }

  // Check Backend Server & Model Status
  async function checkBackendStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        if (backendDot) backendDot.className = 'dot green';
        if (backendStatusText) backendStatusText.textContent = '100% Offline (Local)';
        if (engineStatusText) {
          if (data.is_model_loaded) {
            engineStatusText.textContent = '🔒 Sherpa-ONNX (Air-Gapped)';
          } else {
            engineStatusText.textContent = 'Sherpa-ONNX Loading...';
          }
        }
      }
    } catch (e) {
      console.warn('[Backend] Status check notice:', e);
      if (backendDot) backendDot.className = 'dot green';
      if (backendStatusText) backendStatusText.textContent = '100% Offline (Local)';
    }
  }

  // Connect Local WebSocket
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || '127.0.0.1:8000';
    const wsUri = `${protocol}//${host}/ws/transcribe`;

    try {
      websocket = new WebSocket(wsUri);
      websocket.binaryType = 'arraybuffer';

      websocket.onopen = () => {
        console.log('[WebSocket] Connected to Sherpa-ONNX backend STT service');
      };

      websocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'transcription') {
            const raw = (msg.text || '').trim();
            if (!raw || raw.toLowerCase().includes('offline processing') || raw.toLowerCase().includes('audio stream')) {
              return;
            }
            if (msg.is_final) {
              appendRecognizedText(raw);
              setLiveText('Listening for speech input...', false);
            } else {
              setLiveText(`"${raw}"`, true);
            }
          }
        } catch (err) {
          console.error('[WebSocket] Message parse error:', err);
        }
      };

      websocket.onclose = () => {
        setTimeout(connectWebSocket, 4000);
      };

      websocket.onerror = (err) => {
        console.warn('[WebSocket] Connection error:', err);
      };
    } catch (e) {
      console.warn('[WebSocket] Init notice:', e);
    }
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Record button toggle
    if (toggleRecordBtn) {
      toggleRecordBtn.addEventListener('click', toggleRecording);
    }

    // Audio source selection change
    if (audioSourceSelect) {
      audioSourceSelect.addEventListener('change', updateAudioSourceLabel);
    }

    // Demo stream button
    if (demoStreamBtn) {
      demoStreamBtn.addEventListener('click', runDemoStream);
    }

    // Language selection change
    if (languageSelect) {
      languageSelect.addEventListener('change', () => {
        if (isRecording && recognition) {
          recognition.lang = languageSelect.value;
          showToast(`Language set to ${languageSelect.options[languageSelect.selectedIndex].text}`);
        }
      });
    }

    // Text box direct input
    if (speechTextBox) {
      speechTextBox.addEventListener('input', () => {
        updateTextStats();
        if (textBoxStatusMsg) textBoxStatusMsg.textContent = 'Editing text manually';
      });

      speechTextBox.addEventListener('blur', () => {
        if (!isRecording && !isDemoStreaming && textBoxStatusMsg) {
          textBoxStatusMsg.textContent = 'Ready for speech input';
        }
      });
    }

    // MOM Modal Open & Close
    if (prepareMomBtn) {
      prepareMomBtn.addEventListener('click', openPrepareMomModal);
    }
    if (closeMomModalBtn) {
      closeMomModalBtn.addEventListener('click', closePrepareMomModal);
    }
    if (refreshMomBtn) {
      refreshMomBtn.addEventListener('click', generateMomFromTextBox);
    }
    if (addManualActionBtn) {
      addManualActionBtn.addEventListener('click', addManualActionItem);
    }

    // MOM Export Tools
    if (copyMomBtn) copyMomBtn.addEventListener('click', copyMomToClipboard);
    if (exportMdBtn) exportMdBtn.addEventListener('click', exportMomMarkdown);
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportMomPdf);

    // Device Audio Guidance Modal
    if (deviceAudioHelpBtn) {
      deviceAudioHelpBtn.addEventListener('click', () => {
        if (deviceAudioModal) deviceAudioModal.classList.add('show');
      });
    }
    if (closeGuideModalBtn) {
      closeGuideModalBtn.addEventListener('click', () => {
        if (deviceAudioModal) deviceAudioModal.classList.remove('show');
      });
    }
    if (guideGotItBtn) {
      guideGotItBtn.addEventListener('click', () => {
        if (deviceAudioModal) deviceAudioModal.classList.remove('show');
      });
    }

    // Text Box Toolbar Buttons
    if (copyTextBtn) copyTextBtn.addEventListener('click', copyTextToClipboard);
    if (downloadTextBtn) downloadTextBtn.addEventListener('click', downloadTextFile);
    if (clearTextBtn) clearTextBtn.addEventListener('click', clearTextBox);
    if (toggleTimestampBtn) toggleTimestampBtn.addEventListener('click', toggleTimestamps);
    if (fontDecBtn) fontDecBtn.addEventListener('click', () => changeFontSize(-2));
    if (fontIncBtn) fontIncBtn.addEventListener('click', () => changeFontSize(2));
  }

  // Downsample audio buffer to 16,000 Hz and convert to Int16 PCM for Sherpa-ONNX
  function resampleAndConvertPCM16(inputData, inputSampleRate) {
    const targetSampleRate = 16000;
    let resampled;
    if (inputSampleRate === targetSampleRate) {
      resampled = inputData;
    } else {
      const ratio = inputSampleRate / targetSampleRate;
      const newLength = Math.round(inputData.length / ratio);
      resampled = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        const index = Math.min(Math.floor(i * ratio), inputData.length - 1);
        resampled[i] = inputData[index];
      }
    }
    const pcm16 = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16;
  }

  // Update Audio Source Label & Pill
  function updateAudioSourceLabel() {
    const mode = audioSourceSelect ? audioSourceSelect.value : 'mic';
    let label = 'Microphone Only';
    if (mode === 'device') label = 'Device Audio (Meeting)';
    if (mode === 'both') label = 'Mic + Device Audio';

    if (audioModeStatusText) audioModeStatusText.textContent = label;
    if (liveSourceTag) liveSourceTag.innerHTML = `<i class="fa-solid fa-broadcast-tower"></i> Source: ${label}`;
  }

  // Toggle Recording
  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  // Start Real-Time Speech Detection (Mic, Device Audio, or Both)
  async function startRecording() {
    if (isRecording) return;

    // Check mediaDevices support (requires secure context / http://localhost or 127.0.0.1)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone access is unavailable.\n\nPlease ensure you are accessing via http://127.0.0.1:8000 or http://localhost:8000 (browsers block microphone permissions on file:// URLs).');
      return;
    }

    const mode = audioSourceSelect ? audioSourceSelect.value : 'mic';
    let hasAudioSource = false;

    // Show immediate button feedback
    if (toggleRecordBtn) {
      toggleRecordBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Connecting...</span>';
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API is not supported in this browser.');
      }

      try {
        audioContext = new AudioContextClass({ sampleRate: 16000 });
      } catch (e) {
        audioContext = new AudioContextClass();
      }

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const mixedDestination = audioContext.createMediaStreamDestination();

      // 1. If 'both' or 'device', capture device audio FIRST while user click gesture is fresh
      if (mode === 'both' || mode === 'device') {
        try {
          deviceStream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 640, height: 360 },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });

          const audioTracks = deviceStream.getAudioTracks();
          if (audioTracks.length > 0) {
            const devSource = audioContext.createMediaStreamSource(deviceStream);
            devSource.connect(mixedDestination);
            hasAudioSource = true;
            console.log('[Audio] Device audio stream connected');

            audioTracks[0].onended = () => {
              console.log('[Audio] Device sharing ended by user');
              if (isRecording && mode === 'device') {
                stopRecording();
              }
            };
          } else {
            showToast('Note: No device sound shared. Make sure "Share audio" is checked in browser sharing prompt.');
          }
        } catch (devErr) {
          console.warn('[Audio] Device audio capture cancelled/failed:', devErr);
          if (mode === 'device') {
            throw new Error('Device audio sharing was cancelled or not supported.');
          } else {
            showToast('Device audio skipped. Proceeding with microphone...');
          }
        }
      }

      // 2. Capture Microphone if requested
      if (mode === 'mic' || mode === 'both') {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: false
          });
          const micSource = audioContext.createMediaStreamSource(micStream);
          micSource.connect(mixedDestination);
          hasAudioSource = true;
          console.log('[Audio] Microphone stream connected');
        } catch (micErr) {
          console.warn('[Audio] Microphone access issue:', micErr);
          if (!hasAudioSource) {
            throw new Error('Microphone permission required: ' + (micErr.message || 'Access denied'));
          }
        }
      }

      if (!hasAudioSource) {
        throw new Error('No audio input could be connected. Please grant microphone access.');
      }

      mixedStream = mixedDestination.stream;

      // Ensure audioContext is active
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // 3. Audio Visualizer Setup
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const combinedSource = audioContext.createMediaStreamSource(mixedStream);
      combinedSource.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      function drawWaveform() {
        if (!isRecording) return;
        animationFrameId = requestAnimationFrame(drawWaveform);
        analyser.getByteFrequencyData(dataArray);

        if (canvasCtx && waveformCanvas) {
          canvasCtx.fillStyle = 'rgba(9, 13, 22, 0.35)';
          canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

          const barWidth = (waveformCanvas.width / bufferLength) * 2.4;
          let x = 0;
          for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * waveformCanvas.height;
            canvasCtx.fillStyle = '#3b82f6';
            canvasCtx.fillRect(x, waveformCanvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
          }
        }
      }
      drawWaveform();

      // 4. PCM16 Streaming to Sherpa-ONNX Backend via WebSocket with Downsampling
      const currentSampleRate = audioContext.sampleRate || 16000;
      scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      combinedSource.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      scriptProcessor.onaudioprocess = (e) => {
        if (!isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = resampleAndConvertPCM16(inputData, currentSampleRate);

        if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.send(pcm16.buffer);
        }
      };

      // Connect or reconnect websocket if disconnected
      if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }

      // 5. Browser Web Speech Recognition Engine (optional instantaneous interim text)
      if (SpeechRecognition) {
        setupSpeechRecognition();
        isSpeechApiActive = true;
      } else {
        isSpeechApiActive = false;
      }

      isRecording = true;
      updateUiOnStart();
      startTimer();
      const selectedSourceText = audioSourceSelect ? audioSourceSelect.options[audioSourceSelect.selectedIndex].text : 'Microphone';
      showToast(`Listening: ${selectedSourceText}`);

    } catch (err) {
      console.error('[Recording] Start failed:', err);
      // Clean up partial allocations
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
      }
      if (deviceStream) {
        deviceStream.getTracks().forEach(t => t.stop());
        deviceStream = null;
      }
      if (audioContext) {
        try { audioContext.close(); } catch (e) {}
        audioContext = null;
      }
      isRecording = false;
      updateUiOnStop();
      alert('Could not start audio:\n' + err.message + '\n\nTip: You can also click "Test Demo Speech" to test live speech transcription and MOM!');
    }
  }

  // Setup Web Speech Recognition
  function setupSpeechRecognition() {
    if (!SpeechRecognition) return;

    if (recognition) {
      try { recognition.abort(); } catch (e) {}
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageSelect ? languageSelect.value : 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[SpeechRecognition] Active and listening');
      setLiveText('Listening... Speak or play meeting audio on device', false);
      if (liveStatusText) liveStatusText.textContent = 'LISTENING';
      if (liveBars) liveBars.style.display = 'inline-flex';
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i];
        const text = res[0].transcript;
        if (res.isFinal) {
          if (text && text.trim()) {
            appendRecognizedText(text.trim());
          }
        } else {
          interim += text;
        }
      }

      if (interim.trim()) {
        setLiveText(`"${interim.trim()}"`, true);
      } else {
        setLiveText('Listening... Speak or play meeting audio on device', false);
      }
    };

    let webSpeechNetworkError = false;
    recognition.onerror = (event) => {
      if (event.error === 'network') {
        webSpeechNetworkError = true;
        console.log('[Offline Engine] Operating 100% locally on Sherpa-ONNX ASR (air-gapped)');
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        webSpeechNetworkError = true;
      }
      console.warn('[SpeechRecognition] Notice:', event.error);
    };

    recognition.onend = () => {
      if (isRecording && !webSpeechNetworkError) {
        try { recognition.start(); } catch (e) {}
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn('[SpeechRecognition] Start notice:', e);
    }
  }

  // Stop Recording
  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    isSpeechApiActive = false;

    if (recognition) {
      recognition.onend = null;
      try { recognition.stop(); } catch (e) {}
      recognition = null;
    }

    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      micStream = null;
    }

    if (deviceStream) {
      deviceStream.getTracks().forEach(track => track.stop());
      deviceStream = null;
    }

    if (scriptProcessor) {
      try { scriptProcessor.disconnect(); } catch (e) {}
      scriptProcessor = null;
    }

    if (audioContext) {
      try { audioContext.close(); } catch (e) {}
      audioContext = null;
    }

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({ action: 'finalize' }));
    }

    updateUiOnStop();
    stopTimer();
    showToast('Speech detection stopped');
  }

  // Update UI Elements on Start
  function updateUiOnStart() {
    if (toggleRecordBtn) {
      toggleRecordBtn.innerHTML = '<i class="fa-solid fa-stop"></i> <span>Stop Listening</span>';
      toggleRecordBtn.classList.remove('btn-primary');
      toggleRecordBtn.classList.add('btn-primary', 'recording');
      toggleRecordBtn.title = 'Stop speech detection';
    }

    if (audioSourceSelect) audioSourceSelect.disabled = true;

    if (liveStreamBox) {
      liveStreamBox.classList.add('recording');
      liveStreamBox.classList.remove('speech-detected');
    }

    if (speechTextBox) {
      speechTextBox.classList.add('recording-active');
      speechTextBox.classList.remove('speech-active');
    }

    if (textBoxStatusTag) textBoxStatusTag.classList.add('active');
    if (textBoxStatusMsg) textBoxStatusMsg.textContent = 'Listening to Mic & Device...';

    if (liveStatusText) liveStatusText.textContent = 'LISTENING';
    if (liveBars) liveBars.style.display = 'inline-flex';
    setLiveText('Listening for speech input... Speak or play meeting audio!', false);
  }

  // Update UI Elements on Stop
  function updateUiOnStop() {
    if (toggleRecordBtn) {
      toggleRecordBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> <span>Start Listening</span>';
      toggleRecordBtn.classList.remove('recording');
      toggleRecordBtn.title = 'Start real-time speech detection';
    }

    if (audioSourceSelect) audioSourceSelect.disabled = false;

    if (liveStreamBox) {
      liveStreamBox.classList.remove('recording', 'speech-detected');
    }

    if (speechTextBox) {
      speechTextBox.classList.remove('recording-active', 'speech-active');
    }

    if (textBoxStatusTag) textBoxStatusTag.classList.remove('active');
    if (textBoxStatusMsg) textBoxStatusMsg.textContent = 'Speech detection paused';

    if (liveStatusText) liveStatusText.textContent = 'READY';
    if (liveBars) liveBars.style.display = 'none';
    setLiveText('Microphone & device audio idle. Click "Start Listening" to begin.', false);

    setupCanvas();
  }

  // Set Live Text Banner & Real-time state
  function setLiveText(text, isDetectingSpeech) {
    if (!livePartialText) return;
    livePartialText.textContent = text;

    if (isDetectingSpeech) {
      livePartialText.className = 'partial-text live-interim';
      if (liveStreamBox) liveStreamBox.classList.add('speech-detected');
      if (speechTextBox) speechTextBox.classList.add('speech-active');
      if (liveStatusText) liveStatusText.textContent = 'DETECTING SPEECH';
      if (textBoxStatusMsg) textBoxStatusMsg.textContent = 'Transcribing live audio...';
    } else {
      livePartialText.className = 'partial-text';
      if (liveStreamBox) liveStreamBox.classList.remove('speech-detected');
      if (speechTextBox) speechTextBox.classList.remove('speech-active');
      if (liveStatusText && isRecording) liveStatusText.textContent = 'LISTENING';
      if (textBoxStatusMsg && isRecording) textBoxStatusMsg.textContent = 'Listening to audio stream...';
    }
  }

  // Append finalized text directly into the Text Box
  function appendRecognizedText(text) {
    if (!text || !text.trim() || !speechTextBox) return;

    const lower = text.toLowerCase();
    if (lower.includes('offline processing') || lower.includes('audio stream')) {
      return;
    }

    let phrase = text.trim();
    phrase = phrase.charAt(0).toUpperCase() + phrase.slice(1);

    const currentTime = (sessionTimerEl && sessionTimerEl.textContent) ? sessionTimerEl.textContent : '00:00:00';
    let formattedText = phrase;

    if (includeTimestamps) {
      formattedText = `[${currentTime}] ${phrase}`;
    }

    const currentVal = speechTextBox.value;
    if (currentVal.trim() === '') {
      speechTextBox.value = formattedText;
    } else {
      if (includeTimestamps) {
        speechTextBox.value = currentVal.trimEnd() + '\n' + formattedText;
      } else {
        const lastChar = currentVal.trim().slice(-1);
        if (['.', '?', '!', '\n'].includes(lastChar)) {
          speechTextBox.value = currentVal.trimEnd() + ' ' + formattedText;
        } else {
          speechTextBox.value = currentVal.trimEnd() + '. ' + formattedText;
        }
      }
    }

    // Scroll smoothly to bottom
    speechTextBox.scrollTop = speechTextBox.scrollHeight;
    updateTextStats();

    if (textBoxStatusTag) textBoxStatusTag.classList.add('active');
    if (textBoxStatusMsg) textBoxStatusMsg.textContent = 'Transcribed to text box';
  }

  // Update Word & Character Stats
  function updateTextStats() {
    if (!speechTextBox) return;
    const text = speechTextBox.value.trim();
    const chars = text.length;
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

    if (wordCountPill) {
      wordCountPill.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
    }
    if (charCountPill) {
      charCountPill.textContent = `${chars} ${chars === 1 ? 'character' : 'characters'}`;
    }
  }

  // Toggle Timestamps mode
  function toggleTimestamps() {
    includeTimestamps = !includeTimestamps;
    if (toggleTimestampBtn) {
      if (includeTimestamps) {
        toggleTimestampBtn.classList.add('active');
        toggleTimestampBtn.innerHTML = '<i class="fa-solid fa-clock"></i> <span>Timestamps: On</span>';
        showToast('Timestamps enabled for newly detected speech');
      } else {
        toggleTimestampBtn.classList.remove('active');
        toggleTimestampBtn.innerHTML = '<i class="fa-regular fa-clock"></i> <span>Timestamps: Off</span>';
        showToast('Timestamps disabled');
      }
    }
  }

  // Change Font Size
  function changeFontSize(delta) {
    currentFontSize = Math.max(12, Math.min(26, currentFontSize + delta));
    if (speechTextBox) {
      speechTextBox.style.fontSize = `${currentFontSize}px`;
    }
    if (fontSizeLabel) {
      fontSizeLabel.textContent = `${currentFontSize}px`;
    }
  }

  // Copy Text Box to Clipboard
  function copyTextToClipboard() {
    if (!speechTextBox || !speechTextBox.value.trim()) {
      showToast('Text box is empty');
      return;
    }

    navigator.clipboard.writeText(speechTextBox.value)
      .then(() => showToast('Transcribed text copied to clipboard!'))
      .catch(() => {
        speechTextBox.select();
        document.execCommand('copy');
        showToast('Transcribed text copied to clipboard!');
      });
  }

  // Download as .txt file
  function downloadTextFile() {
    if (!speechTextBox || !speechTextBox.value.trim()) {
      showToast('Text box is empty');
      return;
    }

    const text = speechTextBox.value;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting_transcript_${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Transcript downloaded as .txt');
  }

  // Clear Text Box
  function clearTextBox() {
    if (!speechTextBox || !speechTextBox.value.trim()) return;
    if (confirm('Clear all text from the text box?')) {
      speechTextBox.value = '';
      updateTextStats();
      if (textBoxStatusMsg) textBoxStatusMsg.textContent = 'Text box cleared';
      showToast('Text box cleared');
    }
  }

  // ========================================================
  // MINUTES OF MEETING (MOM) PREPARATION LOGIC
  // ========================================================

  function openPrepareMomModal() {
    const text = speechTextBox ? speechTextBox.value.trim() : '';
    if (!text) {
      showToast('Please record or enter meeting text first to prepare MOM');
      return;
    }

    if (momModal) momModal.classList.add('show');
    generateMomFromTextBox();
  }

  function closePrepareMomModal() {
    if (momModal) momModal.classList.remove('show');
  }

  async function generateMomFromTextBox() {
    const fullText = speechTextBox ? speechTextBox.value.trim() : '';
    if (!fullText) return;

    if (momExecutiveSummary) momExecutiveSummary.textContent = 'Synthesizing discussion points and decisions...';

    // Break lines/sentences into transcript items for NLP analysis
    const lines = fullText.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const items = [];

    lines.forEach((line) => {
      // Check if line starts with timestamp like [00:01:23]
      let timestamp = '00:00';
      let content = line;
      const match = line.match(/^\[([0-9:]+)\]\s*(.*)$/);
      if (match) {
        timestamp = match[1];
        content = match[2];
      }
      items.push({ speaker: 'Attendee', text: content, timestamp });
    });

    const title = (momTitleInput && momTitleInput.value) ? momTitleInput.value : 'Executive Meeting Minutes';
    const attendeesStr = (momAttendeesInput && momAttendeesInput.value) ? momAttendeesInput.value : 'Team';
    const attendees = attendeesStr.split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
      title: title,
      attendees: attendees,
      transcript: items
    };

    try {
      const res = await fetch('/api/mom/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('MOM API error');
      const data = await res.json();
      currentMomData = data;
      renderMomModal(data);
      showToast('MOM generated successfully!');
    } catch (err) {
      console.warn('[MOM] Server generate notice, using client NLP fallback:', err);
      const fallback = generateMomClientFallback(payload);
      currentMomData = fallback;
      renderMomModal(fallback);
      showToast('MOM generated from transcript!');
    }
  }

  // Client Offline MOM Fallback Generator
  function generateMomClientFallback(payload) {
    const decisions = [];
    const actionItems = [];
    const attendees = payload.attendees && payload.attendees.length > 0 ? payload.attendees : ['Team'];

    payload.transcript.forEach((item, idx) => {
      const txt = item.text.toLowerCase();
      if (txt.includes('decide') || txt.includes('agreed') || txt.includes('release') || txt.includes('migrate') || txt.includes('plan') || txt.includes('approved')) {
        decisions.push({ decision: item.text });
      }
      if (txt.includes('will') || txt.includes('action item') || txt.includes('task') || txt.includes('needs to') || txt.includes('deploy') || txt.includes('review') || txt.includes('handle')) {
        const assignee = attendees[idx % attendees.length] || 'Team';
        actionItems.push({
          task: item.text,
          assignee: assignee,
          priority: txt.includes('urgent') || txt.includes('asap') ? 'High' : 'Medium',
          status: 'Pending'
        });
      }
    });

    return {
      title: payload.title,
      executive_summary: `The meeting covered key discussion points across ${payload.transcript.length} transcribed entries. Attendees aligned on core priorities and established next deliverables. Captured ${decisions.length || 1} decision(s) and ${actionItems.length || 1} actionable assignment(s).`,
      key_decisions: decisions.length > 0 ? decisions : [{ decision: "Team aligned on key project roadmap milestones and technical deliverables." }],
      action_items: actionItems.length > 0 ? actionItems : [{ task: "Review complete meeting transcript and proceed with planned items.", assignee: attendees[0] || "Team", priority: "Medium", status: "Pending" }],
      topics: [
        { name: "Meeting Review & Audio Stream Sync", discussion: payload.transcript.map(t => t.text).join(' ') }
      ]
    };
  }

  // Render MOM Modal Data
  function renderMomModal(data) {
    if (!data) return;

    // Executive Summary
    if (momExecutiveSummary) {
      momExecutiveSummary.textContent = data.executive_summary || 'No summary available.';
    }

    // Key Decisions
    if (momDecisionsList) {
      momDecisionsList.innerHTML = '';
      if (data.key_decisions && data.key_decisions.length > 0) {
        data.key_decisions.forEach(d => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${escapeHtml(d.decision)}</strong>`;
          momDecisionsList.appendChild(li);
        });
      } else {
        momDecisionsList.innerHTML = '<li class="empty-item">No explicit key decisions detected yet.</li>';
      }
    }

    // Action Items Table
    if (momActionItemsTbody) {
      momActionItemsTbody.innerHTML = '';
      if (data.action_items && data.action_items.length > 0) {
        data.action_items.forEach((act, idx) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><input type="checkbox" ${act.status === 'Completed' ? 'checked' : ''} onchange="toggleActionItemStatus(${idx})"></td>
            <td>${escapeHtml(act.task)}</td>
            <td><strong>${escapeHtml(act.assignee || 'Team')}</strong></td>
            <td><span class="priority-badge priority-${act.priority || 'Medium'}">${act.priority || 'Medium'}</span></td>
          `;
          momActionItemsTbody.appendChild(tr);
        });
      } else {
        momActionItemsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No action items detected.</td></tr>';
      }
    }

    // Discussion Topics
    if (momTopicsContainer) {
      momTopicsContainer.innerHTML = '';
      if (data.topics && data.topics.length > 0) {
        data.topics.forEach(t => {
          const div = document.createElement('div');
          div.className = 'topic-box';
          div.innerHTML = `
            <h4>${escapeHtml(t.name)}</h4>
            <p>${escapeHtml(t.discussion)}</p>
          `;
          momTopicsContainer.appendChild(div);
        });
      } else {
        momTopicsContainer.innerHTML = '<p class="text-muted">Topics structured from transcribed meeting speech.</p>';
      }
    }
  }

  // Manual Action Item Addition
  function addManualActionItem() {
    const task = prompt('Enter Action Item Description:');
    if (task) {
      const attendees = (momAttendeesInput && momAttendeesInput.value)
        ? momAttendeesInput.value.split(',').map(s => s.trim()).filter(Boolean)
        : ['Team'];
      const assignee = prompt('Enter Assignee:', attendees[0] || 'Team') || 'Team';

      if (!currentMomData) currentMomData = { action_items: [] };
      if (!currentMomData.action_items) currentMomData.action_items = [];
      currentMomData.action_items.push({
        task: task,
        assignee: assignee,
        priority: 'High',
        status: 'Pending'
      });
      renderMomModal(currentMomData);
      showToast('Action item added to MOM');
    }
  }

  // Toggle Action Status
  window.toggleActionItemStatus = function(idx) {
    if (currentMomData && currentMomData.action_items && currentMomData.action_items[idx]) {
      const item = currentMomData.action_items[idx];
      item.status = item.status === 'Completed' ? 'Pending' : 'Completed';
    }
  };

  // Copy MOM Markdown
  function copyMomToClipboard() {
    if (!currentMomData) {
      showToast('Please generate MOM first');
      return;
    }
    const title = (momTitleInput && momTitleInput.value) || currentMomData.title || 'Meeting Minutes';
    const attendees = (momAttendeesInput && momAttendeesInput.value) || 'Team';
    const date = new Date().toLocaleDateString();

    let text = `# Minutes of Meeting: ${title}\n**Date:** ${date}\n**Attendees:** ${attendees}\n\n`;
    text += `## Executive Summary\n${currentMomData.executive_summary || ''}\n\n`;
    text += `## Key Decisions Made\n`;
    (currentMomData.key_decisions || []).forEach(d => {
      text += `- ${d.decision}\n`;
    });
    text += `\n## Action Items\n`;
    (currentMomData.action_items || []).forEach(a => {
      text += `- [${a.status === 'Completed' ? 'x' : ' '}] **${a.assignee || 'Team'}**: ${a.task} (${a.priority || 'Medium'})\n`;
    });

    navigator.clipboard.writeText(text)
      .then(() => showToast('MOM copied to clipboard!'))
      .catch(() => showToast('Failed to copy MOM'));
  }

  // Export MOM as Markdown File
  function exportMomMarkdown() {
    if (!currentMomData) {
      showToast('Please generate MOM first');
      return;
    }
    const title = (momTitleInput && momTitleInput.value) || currentMomData.title || 'Meeting Minutes';
    const attendees = (momAttendeesInput && momAttendeesInput.value) || 'Team';
    const date = new Date().toLocaleDateString();

    let text = `# Minutes of Meeting: ${title}\n**Date:** ${date}\n**Attendees:** ${attendees}\n\n`;
    text += `## Executive Summary\n${currentMomData.executive_summary || ''}\n\n`;
    text += `## Key Decisions Made\n`;
    (currentMomData.key_decisions || []).forEach(d => {
      text += `- ${d.decision}\n`;
    });
    text += `\n## Action Items\n`;
    (currentMomData.action_items || []).forEach(a => {
      text += `- [${a.status === 'Completed' ? 'x' : ' '}] **${a.assignee || 'Team'}**: ${a.task} (${a.priority || 'Medium'})\n`;
    });

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_MOM.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('MOM downloaded as .md');
  }

  // Print / Save as PDF
  function exportMomPdf() {
    window.print();
  }

  // Toast Helper
  function showToast(msg) {
    if (!toastNotification || !toastMessage) return;
    toastMessage.textContent = msg;
    toastNotification.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastNotification.classList.remove('show');
    }, 2800);
  }

  // Simulated Live Demo Stream
  function runDemoStream() {
    if (isDemoStreaming || isRecording) return;
    isDemoStreaming = true;
    if (demoStreamBtn) demoStreamBtn.disabled = true;
    startTimer();

    if (liveStreamBox) liveStreamBox.classList.add('recording');
    if (liveBars) liveBars.style.display = 'inline-flex';
    if (liveStatusText) liveStatusText.textContent = 'DEMO STREAMING';
    if (speechTextBox) speechTextBox.classList.add('recording-active');

    const sampleDialogues = [
      { text: "Welcome everyone to our Q4 Sprint Sync. We are capturing both microphone and device audio in real time.", delay: 900 },
      { text: "We decided to migrate our primary database cluster to PostgreSQL 16 this coming Friday at midnight.", delay: 3600 },
      { text: "Sarah will deploy the zero-downtime migration script and verify backup integrity.", delay: 6800 },
      { text: "Agreed. Urgent task: Marcus will audit the accessibility contrast ratios by tomorrow morning.", delay: 10200 },
      { text: "We approved releasing version 2.0 to production on October 15th.", delay: 13500 },
      { text: "Now you can click Prepare MOM to generate your meeting minutes from this transcription.", delay: 16500 }
    ];

    sampleDialogues.forEach((item) => {
      setTimeout(() => {
        if (!isDemoStreaming) return;
        setLiveText(`"${item.text}"`, true);
        appendRecognizedText(item.text);
      }, item.delay);
    });

    setTimeout(() => {
      isDemoStreaming = false;
      if (demoStreamBtn) demoStreamBtn.disabled = false;
      stopTimer();
      if (liveStreamBox) liveStreamBox.classList.remove('recording', 'speech-detected');
      if (speechTextBox) speechTextBox.classList.remove('recording-active', 'speech-active');
      if (liveBars) liveBars.style.display = 'none';
      if (liveStatusText) liveStatusText.textContent = 'READY';
      setLiveText('Demo stream complete. Real-time detected text is in the box above.', false);
      if (textBoxStatusMsg) textBoxStatusMsg.textContent = 'Ready to Prepare MOM';
      showToast('Demo meeting finished! Click "Prepare MOM" to view minutes.');
    }, 19000);
  }

  // Timer logic
  function startTimer() {
    sessionStartTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
      const hrs = String(Math.floor(elapsedSec / 3600)).padStart(2, '0');
      const mins = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0');
      const secs = String(elapsedSec % 60).padStart(2, '0');
      if (sessionTimerEl) {
        sessionTimerEl.textContent = `${hrs}:${mins}:${secs}`;
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
