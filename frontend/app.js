/**
 * Sherpa ONNX Real-Time Speech-to-Text & MOM Platform
 * Frontend Client Application
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const startRecordBtn = document.getElementById('startRecordBtn');
  const stopRecordBtn = document.getElementById('stopRecordBtn');
  const demoStreamBtn = document.getElementById('demoStreamBtn');
  const generateMomBtn = document.getElementById('generateMomBtn');
  
  const engineStatusPill = document.getElementById('engineStatusPill');
  const engineStatusText = document.getElementById('engineStatusText');
  const wsStatusPill = document.getElementById('wsStatusPill');
  const wsStatusText = document.getElementById('wsStatusText');
  
  const meetingTitleInput = document.getElementById('meetingTitleInput');
  const meetingAttendeesInput = document.getElementById('meetingAttendeesInput');
  const activeSpeakerSelect = document.getElementById('activeSpeakerSelect');
  const addSpeakerBtn = document.getElementById('addSpeakerBtn');
  
  const sessionTimerEl = document.getElementById('sessionTimer');
  const waveformCanvas = document.getElementById('waveformCanvas');
  const canvasCtx = waveformCanvas.getContext('2d');
  
  const livePartialText = document.getElementById('livePartialText');
  const transcriptFeed = document.getElementById('transcriptFeed');
  const emptyTranscriptState = document.getElementById('emptyTranscriptState');
  const transcriptSearchInput = document.getElementById('transcriptSearchInput');
  const clearTranscriptBtn = document.getElementById('clearTranscriptBtn');
  
  const momExecutiveSummary = document.getElementById('momExecutiveSummary');
  const momDecisionsList = document.getElementById('momDecisionsList');
  const momActionItemsTbody = document.getElementById('momActionItemsTbody');
  const momTopicsContainer = document.getElementById('momTopicsContainer');
  const addManualActionBtn = document.getElementById('addManualActionBtn');
  
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const exportMdBtn = document.getElementById('exportMdBtn');
  const copyMomBtn = document.getElementById('copyMomBtn');

  // Application State
  let websocket = null;
  let isRecording = false;
  let isDemoStreaming = false;
  let audioContext = null;
  let mediaStream = null;
  let scriptProcessor = null;
  let timerInterval = null;
  let sessionStartTime = 0;
  let transcriptItems = [];
  let currentMomData = null;
  let speechRecognition = null;
  let isEngineOnline = false;

  const WS_URL = `ws://${window.location.host}/ws/transcribe`;
  const API_STATUS = `/api/status`;
  const API_GENERATE_MOM = `/api/mom/generate`;

  // Initialize App
  init();

  async function init() {
    setupCanvas();
    await checkEngineStatus();
    connectWebSocket();
    setupEventListeners();
  }

  // Canvas visualizer setup
  function setupCanvas() {
    canvasCtx.fillStyle = '#0e1626';
    canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
  }

  // Check Backend Engine Status
  async function checkEngineStatus() {
    try {
      const res = await fetch(API_STATUS);
      const data = await res.json();
      if (data.is_model_loaded) {
        setEngineStatus('green', 'Sherpa ONNX Loaded (630MB)');
        isEngineOnline = true;
      } else {
        setEngineStatus('yellow', 'Sherpa ONNX Offline (Fallback Mode)');
        isEngineOnline = false;
      }
    } catch (e) {
      setEngineStatus('yellow', 'Server Offline (Browser Fallback)');
      isEngineOnline = false;
    }
  }

  function setEngineStatus(colorClass, text) {
    const dot = engineStatusPill.querySelector('.dot');
    dot.className = `dot ${colorClass}`;
    engineStatusText.textContent = text;
  }

  function setWsStatus(colorClass, text) {
    const dot = wsStatusPill.querySelector('.dot');
    dot.className = `dot ${colorClass}`;
    wsStatusText.textContent = text;
  }

  // Connect WebSocket for Sherpa ONNX Streaming
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || '127.0.0.1:8000';
    const wsUri = `${protocol}//${host}/ws/transcribe`;

    setWsStatus('yellow', 'Connecting WebSocket...');

    try {
      websocket = new WebSocket(wsUri);
      websocket.binaryType = 'arraybuffer';

      websocket.onopen = () => {
        setWsStatus('green', 'WebSocket Connected');
      };

      websocket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'transcription') {
          if (msg.is_final) {
            const speaker = (activeSpeakerSelect && activeSpeakerSelect.value) ? activeSpeakerSelect.value : 'Speaker';
            appendTranscriptItem(speaker, msg.text);
            livePartialText.textContent = 'Listening...';
          } else {
            livePartialText.textContent = msg.text || 'Listening...';
          }
        }
      };

      websocket.onclose = () => {
        setWsStatus('red', 'WebSocket Disconnected');
        setTimeout(connectWebSocket, 5000);
      };

      websocket.onerror = () => {
        setWsStatus('red', 'WebSocket Error');
      };
    } catch (e) {
      setWsStatus('red', 'WebSocket Unavailable');
    }
  }

  // Event Listeners
  function setupEventListeners() {
    startRecordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    demoStreamBtn.addEventListener('click', runDemoStream);
    generateMomBtn.addEventListener('click', generateMom);
    clearTranscriptBtn.addEventListener('click', clearTranscript);
    
    if (addSpeakerBtn && activeSpeakerSelect) {
      addSpeakerBtn.addEventListener('click', () => {
        const name = prompt('Enter new speaker name:');
        if (name) {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          activeSpeakerSelect.appendChild(opt);
          activeSpeakerSelect.value = name;
        }
      });
    }

    addManualActionBtn.addEventListener('click', () => {
      const task = prompt('Enter Action Task:');
      if (task) {
        const assignee = (activeSpeakerSelect && activeSpeakerSelect.value) 
          ? activeSpeakerSelect.value 
          : (meetingAttendeesInput && meetingAttendeesInput.value ? meetingAttendeesInput.value.split(',')[0].trim() : 'Participant');
        if (!currentMomData) currentMomData = { action_items: [] };
        if (!currentMomData.action_items) currentMomData.action_items = [];
        currentMomData.action_items.push({
          task: task,
          assignee: assignee,
          priority: 'High',
          status: 'Pending'
        });
        renderMomBoard(currentMomData);
      }
    });

    transcriptSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const entries = transcriptFeed.querySelectorAll('.transcript-entry');
      entries.forEach(entry => {
        const text = entry.textContent.toLowerCase();
        entry.style.display = text.includes(q) ? 'flex' : 'none';
      });
    });

    exportPdfBtn.addEventListener('click', exportPdf);
    exportMdBtn.addEventListener('click', exportMarkdown);
    copyMomBtn.addEventListener('click', copyMomToClipboard);
  }

  // Start Real-Time Microphone Recording
  async function startRecording() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      
      const source = audioContext.createMediaStreamSource(mediaStream);
      scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      function drawWaveform() {
        if (!isRecording) return;
        requestAnimationFrame(drawWaveform);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.fillStyle = 'rgba(11, 15, 25, 0.4)';
        canvasCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

        const barWidth = (waveformCanvas.width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * waveformCanvas.height;
          canvasCtx.fillStyle = '#3b82f6';
          canvasCtx.fillRect(x, waveformCanvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }
      drawWaveform();

      scriptProcessor.onaudioprocess = (e) => {
        if (!isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Downsample / convert float32 to int16 PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send binary PCM to websocket if ready
        if (websocket && websocket.readyState === WebSocket.OPEN) {
          websocket.send(pcm16.buffer);
        }
      };

      // Fallback: Browser Web Speech API if server engine is offline
      if (!isEngineOnline && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        setupBrowserSpeechRecognition();
      }

      isRecording = true;
      startRecordBtn.disabled = true;
      stopRecordBtn.disabled = false;
      startTimer();
      livePartialText.textContent = 'Recording microphone stream... Speak into mic!';
    } catch (err) {
      alert('Microphone access error: ' + err.message + '. You can run the Demo Stream instead!');
    }
  }

  // Browser Speech Recognition Fallback
  function setupBrowserSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const finalTranscript = event.results[i][0].transcript;
          const speaker = (activeSpeakerSelect && activeSpeakerSelect.value) ? activeSpeakerSelect.value : 'Speaker';
          appendTranscriptItem(speaker, finalTranscript);
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (interim) {
        livePartialText.textContent = interim;
      }
    };

    speechRecognition.start();
  }

  // Stop Recording
  function stopRecording() {
    isRecording = false;
    startRecordBtn.disabled = false;
    stopRecordBtn.disabled = true;
    stopTimer();

    if (speechRecognition) {
      speechRecognition.stop();
      speechRecognition = null;
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({ action: 'finalize' }));
    }

    livePartialText.textContent = 'Recording stopped. Refreshing MOM summary...';
    generateMom();
  }

  // Run Live Demo Stream (Simulated Speech Demo)
  function runDemoStream() {
    if (isDemoStreaming) return;
    isDemoStreaming = true;
    demoStreamBtn.disabled = true;
    startTimer();

    const sampleDialogues = [
      { speaker: "Speaker 1 (Alex)", text: "Welcome everyone to our Q4 Sprint Sync. We need to finalize our database migration and API release dates.", delay: 1000 },
      { speaker: "Speaker 2 (Sarah)", text: "We decided to migrate the primary database cluster to PostgreSQL 16 this coming Friday at midnight.", delay: 3500 },
      { speaker: "Speaker 1 (Alex)", text: "Agreed. Action item: Sarah will lead the migration script deployment and verify zero-downtime backups.", delay: 6500 },
      { speaker: "Speaker 3 (Marcus)", text: "I finished the glassmorphism UI design system for the speech transcriber dashboard.", delay: 9500 },
      { speaker: "Speaker 2 (Sarah)", text: "Great job Marcus. Urgent task: Marcus needs to review the accessibility contrast ratios by tomorrow morning.", delay: 12500 },
      { speaker: "Speaker 1 (Alex)", text: "Perfect. We agreed on releasing version 2.0 to production on October 15th.", delay: 15500 }
    ];

    sampleDialogues.forEach((item) => {
      setTimeout(() => {
        if (!isDemoStreaming) return;
        livePartialText.textContent = `[Streaming] ${item.speaker}: "${item.text}"`;
        appendTranscriptItem(item.speaker, item.text);
      }, item.delay);
    });

    setTimeout(() => {
      isDemoStreaming = false;
      demoStreamBtn.disabled = false;
      stopTimer();
      livePartialText.textContent = 'Demo stream complete! Generating MOM summary...';
      generateMom();
    }, 18000);
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
      sessionTimerEl.textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  // Append entry to transcript feed
  function appendTranscriptItem(speaker, text) {
    if (!text || !text.trim()) return;

    if (emptyTranscriptState) {
      emptyTranscriptState.style.display = 'none';
    }

    const timestamp = sessionTimerEl.textContent || '00:00:00';
    const item = { speaker, text: text.trim(), timestamp };
    transcriptItems.push(item);

    const entryCard = document.createElement('div');
    entryCard.className = 'transcript-entry';
    entryCard.innerHTML = `
      <div class="entry-header">
        <span class="speaker-badge"><i class="fa-solid fa-user"></i> ${escapeHtml(speaker)}</span>
        <span class="timestamp">${timestamp}</span>
      </div>
      <p class="entry-text">${escapeHtml(text)}</p>
    `;

    transcriptFeed.appendChild(entryCard);
    transcriptFeed.scrollTop = transcriptFeed.scrollHeight;

    // Trigger progressive MOM generation
    if (transcriptItems.length % 2 === 0) {
      generateMom();
    }
  }

  function clearTranscript() {
    if (confirm('Clear all recorded transcript items?')) {
      transcriptItems = [];
      transcriptFeed.innerHTML = '';
      transcriptFeed.appendChild(emptyTranscriptState);
      emptyTranscriptState.style.display = 'flex';
      momExecutiveSummary.textContent = 'Real-time MOM summary will generate automatically...';
      momDecisionsList.innerHTML = '<li class="empty-item">No key decisions captured yet.</li>';
      momActionItemsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No action items logged yet.</td></tr>';
      momTopicsContainer.innerHTML = '<p class="text-muted">Topics will be structured as speech progresses.</p>';
    }
  }

  // Generate / Fetch Minutes of Meeting (MOM)
  async function generateMom() {
    if (transcriptItems.length === 0) return;

    const payload = {
      title: meetingTitleInput.value || 'Meeting Minutes',
      attendees: (meetingAttendeesInput.value || '').split(',').map(s => s.trim()).filter(Boolean),
      transcript: transcriptItems
    };

    try {
      const res = await fetch(API_GENERATE_MOM, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      currentMomData = data;
      renderMomBoard(data);
    } catch (e) {
      // Local JS client fallback generator
      const fallbackData = generateMomClientFallback(payload);
      currentMomData = fallbackData;
      renderMomBoard(fallbackData);
    }
  }

  // Client Fallback MOM Generator
  function generateMomClientFallback(payload) {
    const fullText = payload.transcript.map(t => t.text).join(' ');
    const decisions = [];
    const actionItems = [];

    payload.transcript.forEach(item => {
      const txt = item.text.toLowerCase();
      if (txt.includes('decide') || txt.includes('agreed') || txt.includes('release') || txt.includes('migrate')) {
        decisions.push({ decision: item.text, speaker: item.speaker });
      }
      if (txt.includes('will') || txt.includes('action item') || txt.includes('task') || txt.includes('needs to')) {
        actionItems.push({
          task: item.text,
          assignee: item.speaker,
          priority: txt.includes('urgent') ? 'High' : 'Medium',
          status: 'Pending'
        });
      }
    });

    return {
      title: payload.title,
      executive_summary: `Meeting attended by ${payload.attendees.join(', ')}. Discussion covered core sprint milestones. Captured ${decisions.length} key decision(s) and ${actionItems.length} action item(s).`,
      key_decisions: decisions.length > 0 ? decisions : [{ decision: "Team agreed on upcoming sprint priorities." }],
      action_items: actionItems.length > 0 ? actionItems : [{ task: "Review transcript details.", assignee: payload.attendees[0] || "Team", priority: "Medium", status: "Pending" }],
      topics: [{ name: "Main Sprint Discussion", discussion: fullText }]
    };
  }

  // Render MOM Board UI
  function renderMomBoard(data) {
    // Executive Summary
    momExecutiveSummary.textContent = data.executive_summary || 'No summary available.';

    // Decisions
    momDecisionsList.innerHTML = '';
    if (data.key_decisions && data.key_decisions.length > 0) {
      data.key_decisions.forEach(d => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${escapeHtml(d.decision)}</strong> <span class="text-muted">(${escapeHtml(d.speaker || 'Team')})</span>`;
        momDecisionsList.appendChild(li);
      });
    } else {
      momDecisionsList.innerHTML = '<li class="empty-item">No key decisions captured yet.</li>';
    }

    // Action Items
    momActionItemsTbody.innerHTML = '';
    if (data.action_items && data.action_items.length > 0) {
      data.action_items.forEach((act, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input type="checkbox" ${act.status === 'Completed' ? 'checked' : ''} onchange="toggleActionStatus(${idx})"></td>
          <td>${escapeHtml(act.task)}</td>
          <td><strong>${escapeHtml(act.assignee)}</strong></td>
          <td><span class="priority-badge priority-${act.priority || 'Medium'}">${act.priority || 'Medium'}</span></td>
        `;
        momActionItemsTbody.appendChild(tr);
      });
    } else {
      momActionItemsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No action items logged yet.</td></tr>';
    }

    // Topics
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
      momTopicsContainer.innerHTML = '<p class="text-muted">Topics will be structured as speech progresses.</p>';
    }
  }

  // Export Tools
  function exportPdf() {
    window.print();
  }

  function exportMarkdown() {
    if (!currentMomData) return alert('No MOM data to export yet!');
    let md = `# Minutes of Meeting: ${currentMomData.title}\n`;
    md += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
    md += `## Executive Summary\n${currentMomData.executive_summary}\n\n`;
    md += `## Key Decisions\n`;
    (currentMomData.key_decisions || []).forEach(d => {
      md += `- ${d.decision} (${d.speaker})\n`;
    });
    md += `\n## Action Items\n`;
    (currentMomData.action_items || []).forEach(a => {
      md += `- [ ] **${a.assignee}**: ${a.task} [Priority: ${a.priority}]\n`;
    });
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentMomData.title.replace(/\s+/g, '_')}_MOM.md`;
    a.click();
  }

  function copyMomToClipboard() {
    if (!currentMomData) return alert('No MOM data to copy!');
    const text = `MINUTES OF MEETING: ${currentMomData.title}\n\nEXECUTIVE SUMMARY:\n${currentMomData.executive_summary}\n\nKEY DECISIONS:\n` +
      (currentMomData.key_decisions || []).map(d => `• ${d.decision}`).join('\n') +
      `\n\nACTION ITEMS:\n` +
      (currentMomData.action_items || []).map(a => `• [${a.assignee}] ${a.task}`).join('\n');
    
    navigator.clipboard.writeText(text);
    alert('MOM copied to clipboard!');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
