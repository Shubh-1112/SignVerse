// script.js (replacement) — wrap in DOMContentLoaded and declare elements before use
document.addEventListener('DOMContentLoaded', () => {
  // Hide loading screen on page load
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 1000); // Adjust delay as needed
  }

  const socket = io();

  // DOM elements (declare first)
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');

  const modeToggleBtn = document.getElementById('modeToggle');
  const modeLabel = document.getElementById('modeLabel');
  const modeIcon = document.getElementById('modeIcon');

  const createMeetingBtn = document.getElementById('createMeeting');
  const joinBtn = document.getElementById('joinBtn');
  const joinModal = document.getElementById('joinModal');
  const closeJoinModalBtn = document.getElementById('closeJoinModal');
  const joinMeetingBtn = document.getElementById('joinMeetingBtn');

  const meetingPage = document.getElementById('meetingPage');
  const landingPage = document.getElementById('landingPage');

  const sendBtn = document.getElementById('sendBtn');
  const chatInput = document.querySelector('.chat-input');
  const chatMessages = document.getElementById('chatMessages');

  const chatBtn = document.getElementById('chatBtn');
  const leaveBtn = document.getElementById('leaveBtn');
  const muteBtn = document.getElementById('muteBtn');
  const cameraBtn = document.getElementById('cameraBtn');

  // Spinner elements
  const chatSpinner = document.getElementById('chatSpinner');
  const textSignSpinner = document.getElementById('textSignSpinner');
  const createSpinner = document.getElementById('createSpinner');
  const joinSpinner = document.getElementById('joinSpinner');

  // state
  let localStream;
  let pc;
  let room;
  let username;
  let isMuted = false;
  let isCameraOff = false;
  let remoteVideoCheckInterval;


  /* ---------------- Dark mode ---------------- */
  function updateModeUI(isDark) {
    if (isDark) {
      modeLabel.textContent = 'Dark Mode';
      modeIcon.innerHTML = `
        <circle cx="12" cy="12" r="5"></circle>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      `;
    } else {
      modeLabel.textContent = 'Light Mode';
      modeIcon.innerHTML = `
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      `;
    }
  }

  function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    updateModeUI(isDark);
    localStorage.setItem('darkMode', isDark);
    // update emoji theme if picker exists
    if (emojiPicker) {
      emojiPicker.setTheme && emojiPicker.setTheme(isDark ? 'dark' : 'light');
    }
  }

  modeToggleBtn.addEventListener('click', toggleDarkMode);
  const savedMode = localStorage.getItem('darkMode');
  if (savedMode === 'true') {
    document.body.classList.add('dark-mode');
    updateModeUI(true);
  } else {
    updateModeUI(false);
  }

  /* ---------------- Meeting create / join UI ---------------- */
  createMeetingBtn.addEventListener('click', () => {
    const meetingId = generateMeetingId();
    showMeetingCreatedModal(meetingId);
  });

  function showJoinModal() {
    joinModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeJoinModal() {
    joinModal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }

  joinBtn.addEventListener('click', showJoinModal);
  closeJoinModalBtn.addEventListener('click', closeJoinModal);
  joinModal.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeJoinModal();
  });

  joinMeetingBtn.addEventListener('click', async () => {
    const roomInput = document.querySelector('#joinModal #room');
    const usernameInput = document.querySelector('#joinModal #username');
    room = roomInput.value.trim();
    username = usernameInput.value.trim();

    if (!room || !username) {
      showAlert("Enter Room ID and your name", 'error');
      return;
    }

    closeJoinModal();

    // Switch to meeting view
    landingPage.style.display = 'none';
    meetingPage.style.display = 'block';

    document.getElementById('localLabel').textContent = username;
    document.getElementById('remoteLabel').textContent = 'Waiting for participant...';

    await startLocalStream();
    socket.emit('join', { username, room });
    initPeerConnection();
  });


  // --- Slider option logic (works even if chatPanel is hidden initially) ---
  (function initChatSlider() {
    const sliderOptions = document.querySelectorAll('.slider-option');
    const textSignContainer = document.querySelector('.text-sign-container');
    const signTextContainer = document.querySelector('.sign-text-container');
    // the chat container is the one that doesn't have sign-text/text-sign classes
    const chatContainer = document.querySelector('.chat-container:not(.sign-text-container):not(.text-sign-container)');
    // Ensure chatInput variable already exists (declared earlier)
    if (!sliderOptions || sliderOptions.length === 0) {
      console.warn('No slider options found. Check selectors.');
      return;
    }

    // helper to set active state
    function showOption(optionName) {
      sliderOptions.forEach(o => o.classList.toggle('active', o.getAttribute('data-option') === optionName));

      // Move the slider indicator for three options
      const sliderIndicator = document.querySelector('.slider-indicator');
      if (sliderIndicator) {
        const optionsArr = Array.from(sliderOptions);
        const idx = Math.max(0, optionsArr.findIndex(o => o.getAttribute('data-option') === optionName));
        sliderIndicator.style.transform = `translateX(${idx * 100}%)`;
      }

      // hide all
      if (textSignContainer) textSignContainer.style.display = 'none';
      if (signTextContainer) signTextContainer.style.display = 'none';
      if (chatContainer) chatContainer.style.display = 'none';

      if (optionName === 'text-sign') {
        if (textSignContainer) textSignContainer.style.display = 'flex';
        if (chatInput) { chatInput.disabled = true; chatInput.placeholder = ''; }
      } else if (optionName === 'sign-text') {
        if (signTextContainer) signTextContainer.style.display = 'flex';
        if (chatInput) { chatInput.disabled = true; chatInput.placeholder = ''; }
      } else { // 'chat'
        if (chatContainer) chatContainer.style.display = 'flex';
        if (chatInput) { chatInput.disabled = false; chatInput.placeholder = 'Type a message...'; }
      }
    }

    // attach click handlers
    sliderOptions.forEach(option => {
      option.addEventListener('click', () => {
        const selected = option.getAttribute('data-option');
        showOption(selected);
      });
    });

    // initial state: read which had .active in DOM, otherwise default to 'chat'
    const initiallyActive = document.querySelector('.slider-option.active');
    showOption(initiallyActive ? initiallyActive.getAttribute('data-option') : 'chat');
  })();

  // Ensure sendBtn exists before attaching listener
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  } else {
    console.warn('sendBtn not found in DOM');
  }

  // Enter key to send (without shift)
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  /* -------------- Chat Tools Functionality -------------- */

  // Grammar Correction Button
  const grammarBtn = document.getElementById('grammarBtn');
  if (grammarBtn) {
    grammarBtn.addEventListener('click', async () => {
      const text = chatInput.value.trim();
      if (text) {
        // Show spinner
        if (chatSpinner) chatSpinner.style.display = 'block';
        grammarBtn.disabled = true;

        try {
          const response = await fetch('/grammar_correction', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
          });
          const data = await response.json();
          if (data.corrected) {
            chatInput.value = data.corrected;
            chatInput.focus();
            autoResizeTextarea(chatInput);
          } else if (data.error) {
            showAlert(data.error, 'error');
          }
        } catch (error) {
          console.error('Grammar correction error:', error);
          showAlert('Failed to correct grammar. Please try again.', 'error');
        } finally {
          // Hide spinner
          if (chatSpinner) chatSpinner.style.display = 'none';
          grammarBtn.disabled = false;
        }
      }
    });
  }

  // Style Enhancement Button and Dropdown
  const styleBtn = document.getElementById('styleBtn');
  const styleDropdown = document.getElementById('styleDropdown');
  const styleOptions = document.querySelectorAll('.style-option');

  if (styleBtn && styleDropdown) {
    // Toggle dropdown visibility
    styleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = styleDropdown.style.display === 'block';
      styleDropdown.style.display = isVisible ? 'none' : 'block';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!styleBtn.contains(e.target) && !styleDropdown.contains(e.target)) {
        styleDropdown.style.display = 'none';
      }
    });

    // Handle style option selection
    styleOptions.forEach(option => {
      option.addEventListener('click', async () => {
        const style = option.getAttribute('data-style');
        const text = chatInput.value.trim();
        if (text) {
          // Show spinner
          if (chatSpinner) chatSpinner.style.display = 'block';
          styleBtn.disabled = true;

          try {
            const response = await fetch('/style_enhancement', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ text: text, style: style })
            });
            const data = await response.json();
            if (data.enhanced) {
              chatInput.value = data.enhanced;
              chatInput.focus();
              autoResizeTextarea(chatInput);
            } else if (data.error) {
              showAlert(data.error, 'error');
            }
          } catch (error) {
            console.error('Style enhancement error:', error);
            showAlert('Failed to enhance style. Please try again.', 'error');
          } finally {
            // Hide spinner
            if (chatSpinner) chatSpinner.style.display = 'none';
            styleBtn.disabled = false;
          }
        }
        styleDropdown.style.display = 'none';
      });
    });
  }



  function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    displayMessage({ message, username }, true);
    socket.emit('chat-message', { message, username, room });
    chatInput.value = '';
    autoResizeTextarea(chatInput);
  }

  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  /* -------------- Buttons: mute / camera / leave / chat -------------- */
  muteBtn.addEventListener('click', () => {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
    // swap icon (proper SVG icons)
    if (isMuted) {
      muteBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 7L12 11M12 11L8 7M12 11V21M4 9V15H8L12 19V5L8 9H4Z" />
          <line x1="19" y1="5" x2="5" y2="19" />
        </svg>
      `;
    } else {
      muteBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      `;
    }
  });

  cameraBtn.addEventListener('click', () => {
    if (!localStream) return;
    isCameraOff = !isCameraOff;
    localStream.getVideoTracks().forEach(t => t.enabled = !isCameraOff);
    updateLocalVideoDisplay();
    // swap icon (proper SVG icons)
    if (isCameraOff) {
      cameraBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      `;
    } else {
      cameraBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      `;
    }
  });

  leaveBtn.addEventListener('click', () => {
    socket.emit('leave', { username, room });
    if (pc) pc.close();
    pc = null;
    remoteVideo.srcObject = null;

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
      localVideo.srcObject = null;
    }

    meetingPage.style.display = 'none';
    landingPage.style.display = 'block';
  });

  // Chat toggle
  let isChatActive = false;
  chatBtn.addEventListener('click', () => {
    const meetingContainer = document.getElementById('meetingPage').querySelector('.meeting-container');
    const chatPanel = document.getElementById('chatPanel');
    isChatActive = !isChatActive;

    if (isChatActive) {
      meetingContainer.classList.add('chat-active');
      chatPanel.style.display = 'flex';
    } else {
      meetingContainer.classList.remove('chat-active');
      chatPanel.style.display = 'none';
    }
  });

  /* -------------- Video + PeerConnection -------------- */
  async function startLocalStream() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      showAlert('Unable to access camera/microphone', 'error');
    }
  }

  function initPeerConnection() {
    pc = new RTCPeerConnection();
    if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
      updateRemoteVideoDisplay();
      if (remoteVideoCheckInterval) clearInterval(remoteVideoCheckInterval);
      remoteVideoCheckInterval = setInterval(updateRemoteVideoDisplay, 250);
      // attach track event handlers if needed...
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit('signal', { candidate: event.candidate, room });
    };

    socket.on('signal', async (data) => {
      try {
        if (data.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { ...answer, room });
        } else if (data.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
        } else if (data.candidate) {
          await pc.addIceCandidate(data.candidate);
        }
      } catch (e) {
        console.error('Signal handling error', e);
      }
    });

    // user join/leave handlers (server events)
    socket.on('user-joined', (data) => {
      if (data.username !== username) {
        document.getElementById('remoteLabel').textContent = data.username;
        showAlert(`${data.username} joined the meeting`, 'success');
        updateRemoteVideoDisplay();
      }
    });

    socket.on('existing-users', (data) => {
      if (data.users && data.users.length > 0) {
        document.getElementById('remoteLabel').textContent = data.users[0];
        showAlert(`Connected with ${data.users[0]}`, 'success');
        updateRemoteVideoDisplay();
      }
    });

    socket.on('user-left', (data) => {
      if (data.username !== username) {
        document.getElementById('remoteLabel').textContent = 'Waiting for participant...';
        remoteVideo.srcObject = null;
        if (remoteVideoCheckInterval) { clearInterval(remoteVideoCheckInterval); remoteVideoCheckInterval = null; }
        showAlert(`${data.username} left the meeting`, 'info');
      }
    });

    // create and send offer
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit('signal', { ...offer, room });
    }).catch(e => console.error('Offer error', e));
  }

  /* -------------- Message display / UI helpers -------------- */
  function displayMessage(data, isLocal = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    if (data.username === username) {
      messageDiv.classList.add('sent');
      messageDiv.innerHTML = `<strong>You:</strong> ${data.message}`;
    } else {
      messageDiv.classList.add('received');
      messageDiv.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
    }
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  socket.on('chat-message', (data) => {
    displayMessage(data);
  });

  /* -------------- Modals, alerts, other small helpers -------------- */
  function generateMeetingId() {
    let digits = '';
    for (let i = 0; i < 9; i++) digits += Math.floor(Math.random() * 10).toString();
    return digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1-$2-$3');
  }

  function showMeetingCreatedModal(meetingId) {
    const modal = document.getElementById('meetingModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');

    title.textContent = 'Meeting Created Successfully';
    content.innerHTML = `
      <div class="meeting-info">
        <p>Your meeting is ready! Share the meeting ID with participants:</p>
        <div class="meeting-id" id="meetingIdDisplay">${meetingId}</div>
        <p class="copy-info">Click the meeting ID to copy it to clipboard</p>
        <div class="modal-actions">
          <button class="copy-btn" id="copyMeetingId">Copy ID</button>
          <button class="btn-primary" id="startMeeting">Start Meeting</button>
        </div>
      </div>
    `;

    // Add copy functionality
    document.getElementById('copyMeetingId').addEventListener('click', () => copyToClipboard(meetingId, 'copyMeetingId'));

    document.getElementById('meetingIdDisplay').addEventListener('click', () => copyToClipboard(meetingId));

    // Start meeting: fill join modal fields and trigger joinMeetingBtn
    document.getElementById('startMeeting').addEventListener('click', () => {
      const roomInput = document.querySelector('#joinModal #room');
      const usernameInput = document.querySelector('#joinModal #username');
      roomInput.value = meetingId;
      usernameInput.value = 'Host';
      // trigger the real join action
      joinMeetingBtn.click();
    });

    showModal();
  }

  function showModal() {
    const modal = document.getElementById('meetingModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    const modal = document.getElementById('meetingModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('meetingModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });

  async function copyToClipboard(text, buttonId = null) {
    try {
      await navigator.clipboard.writeText(text);
      if (buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
          const original = button.innerHTML;
          button.classList.add('copied');
          button.innerHTML = `Copied!`;
          setTimeout(() => { button.classList.remove('copied'); button.innerHTML = original; }, 1600);
        }
      }
      showAlert('Meeting ID copied to clipboard!', 'success');
    } catch (err) {
      showAlert('Failed to copy to clipboard', 'error');
    }
  }

  function showAlert(message, type = 'info') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.style.cssText = `position: fixed; top: 64px; right: 24px; background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--error-color)' : 'var(--primary-color)'}; color: var(--white); padding: 12px 18px; border-radius: 8px; z-index: 3000;`;
    alert.textContent = message;
    document.body.appendChild(alert);
    setTimeout(() => { alert.remove(); }, 3000);
  }

  /* --------------- Avatar / video helpers --------------- */
  function updateLocalVideoDisplay() {
    let localPlaceholder = document.getElementById('localPlaceholder');
    if (!localPlaceholder) {
      localPlaceholder = document.createElement('div');
      localPlaceholder.id = 'localPlaceholder';
      localPlaceholder.className = 'video-placeholder';
      const avatarCircle = document.createElement('div');
      avatarCircle.id = 'localAvatar';
      avatarCircle.className = 'avatar-circle';
      localPlaceholder.appendChild(avatarCircle);
      localVideo.parentNode.insertBefore(localPlaceholder, localVideo.nextSibling);
    }
    const localAvatar = document.getElementById('localAvatar');
    if (isCameraOff) {
      localVideo.style.display = 'none';
      localPlaceholder.style.display = 'flex';
      const usernameLabel = document.getElementById('localLabel').textContent.trim();
      localAvatar.textContent = usernameLabel ? usernameLabel.charAt(0).toUpperCase() : 'U';
    } else {
      localVideo.style.display = 'block';
      localPlaceholder.style.display = 'none';
    }
  }

  function updateRemoteVideoDisplay() {
    const remoteLabel = document.getElementById('remoteLabel').textContent.trim();
    const hasParticipant = remoteLabel && remoteLabel !== 'Waiting for participant...';
    let remotePlaceholder = document.getElementById('remotePlaceholder');
    if (!remotePlaceholder) {
      remotePlaceholder = document.createElement('div');
      remotePlaceholder.id = 'remotePlaceholder';
      remotePlaceholder.className = 'video-placeholder';
      const avatarCircle = document.createElement('div');
      avatarCircle.id = 'remoteAvatar';
      avatarCircle.className = 'avatar-circle';
      remotePlaceholder.appendChild(avatarCircle);
      remoteVideo.parentNode.insertBefore(remotePlaceholder, remoteVideo.nextSibling);
    }
    const remoteAvatar = document.getElementById('remoteAvatar');

    if (hasParticipant) {
      let shouldShowAvatar = true;
      try {
        if (remoteVideo.srcObject && remoteVideo.srcObject.getVideoTracks().length > 0) {
          const videoTracks = remoteVideo.srcObject.getVideoTracks();
          const enabledTracks = videoTracks.filter(track => track.enabled);
          const hasEnabledVideo = enabledTracks.length > 0;
          const videoHasContent = remoteVideo.videoWidth > 0 && remoteVideo.videoHeight > 0;
          shouldShowAvatar = !hasEnabledVideo || !videoHasContent;
        } else {
          shouldShowAvatar = true;
        }
      } catch (e) {
        console.warn('remote video check error', e);
      }

      if (shouldShowAvatar) {
        remoteVideo.style.display = 'none';
        remotePlaceholder.style.display = 'flex';
        remoteAvatar.textContent = remoteLabel.charAt(0).toUpperCase();
      } else {
        remoteVideo.style.display = 'block';
        remotePlaceholder.style.display = 'none';
      }
    } else {
      remoteVideo.style.display = 'none';
      if (remotePlaceholder) remotePlaceholder.style.display = 'none';
    }
  }

  // --- Sign-to-Text on remote video ---
  const stt = {
    active: false,
    processing: false,
    lastResponse: null,
    timers: {},
    sentenceServer: '',
    rafId: null,
    confThreshold: 0.25,
    showConfidence: true,
  };

  const sttEls = {
    status: document.getElementById('sttStatus'),
    countdown: document.getElementById('sttCountdown'),
    progress: document.getElementById('sttProgress'),
    sentence: document.getElementById('sttSentence'),
    startBtn: document.getElementById('sttStartBtn'),
    stopBtn: document.getElementById('sttStopBtn'),
    copyBtn: document.getElementById('sttCopyBtn'),
    clearBtn: document.getElementById('sttClearBtn'),
    overlay: document.getElementById('localOverlay') || document.getElementById('remoteOverlay'), // Use localOverlay for local detection
    showConfidence: document.getElementById('sttShowConfidence'),
    confThreshold: document.getElementById('sttConfThreshold'),
    confValue: document.getElementById('sttConfValue'),
    confState: document.getElementById('sttConfState'),
    lengthChip: document.getElementById('sttLengthChip'),
  };

  function resizeLocalOverlay() {
    if (!sttEls.overlay) return;
    const v = localVideo;
    if (!v || !v.videoWidth) return;
    sttEls.overlay.width = v.videoWidth;
    sttEls.overlay.height = v.videoHeight;
    // CSS sizes already 100% via style attr
  }

  function sttResetTimers() { stt.timers = {}; stt.lastResponse = null; }
  function sttUpdateTimers(countdowns) {
    stt.timers = {};
    if (countdowns) for (const k in countdowns) if (countdowns[k]) stt.timers[k] = { ...countdowns[k] };
  }
  function sttRenderTimer() {
    let text = '', progress = 0;
    const t = stt.timers;
    if (t.hold) { const cd = t.hold; text = `✋ Hold "${cd.label}" for ${cd.remaining.toFixed(1)}s`; progress = ((cd.duration - cd.remaining) / cd.duration) * 100; }
    else if (t.space) { const cd = t.space; text = `⌛ Adding space in ${cd.remaining.toFixed(1)}s`; progress = ((cd.duration - cd.remaining) / cd.duration) * 100; }
    else if (t.fullstop) { const cd = t.fullstop; text = `⌛ Adding full stop in ${cd.remaining.toFixed(1)}s`; progress = ((cd.duration - cd.remaining) / cd.duration) * 100; }
    else if (t.comma) { const cd = t.comma; text = `⌛ Adding comma in ${cd.remaining.toFixed(1)}s`; progress = ((cd.duration - cd.remaining) / cd.duration) * 100; }
    if (sttEls.countdown) sttEls.countdown.textContent = text;
    if (sttEls.progress) sttEls.progress.style.width = `${progress}%`;
  }

  async function sttSendFrame() {
    if (!localVideo || !localVideo.videoWidth || !stt.active) return { boxes: [], sentence: sttEls.sentence?.innerText || '', countdowns: {} };
    const off = document.createElement('canvas');
    off.width = localVideo.videoWidth; off.height = localVideo.videoHeight;
    off.getContext('2d').drawImage(localVideo, 0, 0, off.width, off.height);
    const dataUrl = off.toDataURL('image/jpeg', 0.7);
    try {
      const res = await fetch('/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl }) });
      return await res.json();
    } catch (e) { console.error(e); return { boxes: [], sentence: sttEls.sentence?.innerText || '', countdowns: {} }; }
  }

  function sttDrawBox(ctx, box) {
    const x = box.x1, y = box.y1, w = box.x2 - box.x1, h = box.y2 - box.y1;
    ctx.lineWidth = 2; ctx.strokeStyle = 'lime'; ctx.strokeRect(x, y, w, h);
    const label = stt.showConfidence ? `${box.class} ${(box.conf * 100).toFixed(1)}%` : `${box.class}`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const textWidth = ctx.measureText(label).width + 10;
    ctx.fillRect(x, y - 22, textWidth, 22);
    ctx.fillStyle = 'white'; ctx.fillText(label, x + 5, y - 6);
  }

  function sttLoop() {
    if (!stt.active) return;
    const overlay = sttEls.overlay;
    if (overlay && localVideo && localVideo.videoWidth) {
      resizeLocalOverlay();
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.font = '16px Arial';
      if (stt.lastResponse && stt.lastResponse.boxes) {
        const filtered = stt.lastResponse.boxes.filter(b => (typeof b.conf === 'number' ? b.conf : 0) >= stt.confThreshold);
        for (const b of filtered) sttDrawBox(ctx, b);
        if (sttEls.status) sttEls.status.textContent = `Status: ${filtered.length} detected`;
      }
    }
    sttRenderTimer();
    if (!stt.processing) {
      stt.processing = true;
      sttSendFrame().then(json => {
        stt.lastResponse = json; stt.processing = false;
        if (json.sentence && sttEls.sentence) {
          const newText = json.sentence;
          const isCountdown = stt.sentenceServer.includes('Detection will start') || stt.sentenceServer.includes('Detection started') || stt.sentenceServer.trim() === '';
          if (isCountdown || !newText.startsWith(stt.sentenceServer)) {
            sttEls.sentence.innerText = newText;
          } else {
            const toAppend = newText.slice(stt.sentenceServer.length);
            if (toAppend) sttEls.sentence.innerText += toAppend;
          }
          stt.sentenceServer = sttEls.sentence.innerText;
          const len = stt.sentenceServer.length;
          if (sttEls.lengthChip) sttEls.lengthChip.textContent = `${len} chars`;
          if (sttEls.sentence) {
            if (len === 0) sttEls.sentence.classList.add('empty'); else sttEls.sentence.classList.remove('empty');
          }
        }
        sttUpdateTimers(json.countdowns);
      }).catch(() => { stt.processing = false; });
    }
    stt.rafId = requestAnimationFrame(sttLoop);
  }

  function sttBindUI() {
    if (!sttEls.startBtn) return; // not on this page

    // initialize confidence controls
    if (sttEls.confThreshold) {
      const val = parseFloat(sttEls.confThreshold.value || '0.25');
      stt.confThreshold = isNaN(val) ? 0.25 : val;
      if (sttEls.confValue) sttEls.confValue.textContent = stt.confThreshold.toFixed(2);
      sttEls.confThreshold.addEventListener('input', () => {
        const v = parseFloat(sttEls.confThreshold.value || '0');
        stt.confThreshold = Math.max(0, Math.min(1, isNaN(v) ? 0 : v));
        if (sttEls.confValue) sttEls.confValue.textContent = stt.confThreshold.toFixed(2);
        // force a redraw with new threshold
        if (stt.active && sttEls.overlay) {
          const ctx = sttEls.overlay.getContext('2d');
          ctx && ctx.clearRect(0,0,sttEls.overlay.width, sttEls.overlay.height);
        }
      });
    }
    if (sttEls.showConfidence) {
      stt.showConfidence = !!sttEls.showConfidence.checked;
      if (sttEls.confState) sttEls.confState.textContent = stt.showConfidence ? 'On' : 'Off';
      sttEls.showConfidence.addEventListener('change', () => {
        stt.showConfidence = !!sttEls.showConfidence.checked;
        if (sttEls.confState) sttEls.confState.textContent = stt.showConfidence ? 'On' : 'Off';
      });
    }

    sttEls.startBtn.addEventListener('click', async () => {
      sttResetTimers();
      if (sttEls.countdown) sttEls.countdown.textContent = 'Detection will start in 2 seconds...';
      if (sttEls.progress) sttEls.progress.style.width = '0%';
      setTimeout(async () => {
        stt.active = true;
        if (sttEls.sentence) sttEls.sentence.setAttribute('contenteditable', 'false');
        if (sttEls.countdown) sttEls.countdown.textContent = 'Detection started...';
        stt.sentenceServer = sttEls.sentence ? sttEls.sentence.innerText : '';
        try { await fetch('/resume_detection', { method: 'POST' }); } catch {}
        try { await fetch('/set_sentence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sentence: stt.sentenceServer, pause: false }) }); } catch {}
        cancelAnimationFrame(stt.rafId);
        sttLoop();
      }, 2000);
    });

    sttEls.stopBtn.addEventListener('click', async () => {
      stt.active = false;
      if (sttEls.sentence) sttEls.sentence.setAttribute('contenteditable', 'true');
      const detectedText = (sttEls.sentence?.innerText || '').trim();
      if (detectedText) {
        if (sttEls.countdown) sttEls.countdown.textContent = 'Processing detected sentence...';
        if (sttEls.progress) sttEls.progress.style.width = '0%';
        try {
          const grammarResponse = await fetch('/sentence_correction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: detectedText }) });
          const grammarData = await grammarResponse.json();
          if (!grammarData.error) {
            let finalText = grammarData.corrected;
            // optional style pass can be added here if needed
            if (sttEls.sentence) sttEls.sentence.innerText = finalText;
            if (sttEls.countdown) sttEls.countdown.textContent = 'Sentence processed and corrected successfully!';
          } else if (sttEls.countdown) {
            sttEls.countdown.textContent = 'Error in grammar correction: ' + grammarData.error;
          }
        } catch (e) {
          if (sttEls.countdown) sttEls.countdown.textContent = 'Error processing sentence.';
        }
      } else {
        if (sttEls.countdown) sttEls.countdown.textContent = 'Detection stopped. No sentence detected.';
      }
      if (sttEls.progress) sttEls.progress.style.width = '0%';
      stt.sentenceServer = sttEls.sentence ? sttEls.sentence.innerText : '';
      
      // Show send button if in send mode and there's text
      const sttSendBtn = document.getElementById('sttSendBtn');
      if (sttSendBtn && stt.sentenceServer.trim() && window.currentSignTextMode === 'send') {
        sttSendBtn.style.display = 'inline-flex';
        console.log('Send button shown after stopping detection');
      }
      
      sttResetTimers();
      try { await fetch('/set_sentence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sentence: stt.sentenceServer, pause: true }) }); } catch {}
      cancelAnimationFrame(stt.rafId);
    });

    sttEls.copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(sttEls.sentence?.innerText || ''); showAlert('Copied!', 'success'); } catch {}
    });
    sttEls.clearBtn.addEventListener('click', async () => {
      try { await fetch('/reset', { method: 'POST' }); } catch {}
      if (sttEls.sentence) sttEls.sentence.innerText = '';
      if (sttEls.countdown) sttEls.countdown.textContent = '';
      if (sttEls.progress) sttEls.progress.style.width = '0%';
      sttResetTimers();
      stt.sentenceServer = '';
    });

    // Keep overlay in sync with video size
    localVideo.addEventListener('loadedmetadata', resizeLocalOverlay);
    window.addEventListener('resize', resizeLocalOverlay);

    // Style enhancer menu for Sign-Text (mirror chat)
    const sttStyleBtn = document.getElementById('sttStyleBtn');
    const sttStyleDropdown = document.getElementById('sttStyleDropdown');
    if (sttStyleBtn && sttStyleDropdown) {
      sttStyleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = sttStyleDropdown.style.display === 'block';
        sttStyleDropdown.style.display = isVisible ? 'none' : 'block';
      });
      document.addEventListener('click', (e) => {
        if (!sttStyleBtn.contains(e.target) && !sttStyleDropdown.contains(e.target)) {
          sttStyleDropdown.style.display = 'none';
        }
      });

      sttStyleDropdown.querySelectorAll('.style-option').forEach(option => {
        option.addEventListener('click', async () => {
          const style = option.getAttribute('data-style');
          const text = (sttEls.sentence?.innerText || '').trim();
          if (!text) { sttStyleDropdown.style.display = 'none'; return; }
          try {
            const response = await fetch('/style_enhancement', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, style })
            });
            const data = await response.json();
            if (data.enhanced && sttEls.sentence) {
              sttEls.sentence.innerText = data.enhanced;
              stt.sentenceServer = data.enhanced;
              const len = stt.sentenceServer.length;
              if (sttEls.lengthChip) sttEls.lengthChip.textContent = `${len} chars`;
            }
          } catch (err) { /* ignore */ }
          sttStyleDropdown.style.display = 'none';
        });
      });
    }
  }

  sttBindUI();

  // --- New Sign-Text Mode Selection Functionality ---
  window.initSignTextModeSelection = function() {
    const signTextModeSelection = document.getElementById('signTextModeSelection');
    const signTextSendMode = document.getElementById('signTextSendMode');
    const signTextReceiveMode = document.getElementById('signTextReceiveMode');
    const sendModeBtn = document.getElementById('sendModeBtn');
    const receiveModeBtn = document.getElementById('receiveModeBtn');
    const backFromSend = document.getElementById('backFromSend');
    const backFromReceive = document.getElementById('backFromReceive');
    // Use the main local video for detection instead of separate video
    const localDetectionVideo = localVideo; // Use main local video
    // No separate overlay needed - detection visualization will be on main video
    const sttSendBtn = document.getElementById('sttSendBtn');
    const receiveStatus = document.getElementById('receiveStatus');
    const receiveLoading = document.getElementById('receiveLoading');
    const receivedSentenceContainer = document.getElementById('receivedSentenceContainer');
    const receivedSentenceBox = document.getElementById('receivedSentenceBox');
    const copyReceivedBtn = document.getElementById('copyReceivedBtn');

    let currentMode = null;
    let localDetectionStream = null;
    window.currentSignTextMode = null; // Global variable to track mode

    // Mode selection handlers
    sendModeBtn?.addEventListener('click', () => {
      currentMode = 'send';
      showSendMode();
    });

    receiveModeBtn?.addEventListener('click', () => {
      currentMode = 'receive';
      showReceiveMode();
    });

    backFromSend?.addEventListener('click', () => {
      showModeSelection();
      stopLocalDetection();
    });

    backFromReceive?.addEventListener('click', () => {
      showModeSelection();
    });

    function showModeSelection() {
      if (signTextModeSelection) signTextModeSelection.style.display = 'block';
      if (signTextSendMode) signTextSendMode.style.display = 'none';
      if (signTextReceiveMode) signTextReceiveMode.style.display = 'none';
      currentMode = null;
      window.currentSignTextMode = null;
    }

    async function showSendMode() {
      if (signTextModeSelection) signTextModeSelection.style.display = 'none';
      if (signTextSendMode) signTextSendMode.style.display = 'block';
      if (signTextReceiveMode) signTextReceiveMode.style.display = 'none';
      
      currentMode = 'send';
      window.currentSignTextMode = 'send';
      
      // Start local camera for detection
      await startLocalDetection();
      
      // Modify existing STT functionality to use local camera
      modifySTTForLocalCamera();
    }

    function showReceiveMode() {
      if (signTextModeSelection) signTextModeSelection.style.display = 'none';
      if (signTextSendMode) signTextSendMode.style.display = 'none';
      if (signTextReceiveMode) signTextReceiveMode.style.display = 'block';
      
      currentMode = 'receive';
      window.currentSignTextMode = 'receive';
      
      // Reset receive mode UI
      if (receiveStatus) receiveStatus.style.display = 'block';
      if (receiveLoading) receiveLoading.style.display = 'none';
      if (receivedSentenceContainer) receivedSentenceContainer.style.display = 'none';
    }

    async function startLocalDetection() {
      // No need to start separate stream, we'll use the existing localStream
      // The main local video is already running from the meeting setup
      console.log('Using main local video feed for sign detection');
      if (!localStream) {
        showAlert('Please ensure your camera is enabled for sign detection', 'warning');
      }
    }

    function stopLocalDetection() {
      // No need to stop the main local stream, just log
      console.log('Stopped using main local video feed for detection');
      // No separate overlay to clear - using main video feed
    }

    function modifySTTForLocalCamera() {
      // Override the sttSendFrame function to use local camera
      window.sttSendFrameLocal = async function() {
        if (!localVideo || !localVideo.videoWidth || !stt.active) {
          return { boxes: [], sentence: sttEls.sentence?.innerText || '', countdowns: {} };
        }
        const off = document.createElement('canvas');
        off.width = localVideo.videoWidth;
        off.height = localVideo.videoHeight;
        off.getContext('2d').drawImage(localVideo, 0, 0, off.width, off.height);
        const dataUrl = off.toDataURL('image/jpeg', 0.7);
        try {
          const res = await fetch('/detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUrl })
          });
          return await res.json();
        } catch (e) {
          console.error(e);
          return { boxes: [], sentence: sttEls.sentence?.innerText || '', countdowns: {} };
        }
      };

      // Override the sttLoop function to use main local video (no separate overlay needed)
      window.sttLoopLocal = function() {
        if (!stt.active) return;
        
        // Use the existing sttLoop logic but with local video detection
        sttRenderTimer();
        if (!stt.processing) {
          stt.processing = true;
          window.sttSendFrameLocal().then(json => {
            stt.lastResponse = json;
            stt.processing = false;
            if (json.sentence && sttEls.sentence) {
              const newText = json.sentence;
              const isCountdown = stt.sentenceServer.includes('Detection will start') || stt.sentenceServer.includes('Detection started') || stt.sentenceServer.trim() === '';
              if (isCountdown || !newText.startsWith(stt.sentenceServer)) {
                sttEls.sentence.innerText = newText;
              } else {
                const toAppend = newText.slice(stt.sentenceServer.length);
                if (toAppend) sttEls.sentence.innerText += toAppend;
              }
              stt.sentenceServer = sttEls.sentence.innerText;
              const len = stt.sentenceServer.length;
              if (sttEls.lengthChip) sttEls.lengthChip.textContent = `${len} chars`;
              if (sttEls.sentence) {
                if (len === 0) sttEls.sentence.classList.add('empty');
                else sttEls.sentence.classList.remove('empty');
              }
              
              // Show send button when there's text to send
              if (sttSendBtn && stt.sentenceServer.trim()) {
                sttSendBtn.style.display = 'inline-flex';
                console.log('Send button shown for text:', stt.sentenceServer);
              } else if (sttSendBtn) {
                sttSendBtn.style.display = 'none';
              }
            }
            sttUpdateTimers(json.countdowns);
          }).catch(() => {
            stt.processing = false;
          });
        }
        stt.rafId = requestAnimationFrame(window.sttLoopLocal);
      };
    }

    // Send button functionality
    sttSendBtn?.addEventListener('click', () => {
      const detectedText = sttEls.sentence?.innerText.trim();
      if (detectedText && room) {
        // Send notification and detected text to remote user
        socket.emit('sign-text-notification', {
          room: room,
          type: 'text_detected',
          text: detectedText,
          sender: username
        });
        
        // Hide send button temporarily and show confirmation
        sttSendBtn.style.display = 'none';
        showAlert('Text sent to remote user!', 'success');
        
        // Re-show send button after 2 seconds in case user wants to send again
        setTimeout(() => {
          if (sttSendBtn && stt.sentenceServer.trim()) {
            sttSendBtn.style.display = 'inline-flex';
          }
        }, 2000);
      }
    });

    // Copy received text functionality
    copyReceivedBtn?.addEventListener('click', async () => {
      const text = receivedSentenceBox?.textContent?.trim();
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          showAlert('Text copied to clipboard!', 'success');
        } catch (err) {
          console.error('Failed to copy text:', err);
        }
      }
    });

    // Simplified Speak functionality
    const speakBtn = document.getElementById('speakBtn');
    
    let speechSynthesis = window.speechSynthesis;
    let currentUtterance = null;
    
    // Speak button handler
    speakBtn?.addEventListener('click', () => {
      const text = receivedSentenceBox?.textContent?.trim();
      if (!text) {
        showAlert('No text to speak', 'warning');
        return;
      }
      
      // If already speaking, stop current speech
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        speakBtn.classList.remove('speaking');
        speakBtn.querySelector('span').textContent = 'Speak';
        currentUtterance = null;
        return;
      }
      
      // Create and configure speech utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Visual feedback
      speakBtn.classList.add('speaking');
      speakBtn.querySelector('span').textContent = 'Speaking...';
      
      // Event handlers
      utterance.onstart = () => {
        currentUtterance = utterance;
      };
      
      utterance.onend = () => {
        speakBtn.classList.remove('speaking');
        speakBtn.querySelector('span').textContent = 'Speak';
        currentUtterance = null;
      };
      
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        speakBtn.classList.remove('speaking');
        speakBtn.querySelector('span').textContent = 'Speak';
        showAlert('Error speaking text', 'error');
        currentUtterance = null;
      };
      
      speechSynthesis.speak(utterance);
    });

    // Socket event handlers for sign-text notifications
    socket.on('sign-text-notification', (data) => {
      if (data.type === 'detection_started') {
        // Show notification that remote user started detection
        showAlert(`${data.sender} is using sign-text feature`, 'info');
        
        if (currentMode === 'receive') {
          // Update receive mode UI
          if (receiveStatus) receiveStatus.style.display = 'none';
          if (receiveLoading) receiveLoading.style.display = 'block';
        }
      } else if (data.type === 'text_detected') {
        // Display the detected text
        if (currentMode === 'receive') {
          if (receiveLoading) receiveLoading.style.display = 'none';
          if (receivedSentenceContainer) receivedSentenceContainer.style.display = 'block';
          if (receivedSentenceBox) receivedSentenceBox.textContent = data.text;
        } else {
          // Show as regular notification if not in receive mode
          showAlert(`Message from ${data.sender}: ${data.text}`, 'info');
        }
      }
    });

    // Override STT start button to send notification
    const originalStartHandler = sttEls.startBtn?.onclick;
    if (sttEls.startBtn) {
      sttEls.startBtn.addEventListener('click', () => {
        if (currentMode === 'send' && room) {
          // Send notification that detection started
          socket.emit('sign-text-notification', {
            room: room,
            type: 'detection_started',
            sender: username
          });
          
          // Use local detection loop instead of regular one
          setTimeout(() => {
            if (window.sttLoopLocal) {
              cancelAnimationFrame(stt.rafId);
              window.sttLoopLocal();
            }
          }, 2000);
        }
      });
    }

    // Initialize mode selection view
    showModeSelection();
  };

  // Initialize the sign-text mode functionality immediately
  // The UI will be shown/hidden based on the slider option selected
  if (typeof window.initSignTextModeSelection === 'function') {
    setTimeout(() => {
      window.initSignTextModeSelection();
    }, 500); // Wait a bit for DOM to be fully ready
  }

// --- Text-Sign Mode Functionality ---
let textSignImages = []; // Array to hold image data for text-sign
let recognition = null; // Speech recognition instance
let isListening = false; // Flag for speech recognition state

// Initialize text-sign functionality
function initTextSign() {
  const textSignInput = document.getElementById('textSignInput');
  const textSignSendBtn = document.getElementById('textSignSendBtn');
  const textSignMicBtn = document.getElementById('textSignMicBtn');
  const textSignForm = document.getElementById('textSignForm');
  const textSignImageDisplay = document.getElementById('textSignImageDisplay');
  const textSignClearBtn = document.getElementById('textSignClearBtn');
  const sharedText = document.getElementById('sharedText');
  const sharedTextBar = document.getElementById('sharedTextBar');
  const clearSharedTextBtn = document.getElementById('clearSharedTextBtn');



  // Send text input
  textSignSendBtn.addEventListener('click', () => {
    const text = textSignInput.value.trim();
    if (text) {
      processText(text);
    }
  });

  // Form submission
  textSignForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = textSignInput.value.trim();
    if (text) {
      processText(text);
    }
  });

  // Speech recognition
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      textSignMicBtn.style.background = '#ff6b6b';
      textSignMicBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>`;
    };

    recognition.onend = () => {
      isListening = false;
      textSignMicBtn.style.background = '#f1f1f5';
      textSignMicBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>`;
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        textSignInput.value += finalTranscript + ' ';
        processText(textSignInput.value.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      alert('Speech recognition error: ' + event.error);
    };

    textSignMicBtn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    });
  } else {
    textSignMicBtn.style.display = 'none';
  }

  // Clear all images
  textSignClearBtn.addEventListener('click', () => {
    textSignImages = [];
    renderImages();
    if (sharedText) sharedText.textContent = '';
  });

  // Clear shared text
  clearSharedTextBtn.addEventListener('click', () => {
    if (sharedText) sharedText.textContent = '';
    if (sharedTextBar) sharedTextBar.style.display = 'none';
  });

  // Auto-resize textarea
  textSignInput.addEventListener('input', () => {
    textSignInput.style.height = 'auto';
    textSignInput.style.height = textSignInput.scrollHeight + 'px';
  });

  // Image click to enlarge - handled in renderImages on each wrapper
}

// Process text input and generate sign images
async function processText(text) {
  // Show spinner
  if (textSignSpinner) textSignSpinner.style.display = 'block';

  try {
    const response = await fetch('/get_images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input: text })
    });
    const data = await response.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    textSignImages = data.images;
    renderImages();

    // Show text in shared-text-bar
    const sharedText = document.getElementById('sharedText');
    const sharedTextBar = document.getElementById('sharedTextBar');
    if (text) {
      sharedText.textContent = text;
      sharedTextBar.style.display = 'flex';
    }

    // Send to other users via socket
    if (socket && room) {
      socket.emit('text-sign-message', {
        room: room,
        text: text,
        images: data.images
      });
    }
  } catch (error) {
    console.error('Error fetching images:', error);
    alert('Error fetching images. Please try again.');
  } finally {
    // Hide spinner
    if (textSignSpinner) textSignSpinner.style.display = 'none';
  }
}

// Render images in the display area (replace existing function)
function renderImages() {
  const textSignImageDisplay = document.getElementById('textSignImageDisplay');
  const textSignClearBtn = document.getElementById('textSignClearBtn');
  const sharedTextBar = document.getElementById('sharedTextBar');

  if (!textSignImageDisplay) return;

  if (!textSignImages || textSignImages.length === 0) {
    textSignImageDisplay.classList.add('empty');
    textSignImageDisplay.innerHTML = `
      <div class="empty-state" aria-hidden="false">
        <div class="icon">🤟</div>
        <h3>No images yet</h3>
        <p>Enter some text or use the mic below to see signs</p>
      </div>
    `;
    if (textSignClearBtn) {
      textSignClearBtn.style.display = 'none';
      textSignClearBtn.setAttribute('aria-hidden', 'true');
    }
    if (sharedTextBar) {
      sharedTextBar.style.display = 'none';
      sharedTextBar.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  textSignImageDisplay.classList.remove('empty');
  textSignImageDisplay.innerHTML = ''; // Clear existing content

  textSignImages.forEach(item => {
    const wrapper = document.createElement('div');
    wrapper.className = 'character-wrapper';
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('tabindex', '0');

    const inner = document.createElement('div');
    inner.className = 'character-inner';

    const front = document.createElement('div');
    front.className = 'character-front';

    const back = document.createElement('div');
    back.className = 'character-back';

    if (item.special) {
      front.classList.add('space-front');
      back.textContent = item.special;
      wrapper.setAttribute('aria-label', `special: ${item.special}`);
    } else if (item.img) {
      const char = item.img.split('/').pop().replace('.jpeg', '').toUpperCase();
      const img = document.createElement('img');
      img.src = item.img;
      img.alt = `Sign for ${char}`;
      img.loading = 'lazy';
      front.appendChild(img);
      back.textContent = char;
      wrapper.setAttribute('aria-label', `sign for ${char}`);

      // Add click listener to wrapper
      wrapper.addEventListener('click', () => {
        if (img && img.src) {
          showEnlargedImage(img.src, img.alt);
        }
      });
    }

    inner.appendChild(front);
    inner.appendChild(back);
    wrapper.appendChild(inner);
    textSignImageDisplay.appendChild(wrapper);
  });

  // show clear button & shared text bar
  if (textSignClearBtn) {
    textSignClearBtn.style.display = 'inline-flex';
    textSignClearBtn.setAttribute('aria-hidden', 'false');
  }
  if (sharedTextBar) {
    sharedTextBar.style.display = 'flex';
    sharedTextBar.setAttribute('aria-hidden', 'false');
  }
}

// Robust showEnlargedImage — append to document.body and ensure fixed full-screen overlay
function showEnlargedImage(src, alt = '') {
  // Zoom and pan variables
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let startX, startY;
  let initialDistance = 0;
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'ts-enlarge-overlay'; // just a class for debugging if needed
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  overlay.innerHTML = `
    <div class="ts-enlarge-inner">
      <button class="ts-close" aria-label="Close image">&times;</button>
      <div class="ts-img-wrap"><img class="ts-modal-img" src="${src}" alt="${alt}"></div>
      <div class="ts-zoom-controls" aria-hidden="false">
        <button class="ts-zoom-in" title="Zoom in">+</button>
        <button class="ts-zoom-out" title="Zoom out">−</button>
      </div>
    </div>
  `;

  // Append to body so the overlay is full viewport and not clipped by parent
  document.body.appendChild(overlay);

  // Inline minimal styles to guarantee overlay covers viewport (won't change theme)
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.88)',
    zIndex: '10000',
    padding: '20px',
    boxSizing: 'border-box',
  });

  const inner = overlay.querySelector('.ts-enlarge-inner');
  Object.assign(inner.style, {
    position: 'relative',
    width: '100%',
    maxWidth: '1100px',
    height: '100%',
    maxHeight: '92vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const imgWrap = overlay.querySelector('.ts-img-wrap');
  Object.assign(imgWrap.style, {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  });

  const img = overlay.querySelector('.ts-modal-img');
  Object.assign(img.style, {
    maxWidth: '90%',
    maxHeight: '90%',
    objectFit: 'contain',
    transformOrigin: 'center center',
    transition: 'transform 0.12s linear',
    cursor: 'grab',
    userSelect: 'none',
  });

  const closeBtn = overlay.querySelector('.ts-close');
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '14px',
    right: '18px',
    zIndex: '10110',
    width: '44px',
    height: '44px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: '28px',
    cursor: 'pointer'
  });

  // --- after creating zoom controls in your showEnlargedImage function ---
  const zoomInBtn = overlay.querySelector('.ts-zoom-in');
  const zoomOutBtn = overlay.querySelector('.ts-zoom-out');
  const zControls = overlay.querySelector('.ts-zoom-controls');

  // ensure overlay accepts pointer events and is on top
  overlay.style.pointerEvents = 'auto';
  overlay.style.zIndex = overlay.style.zIndex || '10000';

  // button styling (kept minimal so existing CSS still applies)
  [zoomInBtn, zoomOutBtn].forEach(b => {
    if (b) {
      b.style.minWidth = '44px';
      b.style.minHeight = '44px';
      b.style.border = 'none';
      b.style.cursor = 'pointer';
      b.disabled = false;
      b.tabIndex = 0;
      // small debug attr to inspect from devtools
      b.setAttribute('data-ts-zoom', b.className);
    }
  });

  // Zoom functions
  function zoomBy(delta) {
    scale += delta;
    scale = Math.max(0.1, Math.min(5, scale)); // limit scale
    applyTransform();
  }

  function applyTransform() {
    img.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  }

  // Zoom with mouse wheel
  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomBy(delta);
  }
  img.addEventListener('wheel', onWheel);

  // Pan with mouse
  function onMouseDown(e) {
    if (e.button !== 0) return; // left click only
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    img.style.cursor = 'grabbing';
  }
  img.addEventListener('mousedown', onMouseDown);

  function onMouseMove(e) {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    applyTransform();
  }
  window.addEventListener('mousemove', onMouseMove);

  function onMouseUp() {
    isDragging = false;
    img.style.cursor = 'grab';
  }
  window.addEventListener('mouseup', onMouseUp);

  // Touch events for mobile
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      initialDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
    }
  }
  img.addEventListener('touchstart', onTouchStart);

  function onTouchMove(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const delta = (distance - initialDistance) * 0.01;
      zoomBy(delta);
      initialDistance = distance;
    }
  }
  img.addEventListener('touchmove', onTouchMove);

  function onTouchEnd() {
    // reset
  }
  img.addEventListener('touchend', onTouchEnd);

  // Use event delegation on the overlay to guarantee clicks reach us
  function overlayClickHandler(e) {
    // prefer closest so clicks inside the button svg still count
    const inZoomIn = !!e.target.closest('.ts-zoom-in');
    const inZoomOut = !!e.target.closest('.ts-zoom-out');

    if (inZoomIn) {
      e.stopPropagation();
      e.preventDefault();
      zoomBy(0.25);
      console.log('Zoom In clicked');
      return;
    }
    if (inZoomOut) {
      e.stopPropagation();
      e.preventDefault();
      zoomBy(-0.25);
      console.log('Zoom Out clicked');
      return;
    }
  }

  overlay.addEventListener('click', overlayClickHandler, { passive: false });

  // also add keyboard access (Enter / Space) for accessibility
  zoomInBtn && zoomInBtn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); zoomBy(0.25); }});
  zoomOutBtn && zoomOutBtn.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); zoomBy(-0.25); }});

  // On cleanup, remove the delegation listener (replace your old cleanup's zoom removal lines)
  function cleanup() {
    overlay.removeEventListener('wheel', onWheel);
    img.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    overlay.removeEventListener('touchstart', onTouchStart);
    overlay.removeEventListener('touchmove', onTouchMove);
    overlay.removeEventListener('touchend', onTouchEnd);
    // remove our delegated overlay click listener
    overlay.removeEventListener('click', overlayClickHandler);
    // remove keyboard handlers (if present)
    zoomInBtn && zoomInBtn.removeEventListener('keydown', (ev) => {});
    zoomOutBtn && zoomOutBtn.removeEventListener('keydown', (ev) => {});
    document.body.style.overflow = prevOverflow;
    overlay.remove();
  }

  overlay.querySelector('.ts-close').addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

  // initial transform
  img.style.transition = 'transform 0.12s linear';
  applyTransform();
}

// Handle incoming text-sign messages
function handleTextSignMessage(data) {
  if (data.text) {
    const sharedText = document.getElementById('sharedText');
    const sharedTextBar = document.getElementById('sharedTextBar');
    sharedText.textContent = data.text;
    sharedTextBar.style.display = 'flex';
  }
  if (data.images) {
    textSignImages = data.images;
    renderImages();
  }
}

// Initialize text-sign functionality
initTextSign();

// Socket event for text-sign messages
socket.on('text-sign-message', handleTextSignMessage);

// end DOMContentLoaded
});

// Main page functionality
function goToChat() {
    window.location.href = '/chat';
}
