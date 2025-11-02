// DOM Content Loaded Event - Modified for server-side progress
document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('theme-toggle');
    const viewerThemeToggle = document.getElementById('viewer-theme-toggle');
    const undertonePicker = document.getElementById('undertone-picker');
    const undertoneHex = document.getElementById('undertone-hex');
    const undertonePaletteBtn = document.getElementById('undertone-palette');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsSidebar = document.getElementById('settings-sidebar');
    const settingsClose = document.getElementById('settings-close');
    const settingsOverlay = document.getElementById('settings-overlay');
    const particleCanvas = document.getElementById('particle-canvas');
    const starSparkles = document.getElementById('star-sparkles');
    const panelStars = document.getElementById('panel-stars');
    const panelStarsInner = document.getElementById('panel-stars-inner');
    // Lesson pages: inline viewer logic
    const viewer = document.getElementById('viewer');
    const videoEl = document.getElementById('lesson-video');
    const viewerBack = document.getElementById('viewer-back');
    const viewerNext = document.getElementById('viewer-next');
    const viewerTitle = document.getElementById('viewer-title');
    const playbackRate = document.getElementById('playback-rate');
    const pipBtn = document.getElementById('pip-btn');
    const fsBtn = document.getElementById('fs-btn');
    const lesson1Accordion = document.getElementById('lesson1-accordion');
    const lesson2Accordion = document.getElementById('lesson2-accordion');
    const lesson3Accordion = document.getElementById('lesson3-accordion');
    const accordion = lesson1Accordion || lesson2Accordion || lesson3Accordion;
    const instructions = document.getElementById('instructions');
    const instructionsClose = document.getElementById('inst-close');
    let instructionsPrevScrollY = null;
    let instructionsClosingViaButton = false;
    const isLesson2 = Boolean(lesson2Accordion);
    const isLesson3 = Boolean(lesson3Accordion);
    const lessonNumber = isLesson3 ? 3 : isLesson2 ? 2 : 1;
    const videoSources = isLesson3
        ? [
            'signs2/0.mp4','signs2/1.mp4','signs2/2.mp4','signs2/3.mp4','signs2/4.mp4',
            'signs2/5.mp4','signs2/6.mp4','signs2/7.mp4','signs2/8.mp4','signs2/9.mp4'
          ]
        : isLesson2
        ? [
            'signs/P.mp4','signs/Q.mp4','signs/R.mp4','signs/S.mp4','signs/T.mp4',
            'signs/U.mp4','signs/V.mp4','signs/W.mp4','signs/X.mp4','signs/Y.mp4',
            'signs/Z.mp4'
          ]
        : [
            'signs/A.mp4','signs/B.mp4','signs/C.mp4','signs/D.mp4','signs/E.mp4',
            'signs/F.mp4','signs/G.mp4','signs/H.mp4','signs/I.mp4','signs/J.mp4',
            'signs/K.mp4','signs/L.mp4','signs/M.mp4','signs/N.mp4','signs/O.mp4'
          ];
    let currentIndex = 0;
    let completedUntil = 0; // will be loaded from server
    let isLessonCompleted = false;

    // Show unlock CTA for lesson 1 when done (on load) and handle click
    const unlockLesson2Btn = document.getElementById('unlock-lesson2-btn');
    const unlockAfterLesson2Btn = document.getElementById('unlock-after-lesson2-btn');
    const unlockAfterLesson3Btn = document.getElementById('unlock-after-lesson3-btn');

    // API functions for server-side progress
    async function loadProgressFromServer() {
        try {
            const response = await fetch(`/api/lesson-progress/${lessonNumber}`);
            if (response.ok) {
                const data = await response.json();
                completedUntil = data.completed_until || 0;
                isLessonCompleted = data.is_completed || false;
                updateLocks();
                checkAndShowUnlockCta();
            }
        } catch (error) {
            console.error('Failed to load progress:', error);
            // Fallback to default values
            completedUntil = 0;
            isLessonCompleted = false;
        }
    }

    async function saveProgressToServer(newCompletedUntil, lessonCompleted = false) {
        try {
            const response = await fetch(`/api/lesson-progress/${lessonNumber}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    completed_until: newCompletedUntil,
                    is_completed: lessonCompleted
                })
            });
            
            if (!response.ok) {
                console.error('Failed to save progress');
            }
        } catch (error) {
            console.error('Failed to save progress:', error);
        }
    }

    async function loadAllProgressFromServer() {
        try {
            const response = await fetch('/api/lesson-progress/all');
            if (response.ok) {
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error('Failed to load all progress:', error);
        }
        return {};
    }

    function checkAndShowUnlockCta() {
        // Lesson 1 button enablement
        if (unlockLesson2Btn) {
            const lastIndex1 = videoSources.length - 1;
            if (isLessonCompleted || (!isLesson2 && !isLesson3 && completedUntil >= lastIndex1)) {
                unlockLesson2Btn.disabled = false;
            }
        }
        // Lesson 2 button enablement
        if (unlockAfterLesson2Btn) {
            const lastIndex2 = videoSources.length - 1;
            if (isLessonCompleted || (isLesson2 && completedUntil >= lastIndex2)) {
                unlockAfterLesson2Btn.disabled = false;
            }
        }
        // Lesson 3 button enablement
        if (unlockAfterLesson3Btn) {
            const lastIndex3 = videoSources.length - 1;
            if (isLessonCompleted || (isLesson3 && completedUntil >= lastIndex3)) {
                unlockAfterLesson3Btn.disabled = false;
            }
        }
    }

    unlockLesson2Btn?.addEventListener('click', async () => {
        // Save lesson 1 completion to server
        await saveProgressToServer(completedUntil, true);
        window.location.href = '/learning-hub';
    });

    unlockAfterLesson2Btn?.addEventListener('click', async () => {
        // Save lesson 2 completion to server
        await saveProgressToServer(completedUntil, true);
        window.location.href = '/learning-hub';
    });

    unlockAfterLesson3Btn?.addEventListener('click', async () => {
        // Save lesson 3 completion to server
        await saveProgressToServer(completedUntil, true);
        window.location.href = '/learning-hub';
    });

    function updateLocks() {
        accordion?.querySelectorAll('details.accordion-item').forEach(item => {
            const idx = Number(item.getAttribute('data-index')) || 0;
            if (idx <= completedUntil) {
                item.classList.add('unlocked');
                item.classList.remove('locked');
            } else {
                item.classList.add('locked');
                item.classList.remove('unlocked');
            }
            // Mark completed parts with a green border (those strictly less than completedUntil)
            if (idx < completedUntil) {
                item.classList.add('completed');
            } else {
                item.classList.remove('completed');
            }
        });
    }

    function openViewer(index) {
        currentIndex = Math.max(0, Math.min(videoSources.length - 1, index));
        if (!viewer || !videoEl) return;
        const partNum = currentIndex + 1;
        const label = accordion?.querySelector(`details[data-index="${currentIndex}"] summary span:first-child`)?.textContent || `Part ${partNum}`;
        viewerTitle.textContent = `${label}`;
        videoEl.src = `/static/${videoSources[currentIndex]}`;
        videoEl.currentTime = 0;
        videoEl.playbackRate = Number(playbackRate?.value || 1);
        // Highlight current tab as in-progress (yellow) and clear others
        if (accordion) {
            accordion.querySelectorAll('details.accordion-item').forEach(item => item.classList.remove('in-progress'));
            const currentItem = accordion.querySelector(`details.accordion-item[data-index="${currentIndex}"]`);
            currentItem?.classList.add('in-progress');
        }
        viewer.hidden = false;
        videoEl.play().catch(() => {});
    }

    function closeViewer() {
        if (!viewer || !videoEl) return;
        videoEl.pause();
        // Exit PiP or Fullscreen if active
        try { if (document.pictureInPictureElement) document.exitPictureInPicture(); } catch(e){}
        try { if (document.fullscreenElement) document.exitFullscreen(); } catch(e){}
        // Clear src to stop audio on some browsers
        videoEl.removeAttribute('src');
        videoEl.load();
        viewer.hidden = true;
        // Remove in-progress highlight when viewer is closed
        accordion?.querySelectorAll('details.accordion-item').forEach(item => item.classList.remove('in-progress'));
    }

    // Open viewer when a tab is clicked (on summary click), not on expand
    accordion?.querySelectorAll('details.accordion-item').forEach(item => {
        const summary = item.querySelector('summary');
        summary?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Let instructions item expand/collapse normally
            if (item.id === 'instructions') {
                item.open = !item.open;
                return;
            }
            const idx = Number(item.getAttribute('data-index')) || 0;
            if (idx > completedUntil) {
                summary.animate([
                    { transform: 'translateX(0)' },
                    { transform: 'translateX(-4px)' },
                    { transform: 'translateX(4px)' },
                    { transform: 'translateX(0)' }
                ], { duration: 250, easing: 'ease-out' });
                showUiModal('This part is locked. Complete the previous parts first.');
                return;
            }
            // add in-progress highlight immediately when user clicks
            accordion?.querySelectorAll('details.accordion-item').forEach(el => el.classList.remove('in-progress'));
            item.classList.add('in-progress');
            openViewer(idx);
        });
    });

    // Instructions: reveal steps one by one when opened (fast, smooth)
    function revealInstructionSteps() {
        const steps = instructions?.querySelectorAll('.inst-step');
        if (!steps || steps.length === 0) return;
        steps.forEach(s => s.classList.remove('visible'));
        instructionsClose?.setAttribute('hidden', '');
        let i = 0;
        function showNext() {
            if (!steps || i >= steps.length) {
                instructionsClose?.removeAttribute('hidden');
                return;
            }
            steps[i].classList.add('visible');
            i += 1;
            // Quick stagger for a snappy, effortless feel
            setTimeout(showNext, 160);
        }
        setTimeout(showNext, 60);
    }

    // Smooth expand/collapse with synced scroll
    instructions?.addEventListener('toggle', () => {
        if (!instructions) return;
        const content = instructions.querySelector('.instructions-content');
        if (!content) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const duration = reduceMotion ? 0 : 220;
        const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';

        // Cancel any previous animations
        content.getAnimations().forEach(a => a.cancel());

        if (instructions.open) {
            instructionsPrevScrollY = window.scrollY;
            const startHeight = 0;
            // Measure target height
            content.style.height = 'auto';
            const endHeight = content.getBoundingClientRect().height;
            content.style.height = startHeight + 'px';
            content.style.overflow = 'hidden';

            const anim = content.animate([
                { height: startHeight + 'px' },
                { height: endHeight + 'px' }
            ], { duration, easing: ease });

            // Sync scroll so the section stays in view as it expands
            // Keep current viewport aligned to the top of the instructions just once
            const startTop = instructions.getBoundingClientRect().top + window.scrollY;
            const targetTop = Math.max(0, startTop - 80);
            window.scrollTo({ top: targetTop, behavior: reduceMotion ? 'auto' : 'smooth' });

            anim.addEventListener('finish', () => {
                content.style.height = 'auto';
                content.style.overflow = '';
                revealInstructionSteps();
            });
        } else {
            // Collapse smoothly
            const startHeight = content.getBoundingClientRect().height;
            const anim = content.animate([
                { height: startHeight + 'px' },
                { height: '0px' }
            ], { duration, easing: ease });
            content.style.overflow = 'hidden';
            anim.addEventListener('finish', () => {
                content.style.height = '';
                content.style.overflow = '';
                // Reset flag after collapse animation completes
                instructionsClosingViaButton = false;
            });
            // If close initiated by button, we've already restored instantly; otherwise, skip auto-scroll
            if (!instructionsClosingViaButton && instructionsPrevScrollY !== null) {
                // Do not scroll automatically anymore per new requirement
                instructionsPrevScrollY = null;
            }
        }
    });

    instructionsClose?.addEventListener('click', (e) => {
        e.preventDefault();
        // Mark immediate close to suppress toggle scroll and restore instantly
        instructionsClosingViaButton = true;
        // Restore original scroll position immediately (no delay)
        if (instructionsPrevScrollY !== null) {
            const target = Math.max(0, Math.min(instructionsPrevScrollY, document.documentElement.scrollHeight - window.innerHeight));
            window.scrollTo({ top: target, behavior: 'auto' });
        }
        instructions?.removeAttribute('open');
        // hide steps for next open
        const steps = instructions?.querySelectorAll('.inst-step');
        steps?.forEach(s => s.classList.remove('visible'));
        instructionsClose?.setAttribute('hidden', '');
        // Clear saved position now that we've restored it
        instructionsPrevScrollY = null;
    });

    viewerBack?.addEventListener('click', () => {
        const prevIndex = Math.max(0, currentIndex - 1);
        if (prevIndex === currentIndex) return; // already at first
        openViewer(prevIndex);
    });

    viewerNext?.addEventListener('click', () => {
        const nextIndex = Math.min(videoSources.length - 1, currentIndex + 1);
        openViewer(nextIndex);
    });

    const viewerCloseBtn = document.getElementById('viewer-close');
    viewerCloseBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeViewer();
    });

    // Close when clicking outside the panel
    viewer?.addEventListener('click', (e) => {
        if (e.target === viewer) {
            closeViewer();
            return;
        }
        // Delegate close if any element with .viewer-close is clicked
        if (e.target && e.target.closest && e.target.closest('.viewer-close')) {
            e.preventDefault();
            closeViewer();
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !viewer?.hidden) closeViewer();
    });

    // Ensure viewer starts hidden and locks applied (only on lesson pages)
    if (viewer && accordion) {
        viewer.hidden = true;
        // Also ensure no src is set initially
        if (videoEl) {
            videoEl.removeAttribute('src');
            videoEl.load();
        }
    }

    // Mark completion when a video ends -> unlock next (only on lesson pages)
    if (accordion && videoEl) {
        videoEl.addEventListener('ended', async () => {
            if (currentIndex >= completedUntil) {
                completedUntil = currentIndex + 1;
                // Save progress to server
                const lessonFullyCompleted = completedUntil >= videoSources.length;
                await saveProgressToServer(completedUntil, lessonFullyCompleted);
                
                if (lessonFullyCompleted) {
                    isLessonCompleted = true;
                }
                
                updateLocks();
                checkAndShowUnlockCta();
            }
        });
    }

    playbackRate?.addEventListener('change', () => {
        if (videoEl) videoEl.playbackRate = Number(playbackRate.value);
    });

    pipBtn?.addEventListener('click', async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (videoEl.requestPictureInPicture) {
                await videoEl.requestPictureInPicture();
            }
        } catch (e) {}
    });

    fsBtn?.addEventListener('click', async () => {
        const container = viewer?.querySelector('.viewer-panel');
        try {
            if (!document.fullscreenElement) {
                await container.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (e) {}
    });

    const body = document.body;

    // Settings Sidebar Functionality
    function openSettings() {
        if (settingsSidebar && settingsOverlay) {
            settingsSidebar.classList.add('open');
            settingsOverlay.hidden = false;
            settingsOverlay.classList.add('visible');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeSettings() {
        if (settingsSidebar && settingsOverlay) {
            settingsSidebar.classList.remove('open');
            settingsOverlay.classList.remove('visible');
            setTimeout(() => {
                settingsOverlay.hidden = true;
                document.body.style.overflow = '';
            }, 300);
        }
    }

    // Settings event listeners
    settingsToggle?.addEventListener('click', openSettings);
    settingsClose?.addEventListener('click', closeSettings);
    settingsOverlay?.addEventListener('click', closeSettings);

    // Close settings on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsSidebar?.classList.contains('open')) {
            closeSettings();
        }
    });

    // Page theme toggle functionality
    function setPageTheme(isDark) {
        body.classList.toggle('dark-mode', isDark);
        const label = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
        if (themeToggle) themeToggle.textContent = label;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        const currentUndertone = (undertonePicker && undertonePicker.value) ? undertonePicker.value : getComputedStyle(document.documentElement).getPropertyValue('--undertone-color') || '#667eea';
        applyDynamicPalette(String(currentUndertone).trim());
        // Refresh particles and other theme-dependent elements
        if (window.particleSystem) {
            window.particleSystem.particles.forEach(p => {
                // Update particle colors for new theme
                p.opacity = Math.random() * 0.8 + 0.4;
            });
        }
        // Update star effects
        updateThemeEffects();
    }

    themeToggle?.addEventListener('click', function() {
        setPageTheme(!body.classList.contains('dark-mode'));
    });

    // Undertone color picker functionality
    undertonePicker?.addEventListener('input', function() {
        const color = this.value;
        document.documentElement.style.setProperty('--undertone-color', color);
        localStorage.setItem('undertone', color);
        if (undertoneHex) undertoneHex.textContent = color.toLowerCase();
        applyDynamicPalette(color);
    });

    // Clicking the palette button opens the color picker
    undertonePaletteBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        undertonePicker?.click();
    });
    undertonePaletteBtn?.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        const hex = undertonePicker?.value || '#667eea';
        try {
            await navigator.clipboard.writeText(hex);
            undertonePaletteBtn.title = `Copied ${hex}`;
            setTimeout(() => { undertonePaletteBtn.title = 'Undertone palette'; }, 1000);
        } catch (_) {}
    });

    // Load saved theme and undertone from localStorage
    const savedTheme = localStorage.getItem('theme');
    const savedUndertone = localStorage.getItem('undertone');
    const savedViewerTheme = localStorage.getItem('viewerTheme'); // legacy; now unused

    if (savedTheme) {
        body.classList.toggle('dark-mode', savedTheme === 'dark');
        const label = savedTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
        if (themeToggle) themeToggle.textContent = label;
    } else {
        // Default to dark mode if no theme saved
        body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        if (themeToggle) themeToggle.textContent = '☀️ Light Mode';
    }


    // Remove legacy viewer theme state if present
    if (savedViewerTheme) localStorage.removeItem('viewerTheme');

    if (savedUndertone) {
        document.documentElement.style.setProperty('--undertone-color', savedUndertone);
        undertonePicker.value = savedUndertone;
        if (undertoneHex) undertoneHex.textContent = savedUndertone.toLowerCase();
        applyDynamicPalette(savedUndertone);
    }

    // Level click functionality for learning hub
    function showUiModal(message, title = 'Notice') {
        const overlay = document.getElementById('ui-modal');
        const titleEl = document.getElementById('ui-modal-title');
        const msgEl = document.getElementById('ui-modal-msg');
        const okBtn = document.getElementById('ui-modal-ok');
        if (!overlay || !titleEl || !msgEl || !okBtn) {
            alert(message);
            return;
        }
        titleEl.textContent = title;
        msgEl.textContent = message;
        overlay.hidden = false;
        function close() {
            overlay.hidden = true;
            okBtn.removeEventListener('click', close);
        }
        okBtn.addEventListener('click', close);
        // Also close on overlay click
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); }, { once: true });
    }

    // Modified level click handler for server-side progress
    window.handleLevelClick = async function(level) {
        const allProgress = await loadAllProgressFromServer();
        const completedLevels = allProgress.completedLevels || [];
        
        // Check if level is unlocked based on previous level completion or if it's level 1
        let isUnlocked = false;
        if (level === 1) {
            isUnlocked = true; // Level 1 is always unlocked
        } else if (level === 2) {
            // Level 2 is unlocked if lesson 1 is completed
            isUnlocked = allProgress.lesson1Completed === '1' || completedLevels.includes(1);
        } else if (level === 3) {
            // Level 3 is unlocked if lesson 2 is completed
            isUnlocked = allProgress.lesson2Completed === '1' || completedLevels.includes(2);
        } else if (level === 4) {
            // Level 4 (test) is unlocked if lesson 3 is completed
            isUnlocked = allProgress.lesson3Completed === '1' || completedLevels.includes(3);
        }
        
        if (isUnlocked) {
            if (level === 1) {
                window.location.href = '/lesson1';
                return;
            } else if (level === 2) {
                window.location.href = '/lesson2';
                return;
            } else if (level === 3) {
                window.location.href = '/lesson3';
                return;
            } else if (level === 4) {
                // Double-check lesson 3 completion before allowing test access
                const lesson3Completed = allProgress.lesson3Completed === '1';
                if (lesson3Completed) {
                    window.location.href = '/test1';
                    return;
                } else {
                    showUiModal('Complete Lesson 3 (Numbers 0-9) first to unlock the test!', 'Test Locked');
                    return;
                }
            }
            showUiModal(`Redirecting to Level ${level}...`);
        } else {
            if (level === 4) {
                // Special message for test level
                showUiModal('Complete Lesson 3 (Numbers 0-9) first to unlock the test!', 'Test Locked');
            } else {
                showUiModal('This level is locked. Complete the previous levels first.');
            }
        }
    };

    // Update level locks based on completed levels
    async function updateLevelLocks() {
        const allProgress = await loadAllProgressFromServer();
        const completedLevels = allProgress.completedLevels || [];
        const levels = document.querySelectorAll('.level');

        levels.forEach((level, index) => {
            const levelNumber = index + 1;
            let isUnlocked = false;
            
            // Determine if level should be unlocked
            if (levelNumber === 1) {
                isUnlocked = true; // Level 1 is always unlocked
            } else if (levelNumber === 2) {
                // Level 2 is unlocked if lesson 1 is completed
                isUnlocked = allProgress.lesson1Completed === '1' || completedLevels.includes(1);
            } else if (levelNumber === 3) {
                // Level 3 is unlocked if lesson 2 is completed
                isUnlocked = allProgress.lesson2Completed === '1' || completedLevels.includes(2);
            } else if (levelNumber === 4) {
                // Level 4 (test) is unlocked if lesson 3 is completed
                isUnlocked = allProgress.lesson3Completed === '1' || completedLevels.includes(3);
            }
            
            // Apply unlocked/locked classes
            if (isUnlocked) {
                level.classList.remove('locked');
                level.classList.add('unlocked');
            } else {
                level.classList.remove('unlocked');
                level.classList.add('locked');
            }
            
            // Mark lessons as completed if flagged
            if (levelNumber === 1) {
                if (allProgress.lesson1Completed === '1') level.classList.add('completed');
                else level.classList.remove('completed');
            }
            if (levelNumber === 2) {
                if (allProgress.lesson2Completed === '1') level.classList.add('completed');
                else level.classList.remove('completed');
            }
            if (levelNumber === 3) {
                if (allProgress.lesson3Completed === '1') level.classList.add('completed');
                else level.classList.remove('completed');
            }
        });
    }

    // Initialize level locks
    if (document.querySelector('.level')) {
        updateLevelLocks();
    }

    // Load progress from server when on lesson pages
    if (accordion) {
        loadProgressFromServer();
    }

    // Rest of the original script.js functionality follows...
    // (Copy all the theme, visual effects, and other functions from original script.js)
    // Truncated for brevity - you would copy the rest of the original script.js here
    
    // Add click animation to levels
    const levels = document.querySelectorAll('.level');

    levels.forEach(level => {
        level.addEventListener('click', function(e) {
            if (!this.classList.contains('locked')) {
                // Create ripple effect
                const ripple = document.createElement('span');
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;

                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                ripple.classList.add('ripple');

                this.appendChild(ripple);

                setTimeout(() => {
                    ripple.remove();
                }, 600);
            }
        });
    });

    // Add CSS for ripple effect
    const style = document.createElement('style');
    style.textContent = `
        .level {
            position: relative;
            overflow: hidden;
        }

        .ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.6);
            transform: scale(0);
            animation: ripple-animation 0.6s linear;
            pointer-events: none;
        }

        @keyframes ripple-animation {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }

        /* Space theme background animation */
        body {
            animation: space-background 20s ease-in-out infinite alternate;
        }

        @keyframes space-background {
            0% {
                background-position: 0% 0%;
            }
            100% {
                background-position: 100% 100%;
            }
        }
    `;
    document.head.appendChild(style);

    // Settings dropdown functionality (removed since it was causing issues)

    // Theme functionality (handled by main theme toggle above)


    // Undertone color picker functionality
    undertonePicker?.addEventListener('input', function() {
        const color = this.value;
        document.documentElement.style.setProperty('--undertone-color', color);
        localStorage.setItem('undertone', color);
        if (undertoneHex) undertoneHex.textContent = color.toLowerCase();
    });

    function hexToHsl(hex) {
        const { r, g, b } = hexToRgb(hex);
        const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
        const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
        let h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
                case gNorm: h = (bNorm - rNorm) / d + 2; break;
                default: h = (rNorm - gNorm) / d + 4; break;
            }
            h /= 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    function hexToRgb(hex) {
        let h = hex.replace('#', '');
        if (h.length === 3) {
            h = h.split('').map(x => x + x).join('');
        }
        const num = parseInt(h, 16);
        return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }

    function applyDynamicPalette(hex) {
        const { h, s, l } = hexToHsl(hex);
        // Derive analogous hues and soft tints for background accents
        const hueA = (h + 20) % 360;
        const hueB = (h + 300) % 360; // -60 deg
        const accent1 = `hsla(${hueA}, ${Math.min(78, s + 14)}%, ${Math.min(85, l + 24)}%, 0.32)`;
        const accent2 = `hsla(${hueB}, ${Math.min(72, s + 8)}%, ${Math.max(35, l - 2)}%, 0.26)`;
        const accent3 = `hsla(${h}, ${Math.max(42, s - 18)}%, ${Math.min(94, l + 32)}%, 0.20)`;
        document.documentElement.style.setProperty('--bg-accent-1', accent1);
        document.documentElement.style.setProperty('--bg-accent-2', accent2);
        document.documentElement.style.setProperty('--bg-accent-3', accent3);

        // Dark mode accents: deeper, more saturated, lower lightness
        const dmHueA = (h + 15) % 360;
        const dmHueB = (h + 300) % 360;
        const dm1 = `hsla(${dmHueA}, ${Math.min(85, s + 20)}%, ${Math.max(22, l - 30)}%, 0.35)`;
        const dm2 = `hsla(${dmHueB}, ${Math.min(80, s + 15)}%, ${Math.max(20, l - 35)}%, 0.32)`;
        const dm3 = `hsla(${(h + 180) % 360}, ${Math.max(50, s)}%, ${Math.max(25, 60 - l)}%, 0.28)`;
        document.documentElement.style.setProperty('--dm-accent-1', dm1);
        document.documentElement.style.setProperty('--dm-accent-2', dm2);
        document.documentElement.style.setProperty('--dm-accent-3', dm3);
    }
    
    // ===============================
    // OPTIMIZED PARTICLE SYSTEM
    // ===============================
    
    // Performance-optimized particle system
    class OptimizedParticleSystem {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas ? canvas.getContext('2d') : null;
            this.particles = [];
            this.maxParticles = 80; // Increased count for better visibility
            this.animationId = null;
            this.lastTime = 0;
            this.targetFPS = 60; // Improved FPS for smoother animation
            this.frameInterval = 1000 / this.targetFPS;
            
            if (this.canvas && this.ctx) {
                this.initCanvas();
                this.createParticles();
                this.startAnimation();
            }
        }
        
        initCanvas() {
            const resizeCanvas = () => {
                // Use full viewport dimensions for better coverage
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
            };
            
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
            
            // Set canvas context properties for better performance
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.willReadFrequently = false;
        }
        
        createParticles() {
            for (let i = 0; i < this.maxParticles; i++) {
                this.particles.push(this.createParticle());
            }
        }
        
        createParticle() {
            return {
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 6 + 3, // Even larger particles for better visibility
                speedX: (Math.random() - 0.5) * 1.5, // More movement
                speedY: (Math.random() - 0.5) * 1.5,
                opacity: Math.random() * 0.9 + 0.5, // Higher base opacity
                life: Math.random() * 400 + 250, // Longer life
                color: {
                    r: 255,
                    g: 255,
                    b: 255
                }
            };
        }
        
        updateParticle(particle) {
            particle.x += particle.speedX;
            particle.y += particle.speedY;
            particle.life--;
            
            // Boundary wrapping
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            if (particle.y > this.canvas.height) particle.y = 0;
            
            // Respawn particle when life ends
            if (particle.life <= 0) {
                Object.assign(particle, this.createParticle());
            }
        }
        
        renderParticle(particle) {
            // Add glow effect like original
            this.ctx.save();
            
            // Outer glow
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.opacity * 0.2})`;
            this.ctx.fill();
            
            // Inner glow
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * 1.5, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.opacity * 0.4})`;
            this.ctx.fill();
            
            // Core particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.opacity})`;
            this.ctx.fill();
            
            // Enhanced shadow glow for better visibility
            this.ctx.shadowColor = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, 0.9)`;
            this.ctx.shadowBlur = particle.size * 3;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.opacity * 0.95})`;
            this.ctx.fill();
            
            // Add extra glow ring for prominence
            this.ctx.shadowBlur = particle.size * 4;
            this.ctx.shadowColor = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, 0.6)`;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * 0.3, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.opacity})`;
            this.ctx.fill();
            
            this.ctx.restore();
        }
        
        animate(currentTime) {
            if (!this.ctx || !this.canvas) return;
            
            // Frame rate limiting
            if (currentTime - this.lastTime < this.frameInterval) {
                this.animationId = requestAnimationFrame((time) => this.animate(time));
                return;
            }
            
            this.lastTime = currentTime;
            
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Animate in both modes, but with different intensities
            const isDarkMode = document.body.classList.contains('dark-mode');
            
            // Update and render particles
            for (let particle of this.particles) {
                // Adjust particle opacity based on theme
                const originalOpacity = particle.opacity;
                if (!isDarkMode) {
                    particle.opacity *= 0.7; // More visible in light mode
                }
                
                this.updateParticle(particle);
                this.renderParticle(particle);
                
                // Restore original opacity
                particle.opacity = originalOpacity;
            }
            
            this.animationId = requestAnimationFrame((time) => this.animate(time));
        }
        
        startAnimation() {
            if (!this.animationId) {
                this.animationId = requestAnimationFrame((time) => this.animate(time));
            }
        }
        
        stopAnimation() {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }
        
        destroy() {
            this.stopAnimation();
            this.particles = [];
        }
    }
    
    // Initialize optimized particle system
    let particleSystem = null;
    if (particleCanvas) {
        particleSystem = new OptimizedParticleSystem(particleCanvas);
    }
    
    // Star sparkles generation (very small twinkling stars)
    function createStarSparkles() {
        if (!starSparkles) return;
        
        const sparkleCount = 120; // More tiny dot stars for better effect
        starSparkles.innerHTML = '';
        
        for (let i = 0; i < sparkleCount; i++) {
            const sparkle = document.createElement('div');
            const size = Math.random() * 0.3 + 0.5; // Tiny dots: 0.5px to 0.8px
            const isTiny = size < 0.6;
            const isSmall = size < 0.7;
            
            sparkle.className = `sparkle${isTiny ? ' tiny' : isSmall ? ' small' : ''}`;
            sparkle.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                border-radius: 50%;
                background: radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 30%, rgba(255,255,255,0) 60%);
                box-shadow: 0 0 ${isTiny ? '1px' : isSmall ? '1.2px' : '1.5px'} rgba(255,255,255,${isTiny ? '0.4' : isSmall ? '0.45' : '0.5'});
                opacity: ${0.4 + Math.random() * 0.6};
                animation: sparkle-twinkle ${1.5 + Math.random() * 3}s ease-in-out infinite;
                will-change: opacity, transform, filter;
                transform: translateZ(0);
                filter: brightness(${0.9 + Math.random() * 0.3});
            `;
            sparkle.style.setProperty('--sparkle-brightness', 0.9 + Math.random() * 0.3);
            sparkle.style.setProperty('--sparkle-opacity', 0.4 + Math.random() * 0.6);
            
            starSparkles.appendChild(sparkle);
        }
    }
    
    // Panel stars generation (very small twinkling stars)
    function createPanelStars() {
        if (!panelStarsInner) return;
        
        const starCount = 40; // More tiny dot stars
        panelStarsInner.innerHTML = '';
        
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            const size = Math.random() * 0.3 + 0.5; // Tiny dots: 0.5px to 0.8px
            star.className = 'panel-star';
            star.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.6) 60%);
                border-radius: 50%;
                animation: panel-star-twinkle ${1.2 + Math.random() * 2.5}s ease-in-out infinite;
                will-change: opacity, transform;
                transform: translateZ(0);
                box-shadow: 0 0 1px rgba(255,255,255,0.5);
            `;
            panelStarsInner.appendChild(star);
        }
    }
    
    
    // Light mode flower particles (like original)
    function createLightModeFlowers() {
        if (!panelStarsInner) return;
        
        const flowerCount = 12;
        panelStarsInner.innerHTML = '';
        
        for (let i = 0; i < flowerCount; i++) {
            const flower = document.createElement('div');
            flower.className = 'flower';
            flower.style.cssText = `
                position: absolute;
                top: -10%;
                left: ${Math.random() * 100}%;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.8) 35%, rgba(255,255,255,0) 70%);
                box-shadow: 0 0 8px rgba(255,255,255,0.65);
                opacity: 0.9;
                filter: saturate(1.05) brightness(1.05);
                animation: flower-fall ${8 + Math.random() * 4}s linear infinite;
                animation-delay: ${Math.random() * 8}s;
                will-change: transform, opacity;
            `;
            panelStarsInner.appendChild(flower);
        }
    }
    
    // Update effects when theme changes
    function updateThemeEffects() {
        // Delay to let theme change take effect
        setTimeout(() => {
            if (document.body.classList.contains('dark-mode')) {
                createStarSparkles();
                createPanelStars();
            } else {
                if (starSparkles) starSparkles.innerHTML = '';
                if (panelStarsInner) createLightModeFlowers();
            }
        }, 100);
    }
    
    // Initialize appropriate effects based on current theme
    if (document.body.classList.contains('dark-mode')) {
        createStarSparkles();
        createPanelStars();
    } else {
        createLightModeFlowers();
    }
});
