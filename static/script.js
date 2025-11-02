// DOM Content Loaded Event
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
    const progressKey = isLesson3 ? 'lesson3_completedUntil' : isLesson2 ? 'lesson2_completedUntil' : 'lesson1_completedUntil';
    let completedUntil = Number(localStorage.getItem(progressKey) || 0); // index-based, inclusive

    // Show unlock CTA for lesson 1 when done (on load) and handle click
    const unlockLesson2Btn = document.getElementById('unlock-lesson2-btn');
    const unlockAfterLesson2Btn = document.getElementById('unlock-after-lesson2-btn');
    const unlockAfterLesson3Btn = document.getElementById('unlock-after-lesson3-btn');
    function checkAndShowUnlockCta() {
        // Lesson 1 button enablement
        if (unlockLesson2Btn) {
            const lastIndex1 = videoSources.length - 1;
            const lesson1CompletedFlag = localStorage.getItem('lesson1Completed') === '1';
            if (lesson1CompletedFlag || (!isLesson2 && completedUntil >= lastIndex1)) {
                unlockLesson2Btn.disabled = false;
            }
        }
        // Lesson 2 button enablement
        if (unlockAfterLesson2Btn) {
            const lastIndex2 = videoSources.length - 1;
            const lesson2CompletedFlag = localStorage.getItem('lesson2Completed') === '1';
            if (lesson2CompletedFlag || (isLesson2 && completedUntil >= lastIndex2)) {
                unlockAfterLesson2Btn.disabled = false;
            }
        }
        // Lesson 3 button enablement
        if (unlockAfterLesson3Btn) {
            const lastIndex3 = videoSources.length - 1;
            const lesson3CompletedFlag = localStorage.getItem('lesson3Completed') === '1';
            if (lesson3CompletedFlag || (isLesson3 && completedUntil >= lastIndex3)) {
                unlockAfterLesson3Btn.disabled = false;
            }
        }
    }

    unlockLesson2Btn?.addEventListener('click', () => {
        // Persist lesson 1 completion and unlock next
        localStorage.setItem('lesson1Completed', '1');
        const completedLevels = JSON.parse(localStorage.getItem('completedLevels') || '[]');
        if (!completedLevels.includes(1)) {
            completedLevels.push(1);
            localStorage.setItem('completedLevels', JSON.stringify(completedLevels));
        }
        window.location.href = '/learning-hub';
    });

    unlockAfterLesson2Btn?.addEventListener('click', () => {
        // Persist lesson 2 completion as well, then return home
        localStorage.setItem('lesson2Completed', '1');
        const completedLevels = JSON.parse(localStorage.getItem('completedLevels') || '[]');
        if (!completedLevels.includes(2)) {
            completedLevels.push(2);
            localStorage.setItem('completedLevels', JSON.stringify(completedLevels));
        }
        window.location.href = '/learning-hub';
    });

    unlockAfterLesson3Btn?.addEventListener('click', () => {
        // Persist lesson 3 completion and redirect
        localStorage.setItem('lesson3Completed', '1');
        const completedLevels = JSON.parse(localStorage.getItem('completedLevels') || '[]');
        if (!completedLevels.includes(3)) {
            completedLevels.push(3);
            localStorage.setItem('completedLevels', JSON.stringify(completedLevels));
        }
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
        videoEl.src = videoSources[currentIndex];
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
    if (accordion) updateLocks();
    // After locks update, ensure unlock CTA enablement
    checkAndShowUnlockCta();

    // Mark completion when a video ends -> unlock next (only on lesson pages)
    if (accordion && videoEl) {
        videoEl.addEventListener('ended', () => {
            if (currentIndex >= completedUntil) {
                completedUntil = currentIndex + 1;
                localStorage.setItem(progressKey, String(completedUntil));
                updateLocks();
                // If all parts done, mark lesson completed and unlock next on main page
                if (completedUntil >= videoSources.length - 1) {
                    const completionFlag = isLesson3 ? 'lesson3Completed' : isLesson2 ? 'lesson2Completed' : 'lesson1Completed';
                    const levelNumber = isLesson3 ? 3 : isLesson2 ? 2 : 1;
                    localStorage.setItem(completionFlag, '1');
                    const completedLevels = JSON.parse(localStorage.getItem('completedLevels') || '[]');
                    if (!completedLevels.includes(levelNumber)) {
                        completedLevels.push(levelNumber);
                        localStorage.setItem('completedLevels', JSON.stringify(completedLevels));
                    }
                    // Enable appropriate footer button
                    if (!isLesson2 && unlockLesson2Btn) unlockLesson2Btn.disabled = false;
                    if (isLesson2 && unlockAfterLesson2Btn) unlockAfterLesson2Btn.disabled = false;
                    if (isLesson3 && unlockAfterLesson3Btn) unlockAfterLesson3Btn.disabled = false;
                }
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
    const particleCtx = (particleCanvas && particleCanvas.getContext) ? particleCanvas.getContext('2d') : null;
    const parallaxLayer = document.querySelector('.parallax-layer');
    const glowA = document.querySelector('.glow-a');
    const glowB = document.querySelector('.glow-b');
    const cometLayer = document.querySelector('.comet-layer');
    const starSparkles = document.getElementById('star-sparkles');
    const panelStars = document.getElementById('panel-stars');
    const panelStarsInner = document.getElementById('panel-stars-inner');
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

    // (Removed: any logic that resets or scopes progress by user/query params)

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

    // Keep palette button swatches updated
    function refreshUndertonePaletteVisuals() {
        const base = getComputedStyle(document.documentElement).getPropertyValue('--undertone-color').trim() || undertonePicker.value;
        const a = getComputedStyle(document.documentElement).getPropertyValue('--bg-accent-1').trim();
        const b = getComputedStyle(document.documentElement).getPropertyValue('--bg-accent-2').trim();
        const btn = undertonePaletteBtn;
        if (!btn) return;
        btn.style.borderColor = base;
        const sBase = btn.querySelector('.swatch.base');
        const sA = btn.querySelector('.swatch.a');
        const sB = btn.querySelector('.swatch.b');
        if (sBase) sBase.style.background = base;
        if (sA) sA.style.background = a;
        if (sB) sB.style.background = b;
    }

    // --------- Interactive Sparkle Stars (dark mode) ---------
    let sparkleNodes = [];
    const MAX_SPARKLES = 400; // total count, tiny dot stars

    function createSparkles() {
        if (!starSparkles) return;
        starSparkles.innerHTML = '';
        sparkleNodes = [];
        const width = window.innerWidth;
        const height = window.innerHeight;
        const count = Math.round(MAX_SPARKLES * (Math.min(1.4, Math.max(0.6, (width * height) / (1440*900)))));
        for (let i = 0; i < count; i++) {
            const node = document.createElement('div');
            node.className = 'sparkle';
            // random size category - tiny dot stars 0.5-0.8px
            const k = Math.random();
            let size = Math.random() * 0.3 + 0.5; // 0.5-0.8px for all stars
            if (k < 0.4) { node.classList.add('tiny'); }
            else if (k < 0.8) { /* normal */ }
            else { node.classList.add('large'); }
            node.style.width = size + 'px';
            node.style.height = size + 'px';
            const x = Math.random() * width;
            const y = Math.random() * height;
            node.style.left = x + 'px';
            node.style.top = y + 'px';
            const baseOpacity = 0.5 + Math.random() * 0.5; // 0.5..1
            node.style.setProperty('--sparkle-opacity', String(baseOpacity));
            const baseBrightness = 0.9 + Math.random() * 0.4; // 0.9..1.3
            node.style.setProperty('--sparkle-brightness', String(baseBrightness));
            // soft random twinkle
            node.animate([
                { filter: `brightness(${baseBrightness})`, opacity: baseOpacity },
                { filter: `brightness(${baseBrightness * (1.15 + Math.random() * 0.2)})`, opacity: Math.min(1, baseOpacity * (1.05 + Math.random() * 0.15)) },
                { filter: `brightness(${baseBrightness})`, opacity: baseOpacity }
            ], { duration: 2000 + Math.random() * 2000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
            starSparkles.appendChild(node);
            sparkleNodes.push({ el: node, x, y, baseOpacity, baseBrightness, size });
        }
    }

    function destroySparkles() {
        if (!starSparkles) return;
        starSparkles.innerHTML = '';
        sparkleNodes = [];
    }

    function refreshSparklesForTheme() {
        const isDark = document.body.classList.contains('dark-mode');
        if (isDark) createSparkles(); else destroySparkles();
    }

    // Cursor proximity glow
    window.addEventListener('mousemove', (e) => {
        if (!sparkleNodes.length) return;
        const cx = e.clientX, cy = e.clientY;
        const radius = 120; // px influence radius
        const radius2 = radius * radius;
        for (let i = 0; i < sparkleNodes.length; i++) {
            const s = sparkleNodes[i];
            const dx = s.x - cx;
            const dy = s.y - cy;
            const d2 = dx*dx + dy*dy;
            if (d2 < radius2) {
                const k = 1 - d2 / radius2; // 0..1
                const glow = 1 + k * 0.8; // up to 1.8x brighter
                const op = Math.min(1, s.baseOpacity + k * 0.4);
                s.el.style.setProperty('--sparkle-brightness', String(s.baseBrightness * glow));
                s.el.style.setProperty('--sparkle-opacity', String(op));
                s.el.style.boxShadow = `0 0 ${1 + 1.5*k}px rgba(255,255,255,${0.3 + 0.2*k})`;
            } else {
                s.el.style.setProperty('--sparkle-brightness', String(s.baseBrightness));
                s.el.style.setProperty('--sparkle-opacity', String(s.baseOpacity));
                s.el.style.boxShadow = '0 0 1.5px rgba(255,255,255,0.4)';
            }
        }
    });

    // Rebuild sparkles on resize
    window.addEventListener('resize', () => {
        if (!document.body.classList.contains('dark-mode')) return;
        createSparkles();
    });

    // Page theme toggle (affects entire page only)
    function setPageTheme(isDark) {
        body.classList.toggle('dark-mode', isDark);
        const label = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
        if (themeToggle) themeToggle.textContent = label;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        const currentUndertone = (undertonePicker && undertonePicker.value) ? undertonePicker.value : getComputedStyle(document.documentElement).getPropertyValue('--undertone-color') || '#667eea';
        applyDynamicPalette(String(currentUndertone).trim());
        restartParticles();
        refreshSparklesForTheme();
        // Rebuild panel decoration (stars in dark, flowers in light)
        initPanelStars();
        // Adapt undertone chip to current mode by re-setting text (CSS handles visuals)
        if (undertoneHex && undertonePicker) undertoneHex.textContent = undertonePicker.value.toLowerCase();
    }

    themeToggle?.addEventListener('click', function() {
        setPageTheme(!body.classList.contains('dark-mode'));
    });

    // No viewer theme toggle anymore

    // Undertone color picker functionality
    undertonePicker?.addEventListener('input', function() {
        const color = this.value;
        document.documentElement.style.setProperty('--undertone-color', color);
        localStorage.setItem('undertone', color);
        if (undertoneHex) undertoneHex.textContent = color.toLowerCase();
        applyDynamicPalette(color);
        restartParticles();
        refreshUndertonePaletteVisuals();
        // Rebuild panel decoration so flower glow updates to new undertone
        initPanelStars();
    });

    // Clicking the palette button opens the color picker; secondary click copies hex
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

    // Level click functionality
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
    window.handleLevelClick = function(level) {
        const completedLevels = JSON.parse(localStorage.getItem('completedLevels')) || [];
        
        // Check if level is unlocked based on previous level completion or if it's level 1
        let isUnlocked = false;
        if (level === 1) {
            isUnlocked = true; // Level 1 is always unlocked
        } else if (level === 2) {
            // Level 2 is unlocked if lesson 1 is completed
            isUnlocked = localStorage.getItem('lesson1Completed') === '1' || completedLevels.includes(1);
        } else if (level === 3) {
            // Level 3 is unlocked if lesson 2 is completed
            isUnlocked = localStorage.getItem('lesson2Completed') === '1' || completedLevels.includes(2);
        } else if (level === 4) {
            // Level 4 (test) is unlocked if lesson 2 is completed
            isUnlocked = localStorage.getItem('lesson2Completed') === '1' || completedLevels.includes(2);
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
                // Check if lesson 2 is completed before allowing test access
                const lesson2Completed = localStorage.getItem('lesson2Completed') === '1';
                if (lesson2Completed) {
                    window.location.href = 'test1.html';
                    return;
                } else {
                    showUiModal('Complete Lesson 2 (P-Z alphabets) first to unlock the test!', 'Test Locked');
                    return;
                }
            }
            showUiModal(`Redirecting to Level ${level}...`);
        } else {
            if (level === 4) {
                // Special message for test level
                showUiModal('Complete Lesson 2 (P-Z alphabets) first to unlock the test!', 'Test Locked');
            } else {
                showUiModal('This level is locked. Complete the previous levels first.');
            }
        }
    };

    // Simulate completing a level (for demo purposes)
    // In a real app, this would be triggered after completing a lesson
    function completeLevel(level) {
        const completedLevels = JSON.parse(localStorage.getItem('completedLevels')) || [];
        if (!completedLevels.includes(level)) {
            completedLevels.push(level);
            localStorage.setItem('completedLevels', JSON.stringify(completedLevels));
            updateLevelLocks();
        }
    }

    // Update level locks based on completed lessons
    function updateLevelLocks() {
        const completedLevels = JSON.parse(localStorage.getItem('completedLevels')) || [];
        const levels = document.querySelectorAll('.level');

        levels.forEach((level, index) => {
            const levelNumber = index + 1;
            let isUnlocked = false;
            
            // Determine if level should be unlocked
            if (levelNumber === 1) {
                isUnlocked = true; // Level 1 is always unlocked
            } else if (levelNumber === 2) {
                // Level 2 is unlocked if lesson 1 is completed
                isUnlocked = localStorage.getItem('lesson1Completed') === '1' || completedLevels.includes(1);
            } else if (levelNumber === 3) {
                // Level 3 is unlocked if lesson 2 is completed
                isUnlocked = localStorage.getItem('lesson2Completed') === '1' || completedLevels.includes(2);
            } else if (levelNumber === 4) {
                // Level 4 (test) is unlocked if lesson 2 is completed
                isUnlocked = localStorage.getItem('lesson2Completed') === '1' || completedLevels.includes(2);
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
                if (localStorage.getItem('lesson1Completed') === '1') level.classList.add('completed');
                else level.classList.remove('completed');
            }
            if (levelNumber === 2) {
                if (localStorage.getItem('lesson2Completed') === '1') level.classList.add('completed');
                else level.classList.remove('completed');
            }
            if (levelNumber === 3) {
                if (localStorage.getItem('lesson3Completed') === '1') level.classList.add('completed');
                else level.classList.remove('completed');
            }
        });
    }

    // Initialize level locks
    updateLevelLocks();

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

    // Compute a harmonious light-mode palette from undertone
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

        // Defaults for dark-mode controls (user-tunable)
        if (!document.documentElement.style.getPropertyValue('--dm-blob-alpha')) {
            document.documentElement.style.setProperty('--dm-blob-alpha', '0.6');
        }
        if (!document.documentElement.style.getPropertyValue('--dm-blob-size')) {
            document.documentElement.style.setProperty('--dm-blob-size', '65vmax');
        }
        if (!document.documentElement.style.getPropertyValue('--dm-anim-speed')) {
            document.documentElement.style.setProperty('--dm-anim-speed', '1');
        }
        if (!document.documentElement.style.getPropertyValue('--dm-stars-opacity')) {
            document.documentElement.style.setProperty('--dm-stars-opacity', '0.8');
        }

        // Heading color in light mode: undertone slightly darker
        const lightHeading = `hsl(${h}, ${Math.min(90, s + 5)}%, ${Math.max(20, l - 12)}%)`;
        const isDark = document.body.classList.contains('dark-mode');
        if (!isDark) {
            document.documentElement.style.setProperty('--heading-color', lightHeading);
        }
        // Update palette button visuals when palette changes
        refreshUndertonePaletteVisuals();
    }

    // -------- Particles along spine --------
    let particles = [];
    let animationId = null;
    let lastTimestamp = 0;
    const MAX_PARTICLES = 120;
    const PERF_MAX_PARTICLES = 40;
    const SPEED = 22; // px/sec base
    const PERF_SPEED = 14;

    function resizeCanvas() {
        if (!particleCanvas || !particleCtx) return;
        const rect = document.querySelector('.glass-panel')?.getBoundingClientRect();
        const section = document.querySelector('.levels-section')?.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = (rect?.width || 560);
        const height = (section?.height || window.innerHeight);
        particleCanvas.width = Math.floor(width * dpr);
        particleCanvas.height = Math.floor(height * dpr);
        particleCanvas.style.width = width + 'px';
        particleCanvas.style.height = height + 'px';
        particleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function generateParticles() {
        particles = new Array(MAX_PARTICLES).fill(0).map(() => spawnParticle());
    }

    function spawnParticle() {
        const spineX = (particleCanvas?.width || 0) / (window.devicePixelRatio || 1) / 2;
        const hue = hexToHsl(undertonePicker.value).h;
        const isDark = document.body.classList.contains('dark-mode');
        const alpha = isDark ? 0.9 : 0.6;
        const size = Math.random() * 3 + 1;
        const color = `hsla(${hue}, 80%, ${isDark ? 80 : 45}%, ${alpha})`;
        return {
            x: spineX + (Math.random() * 20 - 10),
            y: Math.random() * (particleCanvas?.height || 0) / (window.devicePixelRatio || 1),
            vx: Math.sin(Math.random() * Math.PI * 2) * 4,
            vy: (Math.random() * 0.5 + 0.3),
            size,
            color,
            glow: isDark
        };
    }

    function drawParticles(dt) {
        if (!particleCanvas || !particleCtx) return;
        const speed = SPEED;
        particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        particles.forEach(p => {
            p.y += p.vy * speed * dt;
            p.x += p.vx * 0.1 * dt;
            if (p.y > (particleCanvas.height / (window.devicePixelRatio || 1))) {
                p.y = -10;
                p.x = (particleCanvas.width / (window.devicePixelRatio || 1)) / 2 + (Math.random() * 20 - 10);
            }
            if (p.glow) {
                particleCtx.shadowBlur = 10;
                particleCtx.shadowColor = p.color;
            } else {
                particleCtx.shadowBlur = 6;
                particleCtx.shadowColor = p.color;
            }
            particleCtx.fillStyle = p.color;
            particleCtx.beginPath();
            particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            particleCtx.fill();
        });
        particleCtx.shadowBlur = 0;
    }

    function animateParticles(ts) {
        const reduceMotion = localStorage.getItem('reduceMotion') === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) return;
        if (lastTimestamp === 0) lastTimestamp = ts;
        const dt = Math.min(0.05, (ts - lastTimestamp) / 1000);
        lastTimestamp = ts;
        drawParticles(dt);
        animationId = requestAnimationFrame(animateParticles);
    }

    function startParticles() {
        if (!particleCanvas || !particleCtx) return;
        resizeCanvas();
        generateParticles();
        cancelAnimationFrame(animationId);
        lastTimestamp = 0;
        animationId = requestAnimationFrame(animateParticles);
    }

    function stopParticles() {
        cancelAnimationFrame(animationId);
        animationId = null;
        if (particleCtx && particleCanvas) {
            particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        }
    }

    function restartParticles() {
        stopParticles();
        startParticles();
    }

    window.addEventListener('resize', () => {
        if (!particleCanvas || !particleCtx) return;
        resizeCanvas();
        restartParticles();
    });

    // Parallax movement
    window.addEventListener('mousemove', (e) => {
        const rm = localStorage.getItem('reduceMotion') === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (rm) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 10; // -5..5
        const y = (e.clientY / window.innerHeight - 0.5) * 8; // -4..4
        if (glowA) glowA.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        if (glowB) glowB.style.transform = `translate3d(${-x}px, ${-y}px, 0)`;
    });

    // Constellation lines between nearby particles (dark mode only)
    function drawConstellations() {
        if (!particleCanvas || !particleCtx) return;
        if (!document.body.classList.contains('dark-mode')) return;
        const dpr = window.devicePixelRatio || 1;
        const maxDist = 90; // px
        particleCtx.save();
        particleCtx.globalAlpha = 0.25;
        particles.forEach((p, i) => {
            for (let j = i + 1; j < particles.length; j++) {
                const q = particles[j];
                const dx = (p.x - q.x);
                const dy = (p.y - q.y);
                const dist = Math.hypot(dx, dy);
                if (dist < maxDist) {
                    const a = 1 - dist / maxDist;
                    particleCtx.strokeStyle = `rgba(255,255,255,${0.25 * a})`;
                    particleCtx.lineWidth = 1 / dpr;
                    particleCtx.beginPath();
                    particleCtx.moveTo(p.x, p.y);
                    particleCtx.lineTo(q.x, q.y);
                    particleCtx.stroke();
                }
            }
        });
        particleCtx.restore();
    }

    // Override drawParticles to include constellation pass
    const baseDrawParticles = drawParticles;
    drawParticles = function(dt) {
        baseDrawParticles(dt);
        drawConstellations();
    };

    // Comets disabled
    function spawnComet() { return; }
    function spawnStrongComet() { return; }

    // -------- Toggles --------
    // Removed performance toggle UI

    // Removed reduce motion toggle UI

    // Initialize toggles state from storage
    // Init removed toggles no-op

    // Start particles initially
    if (particleCanvas && particleCtx) {
        startParticles();
    }
    refreshSparklesForTheme();

    // -------- Panel stars (inside glass panel on index page) --------
    function initPanelStars() {
        if (!panelStars) return;
        if (!panelStarsInner) return;
        panelStarsInner.innerHTML = '';

        const isDark = document.body.classList.contains('dark-mode');
        if (isDark) {
            // Preserve existing stars behavior in dark mode
            const rect = panelStars.getBoundingClientRect();
            const width = rect.width || 560;
            const height = rect.height || 600;
            const density = Math.max(220, Math.round((width * height) / 3000));
            const frag = document.createDocumentFragment();
            const nodes = [];
            for (let i = 0; i < density; i++) {
                const s = document.createElement('div');
                s.className = 'star twinkle';
                const sizeCategory = Math.random();
                const size = sizeCategory < 0.6 ? (Math.random() * 1.4 + 0.6)
                            : sizeCategory < 0.9 ? (Math.random() * 2.2 + 1.2)
                            : (Math.random() * 3.2 + 1.8);
                s.style.width = size + 'px';
                s.style.height = size + 'px';
                const x = Math.random() * width;
                const y = Math.random() * height;
                s.style.left = x + 'px';
                s.style.top = y + 'px';
                const glow = 0.25 + Math.random() * 0.9;
                const shadow = size > 3 ? 12 : size > 2 ? 9 : 6;
                s.style.boxShadow = `0 0 ${shadow}px rgba(255,255,255,${0.35 + glow * 0.4})`;
                if (Math.random() < 0.35) s.style.animationDuration = (1.4 + Math.random() * 2.4) + 's';
                const speed = 25 + Math.random() * 55; // px/sec
                const angle = (Math.PI / 6) + Math.random() * (Math.PI / 6);
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;
                nodes.push({ el: s, x, y, vx, vy, size });
                frag.appendChild(s);
            }
            panelStarsInner.appendChild(frag);

            let rafId = 0;
            let targetX = 0, targetY = 0;
            let kx = 0, ky = 0;
            const maxShift = 16;
            function animate() {
                kx += (targetX - kx) * 0.18;
                ky += (targetY - ky) * 0.18;
                panelStarsInner.style.transform = `translate(${kx}px, ${ky}px)`;
                rafId = requestAnimationFrame(animate);
            }
            function onMove(e) {
                const r = panelStars.getBoundingClientRect();
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                const dx = (e.clientX - cx) / (r.width / 2);
                const dy = (e.clientY - cy) / (r.height / 2);
                targetX = Math.max(-1, Math.min(1, dx)) * maxShift;
                targetY = Math.max(-1, Math.min(1, dy)) * maxShift;
            }
            const hoverTarget = panelStars.parentElement || panelStars;
            hoverTarget.addEventListener('mouseenter', () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(animate); });
            hoverTarget.addEventListener('mousemove', onMove);
            hoverTarget.addEventListener('mouseleave', () => { targetX = 0; targetY = 0; });

            let driftId = 0;
            let last = 0;
            function drift(ts) {
                if (!last) last = ts;
                const dt = Math.min(0.05, (ts - last) / 1000);
                last = ts;
                const r = panelStars.getBoundingClientRect();
                const w = r.width || 560;
                const h = r.height || 600;
                for (let i = 0; i < nodes.length; i++) {
                    const n = nodes[i];
                    n.x += n.vx * dt;
                    n.y += n.vy * dt;
                    if (n.x > w + 10) n.x = -10; else if (n.x < -10) n.x = w + 10;
                    if (n.y > h + 10) n.y = -10; else if (n.y < -10) n.y = h + 10;
                    n.el.style.left = n.x + 'px';
                    n.el.style.top = n.y + 'px';
                }
                driftId = requestAnimationFrame(drift);
            }
            cancelAnimationFrame(driftId);
            requestAnimationFrame(drift);
            window.addEventListener('resize', () => {
                if (!document.body.contains(panelStars)) return;
                initPanelStars();
            }, { passive: true });
            return;
        }

        // Light mode: spawn delicate flowers falling down with undertone glow
        const rect = panelStars.getBoundingClientRect();
        const width = rect.width || 560;
        const height = rect.height || 600;
        const density = Math.max(120, Math.round((width * height) / 6000)); // fewer than stars
        const hue = hexToHsl(undertonePicker.value).h;
        const frag = document.createDocumentFragment();
        for (let i = 0; i < density; i++) {
            const f = document.createElement('div');
            f.className = 'flower';
            const size = 6 + Math.random() * 6; // 6..12px small
            f.style.width = size + 'px';
            f.style.height = size + 'px';
            const x = Math.random() * width;
            f.style.left = x + 'px';
            // undertone-tinted glow
            const alpha = 0.45 + Math.random() * 0.25;
            f.style.boxShadow = `0 0 ${Math.max(6, size)}px hsla(${hue}, 85%, 60%, ${alpha})`;
            const dur = 4000 + Math.random() * 3500; // 4-7.5s
            f.style.animationDuration = dur + 'ms';
            f.style.animationDelay = (Math.random() * dur) + 'ms';
            frag.appendChild(f);
        }
        panelStarsInner.appendChild(frag);
        // Recreate on resize
        window.addEventListener('resize', () => {
            if (!document.body.contains(panelStars)) return;
            initPanelStars();
        }, { passive: true });
    }

    initPanelStars();

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
});
