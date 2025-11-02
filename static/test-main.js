// Sign Language Test Application - Standalone Version
class SignLanguageTest {
  constructor() {
    this.targetWord = '';
    this.letterBoxes = [];
    this.capturedImages = [];
    this.isCapturing = false;
    this.isCameraActive = false;
    this.currentCapture = 0;
    this.isSubmitting = false;
    this.validationResults = [];
    this.currentWordIndex = 0;
    this.currentLetterIndex = 0; // For multi-letter words
    this.stream = null;
    this.captureInterval = null;
    this.detectionActive = false;
    this.detectionInterval = null;
    this.holdProgress = 0;
    this.holdDuration = 2000; // 2 seconds
    this.pauseDuration = 1000; // 1 second pause between words
    this.processing = false;
    this.isPaused = false; // Pause state
    this.confidenceThreshold = 0.3; // Default confidence threshold
    this.testSessionId = 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Practice words array
    this.practiceWords = ['A', 'K', '5', 'GO', 'CAT'];
    
    this.init();
  }

  init() {
    this.render();
    this.fetchTargetWord();
    this.checkBrowserSupport();
    
    // Pre-initialize camera status UI
    this.updateCameraUI();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  cleanup() {
    this.stopDetection();
    this.stopCamera();
  }
  
  checkBrowserSupport() {
    // Check if we're in a secure context
    const isSecure = window.isSecureContext || location.protocol === 'https:' || 
                     location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      this.showWarning('⚠️ Camera access requires HTTPS. Some features may not work properly.');
    }
    
    // Check for basic browser support
    if (!navigator.mediaDevices) {
      this.showWarning('⚠️ Your browser may not fully support camera access. Please use a modern browser.');
    }
    
    // Show initial guidance
    this.showInitialGuidance();
  }
  
  showWarning(message) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/90 text-yellow-900 px-4 py-2 rounded-lg shadow-lg z-50';
    warningDiv.textContent = message;
    document.body.appendChild(warningDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (warningDiv.parentNode) {
        warningDiv.parentNode.removeChild(warningDiv);
      }
    }, 5000);
  }
  
  showInitialGuidance() {
    // Only show if no warnings were shown
    setTimeout(() => {
      const guidanceDiv = document.createElement('div');
      guidanceDiv.className = 'fixed bottom-4 right-4 bg-green-500/90 text-white px-4 py-2 rounded-lg shadow-lg z-40 max-w-sm';
      guidanceDiv.innerHTML = '💡 Tip: Click "Start Detection" to begin using your camera for sign recognition';
      document.body.appendChild(guidanceDiv);
      
      // Auto-remove after 8 seconds
      setTimeout(() => {
        if (guidanceDiv.parentNode) {
          guidanceDiv.parentNode.removeChild(guidanceDiv);
        }
      }, 8000);
    }, 2000);
  }
  
  showErrorDialog(message) {
    // Remove any existing error dialogs
    const existingDialog = document.getElementById('error-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }
    
    // Create error dialog
    const errorDialog = document.createElement('div');
    errorDialog.id = 'error-dialog';
    errorDialog.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50';
    errorDialog.innerHTML = `
      <div class="bg-slate-800 border border-red-400/50 rounded-2xl p-6 max-w-md mx-4 text-center">
        <div class="text-4xl mb-4">📷❌</div>
        <h3 class="text-xl font-bold text-red-400 mb-4">Camera Access Error</h3>
        <p class="text-green-200 mb-6 text-left whitespace-pre-line">${message}</p>
        <div class="flex gap-3 justify-center">
          <button id="close-error-btn" class="px-4 py-2 bg-green-400 hover:bg-green-500 text-slate-900 rounded-lg font-semibold transition-all">
            Got it
          </button>
          <button id="retry-camera-btn" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all">
            Try Again
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(errorDialog);
    
    // Add event listeners
    document.getElementById('close-error-btn').addEventListener('click', () => {
      errorDialog.remove();
    });
    
    document.getElementById('retry-camera-btn').addEventListener('click', () => {
      errorDialog.remove();
      this.startDetection();
    });
    
    // Close on ESC key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        errorDialog.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  render() {
    const app = document.getElementById('root');
    app.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-green-200 relative overflow-hidden">
        <!-- Background gradient orbs -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="absolute top-20 left-10 w-96 h-96 bg-green-400/5 rounded-full blur-3xl"></div>
          <div class="absolute bottom-20 right-10 w-80 h-80 bg-green-400/3 rounded-full blur-3xl"></div>
        </div>
        
        <div class="relative z-10 container mx-auto px-4 py-8">
          <div class="max-w-4xl mx-auto">
            <!-- Header -->
            <header class="text-center mb-12 opacity-0 animate-fade-in">
              <div class="flex items-center justify-center gap-3 mb-4">
                <div class="p-3 bg-green-400/20 rounded-xl border border-green-400/30 shadow-lg shadow-green-400/10">
                  <svg class="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                </div>
                <h1 class="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-400 to-green-300 bg-clip-text text-transparent">
                  Sign Language Test
                </h1>
              </div>
              <p class="text-green-200/80 text-lg">
                Practice your sign language skills with automatic capture
              </p>
              <p class="text-green-200/60 text-sm mt-2">
                Hold each sign steady for 2 seconds - images will be captured and saved automatically!
              </p>
            </header>

            <!-- Target Word Display -->
            <div id="target-word-section" class="bg-slate-800/50 backdrop-blur-sm border border-green-400/30 rounded-2xl p-8 mb-8 shadow-xl shadow-green-400/5 opacity-0 animate-fade-in" style="animation-delay: 0.2s;">
              <div class="text-center mb-6">
                <h2 class="text-green-400 text-2xl font-semibold mb-2">Target Word</h2>
                <div class="flex items-center justify-center gap-2 text-green-200/60">
                  <span id="word-counter">Word 1 of 5</span>
                  <span>•</span>
                  <span id="current-word">HELLO</span>
                </div>
              </div>
              
              <div id="letter-boxes" class="flex justify-center items-end gap-4 flex-wrap">
                <!-- Letter boxes will be rendered here -->
              </div>
            </div>

            <!-- Camera Section -->
            <div class="bg-slate-800/50 backdrop-blur-sm border border-green-400/30 rounded-2xl p-6 mb-8 shadow-xl shadow-green-400/5 opacity-0 animate-fade-in" style="animation-delay: 0.5s;">
              <h3 class="text-green-400 text-xl font-semibold mb-4 text-center">Camera Feed</h3>
              
              <div class="relative mx-auto max-w-lg">
                <div class="relative rounded-xl overflow-hidden border-2 border-green-400/50 shadow-lg shadow-green-400/10">
                  <video id="video" autoplay playsinline muted class="w-full h-auto bg-slate-900"></video>
                  
                  <!-- Canvas overlay for drawing bounding boxes -->
                  <canvas id="detection-canvas" class="absolute inset-0 w-full h-auto pointer-events-none" style="z-index: 10;"></canvas>
                  
                  <div id="camera-off-overlay" class="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center">
                    <div class="text-center mb-8">
                      <svg class="w-16 h-16 text-green-400/50 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2-2V9z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      </svg>
                      <p class="text-green-200/60">Camera is off</p>
                    </div>
                  </div>
                  
                  <!-- Camera Control Buttons -->
                  <div class="absolute bottom-4 left-4 flex gap-2">
                    <button id="start-detection-btn" class="px-4 py-2 bg-green-500/90 hover:bg-green-600/90 backdrop-blur-sm text-white rounded-lg font-medium flex items-center gap-2 shadow-lg transition-all">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      Start Detection
                    </button>
                    
                    <button id="stop-detection-btn" class="px-4 py-2 bg-red-500/90 hover:bg-red-600/90 backdrop-blur-sm text-white rounded-lg font-medium flex items-center gap-2 shadow-lg transition-all hidden">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10h6v4H9z"></path>
                      </svg>
                      Stop Detection
                    </button>
                  </div>
                  
                  
                  <!-- Capture indicator -->
                  <div id="capture-indicator" class="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 hidden">
                    <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    Capturing...
                  </div>
                  
                  <!-- Camera status indicator -->
                  <div id="camera-status" class="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 hidden">
                    <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    Live
                  </div>
                  
                </div>
              </div>
              
              <!-- Detection Status (Below Camera) -->
              <div id="detection-overlay" class="mt-4 bg-slate-800/90 backdrop-blur-sm border border-green-400/50 rounded-xl p-6 text-center hidden">
                <div id="detection-message" class="text-green-400 text-xl font-semibold mb-4">Show sign for 'S' - Hold for 2 seconds</div>
                <div class="progress-container mb-3">
                  <div class="w-full bg-slate-600 rounded-full h-3">
                    <div id="detection-progress" class="bg-green-400 h-3 rounded-full transition-all duration-300" style="width: 0%"></div>
                  </div>
                </div>
                <div id="detection-status" class="text-green-200/80 text-sm">Hold the sign steady...</div>
              </div>
              
              <!-- Confidence Threshold Controls -->
              <div class="mt-4 bg-slate-800/50 backdrop-blur-sm border border-green-400/30 rounded-xl p-4">
                <h4 class="text-green-400 text-lg font-semibold mb-3 text-center">Detection Settings</h4>
                <div class="flex items-center justify-between gap-4">
                  <label class="text-green-200 text-sm font-medium">Confidence Threshold:</label>
                  <div class="flex items-center gap-3 flex-1">
                    <span class="text-green-200 text-sm min-w-[3rem]">0.1</span>
                    <input type="range" id="confidence-slider" class="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider" min="0.1" max="0.9" step="0.1" value="0.3">
                    <span class="text-green-200 text-sm min-w-[3rem]">0.9</span>
                  </div>
                  <span id="confidence-value" class="text-green-400 font-semibold min-w-[3rem] text-center">0.3</span>
                </div>
                <p class="text-green-200/70 text-xs mt-2 text-center">
                  Lower values detect more signs (less accurate) • Higher values detect fewer signs (more accurate)
                </p>
              </div>
            </div>

            <!-- Control Buttons -->
            <div class="flex justify-center gap-4 flex-wrap opacity-0 animate-fade-in" style="animation-delay: 0.7s;">
              <button id="clear-btn" class="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-green-200 rounded-xl font-semibold flex items-center gap-2 shadow-lg border border-slate-600 transition-all">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Reset Test
              </button>
            </div>

            <!-- Hidden canvas for image capture -->
            <canvas id="canvas" class="hidden"></canvas>
            
            <!-- Completion Popup Modal -->
            <div id="completion-modal" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 hidden opacity-0 transition-all duration-500">
              <div class="bg-slate-800 border-2 border-green-400/70 rounded-3xl p-10 max-w-lg mx-4 text-center shadow-2xl shadow-green-400/20 transform scale-95 transition-all duration-500">
                <!-- Animated celebration icon -->
                <div class="text-7xl mb-6 animate-bounce">🎉</div>
                
                <!-- Title with glow effect -->
                <h3 class="text-3xl font-bold text-green-400 mb-6 drop-shadow-lg">
                  Test Complete!
                </h3>
                
                <!-- Success message -->
                <p class="text-green-200 text-lg mb-4 leading-relaxed">
                  Congratulations! You've successfully completed all the sign language tests.
                </p>
                
                <!-- Additional info -->
                <p class="text-green-200/80 mb-8 text-base">
                  Next session coming soon. Please stay in touch!
                </p>
                
                <!-- Enhanced continue button -->
                <button id="close-completion-btn" class="px-8 py-4 bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-slate-900 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-green-400/30">
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const startDetectionBtn = document.getElementById('start-detection-btn');
    const stopDetectionBtn = document.getElementById('stop-detection-btn');
    const clearBtn = document.getElementById('clear-btn');
    const closeCompletionBtn = document.getElementById('close-completion-btn');
    const confidenceSlider = document.getElementById('confidence-slider');
    const confidenceValue = document.getElementById('confidence-value');

    startDetectionBtn.addEventListener('click', () => this.startDetection());
    stopDetectionBtn.addEventListener('click', () => this.stopDetection());
    clearBtn.addEventListener('click', () => this.handleClear());
    closeCompletionBtn.addEventListener('click', () => this.closeCompletionModal());
    
    // Confidence threshold slider
    if (confidenceSlider && confidenceValue) {
      confidenceSlider.addEventListener('input', (e) => {
        this.confidenceThreshold = parseFloat(e.target.value);
        confidenceValue.textContent = this.confidenceThreshold.toFixed(1);
      });
    }
  }

  fetchTargetWord() {
    const currentWord = this.practiceWords[this.currentWordIndex];
    this.targetWord = currentWord;
    this.currentLetterIndex = 0; // Reset to first letter of the word
    
    // Initialize letter boxes
    this.letterBoxes = currentWord.split('').map(letter => ({
      letter,
      image: null,
      isValid: null
    }));
    
    // Reset capture state
    this.capturedImages = [];
    this.currentCapture = 0;
    this.validationResults = [];
    this.holdProgress = 0;
    this.isPaused = false;
    
    this.updateUI();
  }

  updateUI() {
    // Update word counter and current word
    document.getElementById('word-counter').textContent = `Word ${this.currentWordIndex + 1} of ${this.practiceWords.length}`;
    document.getElementById('current-word').textContent = this.targetWord;
    
    // Update letter boxes
    this.renderLetterBoxes();
  }

  renderLetterBoxes() {
    const letterBoxesContainer = document.getElementById('letter-boxes');
    letterBoxesContainer.innerHTML = '';
    
    this.letterBoxes.forEach((box, index) => {
      const letterBox = document.createElement('div');
      letterBox.className = 'flex flex-col items-center opacity-0 animate-fade-in';
      letterBox.style.animationDelay = `${index * 0.1}s`;
      
      const imageBoxClass = box.isValid === null 
        ? 'border-green-400/50 bg-slate-700/30' 
        : box.isValid 
          ? 'border-green-400 bg-green-400/10 shadow-lg shadow-green-400/20' 
          : 'border-red-400 bg-red-400/10 shadow-lg shadow-red-400/20';
      
      letterBox.innerHTML = `
        <div class="w-24 h-24 mb-3 rounded-xl border-2 overflow-hidden relative ${imageBoxClass}">
          ${box.image 
            ? `<img src="${box.image}" alt="Sign for ${box.letter}" class="w-full h-full object-cover" />`
            : `<div class="w-full h-full flex items-center justify-center">
                 <svg class="w-8 h-8 text-green-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2-2V9z"></path>
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                 </svg>
               </div>`
          }
          ${box.isValid !== null 
            ? `<div class="absolute top-1 right-1">
                 ${box.isValid 
                   ? `<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>`
                   : `<svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                      </svg>`
                 }
               </div>`
            : ''
          }
        </div>
        <div class="text-3xl font-bold text-green-400">${box.letter}</div>
      `;
      
      letterBoxesContainer.appendChild(letterBox);
    });
  }

  async startDetection() {
    try {
      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        throw new Error('Camera access requires HTTPS. Please use https:// or run on localhost.');
      }
      
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices) {
        throw new Error('Media devices API not supported. Please use a modern browser like Chrome, Firefox, or Safari.');
      }
      
      // Reset any existing detection state
      this.holdProgress = 0;
      document.getElementById('detection-progress').style.width = '0%';
      document.getElementById('detection-status').textContent = 'Hold the sign steady...';
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices.getUserMedia) {
        // Try fallback for older browsers
        navigator.getUserMedia = navigator.getUserMedia || 
                               navigator.webkitGetUserMedia || 
                               navigator.mozGetUserMedia || 
                               navigator.msGetUserMedia;
        
        if (!navigator.getUserMedia) {
          throw new Error('Camera access is not supported by this browser. Please update to a newer version.');
        }
      }
      
      // Check camera permissions first
      if (navigator.permissions) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' });
          if (permissionStatus.state === 'denied') {
            throw new Error('Camera permission has been denied. Please allow camera access in your browser settings and refresh the page.');
          }
        } catch (permError) {
          // Permissions API not supported, continue with camera request
          console.log('Permissions API not supported, proceeding with camera request');
        }
      }
      
      // Start camera if not already started
      if (!this.isCameraActive) {
        let stream;
        
        // Define camera constraints with fallback options
        const constraints = {
          video: {
            width: { ideal: 640, min: 320 },
            height: { ideal: 480, min: 240 },
            facingMode: 'user', // Front camera preferred
            frameRate: { ideal: 15, max: 30 }
          },
          audio: false
        };
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          // Modern browsers
          try {
            console.log('Attempting to access camera with ideal constraints...');
            stream = await navigator.mediaDevices.getUserMedia(constraints);
          } catch (err) {
            // Try with simpler constraints if the first attempt fails
            console.log('First attempt failed, trying simpler constraints:', err);
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            } catch (finalErr) {
              console.error('Final camera access attempt failed:', finalErr);
              throw finalErr; // Re-throw to be caught by the outer try/catch
            }
          }
        } else {
          // Fallback for older browsers
          try {
            stream = await new Promise((resolve, reject) => {
              navigator.getUserMedia(
                { video: true },
                resolve,
                reject
              );
            });
          } catch (legacyErr) {
            console.error('Legacy camera access failed:', legacyErr);
            throw legacyErr; // Re-throw to be caught by the outer try/catch
          }
        }
        
        this.stream = stream;
        this.isCameraActive = true;
        
        const video = document.getElementById('video');
        video.srcObject = this.stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            video.play().then(resolve).catch(resolve);
          };
        });
        
        // Update UI
        this.updateCameraUI();
      }
      
      // Start detection process
      this.detectionActive = true;
      this.holdProgress = 0;
      
      // Update button states
      document.getElementById('start-detection-btn').classList.add('hidden');
      document.getElementById('stop-detection-btn').classList.remove('hidden');
      
      // Show detection overlay
      this.showDetectionOverlay();
      
      // Start detection loop
      this.startDetectionLoop();
      
    } catch (error) {
      console.error('Failed to access camera:', error);
      
      let errorMessage = 'Camera access is required for this application to work.';
      let troubleshootingTips = '';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Camera permission denied.';
        troubleshootingTips = '\n\nTo fix this:\n1. Click the camera icon in your browser\'s address bar\n2. Select "Allow" for camera access\n3. Refresh this page\n\nOr check your browser settings under Privacy & Security > Camera.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found on this device.';
        troubleshootingTips = '\n\nPlease check:\n1. Your camera is properly connected\n2. Camera drivers are installed\n3. No other applications are using the camera';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Camera is already in use by another application.';
        troubleshootingTips = '\n\nPlease:\n1. Close other applications using the camera\n2. Refresh this page\n3. Restart your browser if needed';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints could not be satisfied.';
        troubleshootingTips = '\n\nYour camera may not support the required resolution. This should be handled automatically, please try refreshing the page.';
      } else if (error.message.includes('HTTPS') || error.message.includes('https')) {
        errorMessage = 'Camera access requires a secure connection.';
        troubleshootingTips = '\n\nTo fix this:\n1. Use https:// instead of http://\n2. Or run the application on localhost\n3. Contact your administrator if this is a hosted application';
      } else if (error.message.includes('not supported') || error.message.includes('Media devices API')) {
        errorMessage = 'Camera access is not supported by this browser.';
        troubleshootingTips = '\n\nPlease:\n1. Update your browser to the latest version\n2. Use Chrome, Firefox, or Safari\n3. Enable JavaScript if disabled';
      } else {
        errorMessage = 'Failed to access camera: ' + error.message;
        troubleshootingTips = '\n\nGeneral troubleshooting:\n1. Refresh the page and try again\n2. Check if other websites can access your camera\n3. Restart your browser\n4. Check your antivirus/firewall settings';
      }
      
      // Show user-friendly error dialog
      this.showErrorDialog(errorMessage + troubleshootingTips);
      
      // Reset button states
      document.getElementById('start-detection-btn').classList.remove('hidden');
      document.getElementById('stop-detection-btn').classList.add('hidden');
    }
  }

  stopDetection() {
    this.detectionActive = false;
    this.holdProgress = 0;
    this.isPaused = false;
    this.currentLetterIndex = 0;
    
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    
    // Update button states
    document.getElementById('start-detection-btn').classList.remove('hidden');
    document.getElementById('stop-detection-btn').classList.add('hidden');
    
    // Hide detection overlay
    document.getElementById('detection-overlay').classList.add('hidden');
    
    // Clear bounding boxes
    this.drawBoundingBoxes([]);
  }
  
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.isCameraActive = false;
    this.stopDetection();
    
    const video = document.getElementById('video');
    if (video) {
      video.srcObject = null;
    }
    
    // Update UI
    this.updateCameraUI();
  }
  
  updateCameraUI() {
    const cameraOffOverlay = document.getElementById('camera-off-overlay');
    const cameraStatus = document.getElementById('camera-status');
    const startBtn = document.getElementById('start-detection-btn');
    const stopBtn = document.getElementById('stop-detection-btn');
    const canvas = document.getElementById('detection-canvas');
    
    if (this.isCameraActive) {
      if (cameraOffOverlay) cameraOffOverlay.style.display = 'none';
      if (cameraStatus) cameraStatus.classList.remove('hidden');
      // Initialize detection canvas
      this.initDetectionCanvas();
    } else {
      if (cameraOffOverlay) cameraOffOverlay.style.display = 'flex';
      if (cameraStatus) cameraStatus.classList.add('hidden');
      if (startBtn) startBtn.classList.remove('hidden');
      if (stopBtn) stopBtn.classList.add('hidden');
      // Clear detection canvas
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }
  
  initDetectionCanvas() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('detection-canvas');
    
    if (!video || !canvas) return;
    
    // Set canvas dimensions to match video
    const resizeCanvas = () => {
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };
    
    resizeCanvas();
    
    // Resize canvas when video size changes
    video.addEventListener('loadedmetadata', resizeCanvas);
    window.addEventListener('resize', resizeCanvas);
  }
  
  drawBoundingBoxes(boxes) {
    const canvas = document.getElementById('detection-canvas');
    if (!canvas || !boxes || boxes.length === 0) {
      // Clear canvas if no boxes
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    
    const ctx = canvas.getContext('2d');
    const video = document.getElementById('video');
    
    if (!ctx || !video) return;
    
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get video dimensions for scaling
    const videoRect = video.getBoundingClientRect();
    const scaleX = videoRect.width / video.videoWidth || 1;
    const scaleY = videoRect.height / video.videoHeight || 1;
    
    boxes.forEach(box => {
      // Scale bounding box coordinates to canvas size
      const x = box.x1 * scaleX;
      const y = box.y1 * scaleY;
      const width = (box.x2 - box.x1) * scaleX;
      const height = (box.y2 - box.y1) * scaleY;
      
      // Set box style based on confidence
      const isHighConfidence = box.conf >= this.confidenceThreshold;
      const boxColor = isHighConfidence ? '#4ade80' : '#fbbf24'; // Green for good, yellow for low confidence
      const textColor = '#ffffff';
      
      // Draw bounding box
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Draw filled background for text
      const label = `${box.class} (${Math.round(box.conf * 100)}%)`;
      ctx.font = '16px sans-serif';
      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const textHeight = 20;
      
      ctx.fillStyle = boxColor;
      ctx.fillRect(x, y - textHeight - 4, textWidth + 12, textHeight + 4);
      
      // Draw text label
      ctx.fillStyle = textColor;
      ctx.fillText(label, x + 6, y - 8);
      
      // Add a subtle glow effect for better visibility
      ctx.shadowColor = boxColor;
      ctx.shadowBlur = 10;
      ctx.strokeRect(x, y, width, height);
      ctx.shadowBlur = 0;
    });
  }

  showDetectionOverlay() {
    const currentWord = this.practiceWords[this.currentWordIndex];
    document.getElementById('detection-message').textContent = `Show sign for '${currentWord}' - Hold for 2 seconds`;
    document.getElementById('detection-status').textContent = 'Hold the sign steady...';
    document.getElementById('detection-progress').style.width = '0%';
    document.getElementById('detection-overlay').classList.remove('hidden');
    
    // Reset hold progress for the new word
    this.holdProgress = 0;
  }
  
  async startDetectionLoop() {
    // First, clear any existing interval to prevent duplicates
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    
    // Start with initial pause
    await this.pauseBeforeDetection();
    
    // Start the detection loop
    this.detectionInterval = setInterval(async () => {
      if (!this.detectionActive || this.processing || this.isPaused) return;
      
      this.processing = true;
      
      try {
        const imageData = this.captureImage();
        if (imageData) {
          const currentWord = this.practiceWords[this.currentWordIndex];
          const currentLetter = currentWord[this.currentLetterIndex];
          const detectionResult = await this.detectSign(imageData, currentLetter);
          const isValid = detectionResult.isValid;
          const boxes = detectionResult.boxes || [];
          
          // Always draw bounding boxes regardless of validity
          this.drawBoundingBoxes(boxes);
          
          if (isValid) {
            // Update status if a sign is detected
            const remainingTime = Math.ceil((this.holdDuration - this.holdProgress) / 1000);
            document.getElementById('detection-status').textContent = `Sign '${currentLetter}' detected! Hold for ${remainingTime} more second${remainingTime > 1 ? 's' : ''}...`;
            
            // Increment progress
            this.holdProgress += 100; // Increment by 100ms per detection interval
            const progressPercent = Math.min((this.holdProgress / this.holdDuration) * 100, 100);
            document.getElementById('detection-progress').style.width = progressPercent + '%';
            
            if (this.holdProgress >= this.holdDuration) {
              // Sign detected successfully for required duration
              document.getElementById('detection-status').textContent = `Capturing image for '${currentLetter}'...`;
              
              // Find the confidence of the matching sign
              const matchingBox = boxes.find(box => 
                box.class.toLowerCase() === currentLetter.toLowerCase() && 
                box.conf >= this.confidenceThreshold
              );
              const confidence = matchingBox ? matchingBox.conf : 0.5;
              await this.onLetterDetected(imageData, confidence, currentLetter);
            }
          } else {
            // Reset progress gradually if sign not detected
            this.holdProgress = Math.max(0, this.holdProgress - 150);
            const progressPercent = Math.min((this.holdProgress / this.holdDuration) * 100, 100);
            document.getElementById('detection-progress').style.width = progressPercent + '%';
            
            if (boxes.length > 0) {
              const detectedSigns = boxes.map(box => box.class).join(', ');
              document.getElementById('detection-status').textContent = `Show sign for '${currentLetter}' (detected: ${detectedSigns})`;
            } else {
              document.getElementById('detection-status').textContent = `Hold sign for '${currentLetter}' steady...`;
            }
          }
        }
      } catch (error) {
        console.error('Detection error:', error);
        this.drawBoundingBoxes([]);
      }
      
      this.processing = false;
    }, 100);
  }
  
  async pauseBeforeDetection() {
    this.isPaused = true;
    const currentWord = this.practiceWords[this.currentWordIndex];
    const currentLetter = currentWord[this.currentLetterIndex];
    
    // Clear any existing detection state
    this.holdProgress = 0;
    this.drawBoundingBoxes([]);
    
    // Show pause message
    document.getElementById('detection-message').textContent = `Get ready for '${currentLetter}' in word '${currentWord}'`;
    document.getElementById('detection-status').textContent = `Preparing to detect '${currentLetter}'...`;
    document.getElementById('detection-progress').style.width = '0%';
    
    // Wait for pause duration
    await new Promise(resolve => setTimeout(resolve, this.pauseDuration));
    
    // Update UI for active detection
    document.getElementById('detection-message').textContent = `Show sign for '${currentLetter}' - Hold for 2 seconds`;
    document.getElementById('detection-status').textContent = `Hold sign for '${currentLetter}' steady...`;
    
    this.isPaused = false;
  }
  
  async onLetterDetected(imageData, confidence, letter) {
    const currentWord = this.practiceWords[this.currentWordIndex];
    
    try {
      // Save the image to database
      const saveResponse = await fetch('/api/save-test-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_session: this.testSessionId,
          word: `${currentWord}_${letter}_${this.currentLetterIndex}`,
          image_data: imageData,
          confidence: confidence
        })
      });
      
      const saveResult = await saveResponse.json();
      if (saveResult.success) {
        console.log('Image saved successfully with ID:', saveResult.image_id);
      }
    } catch (error) {
      console.error('Error saving image:', error);
    }
    
    // Update the letter box with the captured image
    this.letterBoxes[this.currentLetterIndex] = {
      ...this.letterBoxes[this.currentLetterIndex],
      image: imageData,
      isValid: true
    };
    
    // Update UI
    this.renderLetterBoxes();
    document.getElementById('detection-status').textContent = `${letter} captured successfully!`;
    document.getElementById('detection-progress').style.width = '100%';
    
    // Reset for next letter or word
    this.holdProgress = 0;
    this.currentLetterIndex++;
    
    // Pause detection temporarily
    this.isPaused = true;
    
    if (this.currentLetterIndex >= currentWord.length) {
      // Word complete!
      document.getElementById('detection-status').textContent = `Word '${currentWord}' completed! Moving to next word...`;
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.currentWordIndex++;
      
      if (this.currentWordIndex >= this.practiceWords.length) {
        // Test complete!
        document.getElementById('detection-status').textContent = 'All tests completed! 🎉';
        document.getElementById('detection-progress').style.width = '100%';
        
        // Add celebration effects to the detection overlay
        const detectionOverlay = document.getElementById('detection-overlay');
        detectionOverlay.classList.add('animate-pulse');
        detectionOverlay.style.borderColor = 'rgb(74 222 128)';
        detectionOverlay.style.backgroundColor = 'rgba(74, 222, 128, 0.1)';
        
        // Show a brief completion message before the popup
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        this.stopDetection();
        this.showCompletionModal();
        return;
      } else {
        // Move to next word
        this.fetchTargetWord();
        await this.pauseBeforeDetection();
      }
    } else {
      // More letters in current word - continue with next letter
      document.getElementById('detection-status').textContent = `Moving to next letter...`;
      await new Promise(resolve => setTimeout(resolve, 500)); // Short pause between letters
      
      // Update detection message for next letter
      const nextLetter = currentWord[this.currentLetterIndex];
      document.getElementById('detection-message').textContent = `Show sign for '${nextLetter}' - Hold for 2 seconds`;
      document.getElementById('detection-status').textContent = `Hold sign for '${nextLetter}' steady...`;
      document.getElementById('detection-progress').style.width = '0%';
      
      this.isPaused = false; // Resume detection for next letter
    }
  }
  
  async detectSign(imageData, expectedSign) {
    try {
      // Use the same endpoint as sign-to-text
      const response = await fetch('/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData
        })
      });
      
      const result = await response.json();
      
      // Check if any detected sign matches the expected sign
      if (result.boxes && result.boxes.length > 0) {
        // Display detected signs in console for debugging
        const detectedSigns = result.boxes.map(box => `${box.class} (${(box.conf * 100).toFixed(1)}%)`);
        console.log(`Detected signs: ${detectedSigns.join(', ')}`);  
        
        // Check if any box matches the expected sign with sufficient confidence
        const isValid = result.boxes.some(box => 
          box.class.toLowerCase() === expectedSign.toLowerCase() && 
          box.conf > this.confidenceThreshold // Use dynamic confidence threshold
        );
        
        return {
          isValid: isValid,
          boxes: result.boxes
        };
      }
      
      return {
        isValid: false,
        boxes: []
      };
    } catch (error) {
      console.error('Failed to detect sign:', error);
      return {
        isValid: false,
        boxes: []
      };
    }
  }
  
  showCompletionModal() {
    const modal = document.getElementById('completion-modal');
    const modalContent = modal.querySelector('div > div');
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Trigger animations with slight delay
    setTimeout(() => {
      modal.classList.remove('opacity-0');
      modal.classList.add('opacity-100');
      modalContent.classList.remove('scale-95');
      modalContent.classList.add('scale-100');
    }, 50);
    
    // Add celebration sound effect if available
    try {
      // You can add a sound effect here if desired
      console.log('Test completed successfully! 🎉');
    } catch (e) {
      // Ignore sound errors
    }
  }
  
  closeCompletionModal() {
    const modal = document.getElementById('completion-modal');
    const modalContent = modal.querySelector('div > div');
    
    // Animate out
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    
    // Hide modal after animation completes
    setTimeout(() => {
      modal.classList.add('hidden');
      
      // Redirect to learning_mode.html instead of resetting
      window.location.href = '/learning_hub';
      
      // Reset the test (in case the redirect doesn't work)
      this.currentWordIndex = 0;
      this.fetchTargetWord();
    }, 500);
  }


  captureImage() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    
    if (!video || !canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.drawImage(video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  }


  handleClear() {
    this.stopDetection();
    this.currentWordIndex = 0;
    this.currentLetterIndex = 0;
    this.validationResults = [];
    this.capturedImages = [];
    this.currentCapture = 0;
    this.holdProgress = 0;
    this.isPaused = false;
    this.fetchTargetWord();
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SignLanguageTest();
});