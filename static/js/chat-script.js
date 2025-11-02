// Chat application functionality
class ChatApp {
    constructor() {
        this.currentUser = null;
        this.currentChatFriend = null;
        // All chat API endpoints are mounted under the /chat blueprint prefix
        this.API_BASE = '/chat';
        // Connect to the same origin to support custom ports/hosts
        const socketUrl = `${location.protocol}//${location.hostname}${location.port ? ':' + location.port : ''}`;
        this.socket = io(socketUrl);
        this.theme = localStorage.getItem('chatapp_theme') || 'light';
        this._activeMode = null; // 'text-to-sign' | 'sign-to-text' | null
        // Caches to avoid unnecessary re-rendering
        this._lastFriendsSignature = '';
        this._lastRequestsSignature = '';
        this.init();
    }

    // Custom alert modal methods (using logout modal)
    showCustomAlert(message, title = 'Alert') {
        const modal = document.getElementById('logout-modal');
        const messageEl = document.getElementById('logout-message');
        const titleEl = document.getElementById('logout-title');
        const okBtn = document.getElementById('logout-ok');
        if (!modal || !messageEl || !titleEl || !okBtn) {
            console.error('Logout modal elements not found');
            return;
        }
        titleEl.textContent = title;
        messageEl.textContent = message;
        okBtn.textContent = 'OK';
        okBtn.onclick = () => this.hideLogoutModal();
        modal.style.display = 'flex';
    }

    hideCustomAlert() {
        this.hideLogoutModal();
    }

    // Logout modal methods
    showLogoutModal() {
        const modal = document.getElementById('logout-modal');
        const titleEl = document.getElementById('logout-title');
        const messageEl = document.getElementById('logout-message');
        const okBtn = document.getElementById('logout-ok');
        if (modal && titleEl && messageEl && okBtn) {
            titleEl.textContent = 'Confirm Logout';
            messageEl.textContent = 'Are you sure you want to logout?';
            okBtn.textContent = 'Logout';
            okBtn.onclick = () => { this.hideLogoutModal(); this.performLogout(); };
            modal.style.display = 'flex';
        }
    }

    hideLogoutModal() {
        const modal = document.getElementById('logout-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    performLogout() {
        localStorage.removeItem('chatapp_current_user');
        localStorage.removeItem('chatapp_theme');
        // Leave personal and chat rooms
        if (this.currentUser) {
            this.socket.emit('leave_chat', { user_id: this.currentUser.id });
            if (this.currentChatFriend) {
                const chatId = this.generateChatId(this.currentUser.id, this.currentChatFriend.id);
                this.socket.emit('leave_room_chat', { chat_id: chatId });
            }
        }
        this.currentUser = null;
        this.currentChatFriend = null;
        this.showAuthSection();
    }

    init() {
        // Initialize state needed by UI before any rendering
        this._onlineFriendIds = new Set();
        this._unreadByFriendId = this._loadUnreadMap();

        this.loadUserSession();
        this.updateUI();
        this.setupSocketListeners();
        this.startPeriodicUpdates();

        // Theme init
        this.applyTheme(this.theme);
        // Chat background init (global default used until a friend chat is opened)
        this.applyChatBackground(this._loadChatBackground());

        // Custom alert modal handlers
        const customAlertModal = document.getElementById('custom-alert-modal');
        const customAlertClose = document.getElementById('custom-alert-close');
        const customAlertOk = document.getElementById('custom-alert-ok');
        if (customAlertClose) customAlertClose.addEventListener('click', () => this.hideCustomAlert());
        if (customAlertOk) customAlertOk.addEventListener('click', () => this.hideCustomAlert());
        if (customAlertModal) customAlertModal.addEventListener('click', (e) => {
            if (e.target === customAlertModal) this.hideCustomAlert();
        });

        // Settings menu handlers
        const settingsToggle = document.getElementById('settings-toggle');
        const settingsMenu = document.getElementById('settings-menu');
        if (settingsToggle && settingsMenu) {
            // Normalize state to use the `hidden` attribute (avoid inline display CSS conflicts)
            if (settingsMenu.style && settingsMenu.style.display === 'none') {
                settingsMenu.setAttribute('hidden', '');
                settingsMenu.style.display = '';
            }

            const closeSettingsMenu = () => settingsMenu.setAttribute('hidden', '');
            const openSettingsMenu = () => {
                // Position the fixed menu relative to the toggle button
                const rect = settingsToggle.getBoundingClientRect();
                settingsMenu.style.top = (rect.bottom + 4) + 'px';
                settingsMenu.style.right = (window.innerWidth - rect.right) + 'px';
                settingsMenu.removeAttribute('hidden');
            };

            // Open/close on toggle click
            settingsToggle.addEventListener('click', (event) => {
                event.stopPropagation();
                const isOpen = !settingsMenu.hasAttribute('hidden');
                if (isOpen) closeSettingsMenu(); else openSettingsMenu();
            });

            // Prevent clicks inside the menu from bubbling to document
            settingsMenu.addEventListener('click', (event) => {
                event.stopPropagation();
            });

            // Close on outside click
            document.addEventListener('click', () => {
                closeSettingsMenu();
            });

            // Close on Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeSettingsMenu();
            });
        }

        // Quick actions inside settings menu
        const quickAddBtn = document.getElementById('quick-add-friend');
        if (quickAddBtn) quickAddBtn.addEventListener('click', () => {
            this.showAddFriendModal();
        });

        const saveBtn = document.getElementById('save-settings-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }
        const settingsCopyBtn = document.getElementById('settings-copy-code');
        if (settingsCopyBtn) {
            settingsCopyBtn.addEventListener('click', () => {
                console.log('Copy button clicked', this.currentUser?.code);
                this.copyUserCodeFromSettings();
            });
        }
        const uploadBtn = document.getElementById('upload-avatar-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.uploadAvatar());
        }
        const themeLight = document.getElementById('theme-light');
        const themeDark = document.getElementById('theme-dark');
        if (themeLight) themeLight.addEventListener('click', () => this.setTheme('light'));
        if (themeDark) themeDark.addEventListener('click', () => this.setTheme('dark'));

        // Avatar adjust handlers
        const avatarInput = document.getElementById('settings-avatar');
        const avatarZoom = document.getElementById('avatar-zoom');
        const avatarApply = document.getElementById('avatar-apply-btn');
        const avatarCancel = document.getElementById('avatar-cancel-btn');
        if (avatarInput) {
            avatarInput.addEventListener('change', async () => {
                if (!avatarInput.files || !avatarInput.files[0]) return;
                await this._beginAvatarAdjust(avatarInput.files[0]);
            });
        }
        if (avatarZoom) {
            avatarZoom.addEventListener('input', () => this._updateAvatarPreviewTransform());
        }
        if (avatarApply) {
            avatarApply.addEventListener('click', async () => {
                await this._applyAdjustedAvatar();
            });
        }
        if (avatarCancel) {
            avatarCancel.addEventListener('click', () => this._cancelAvatarAdjust());
        }

        // Remove wiring for global chat background (controls removed from UI)

        // Per-friend chat background menu handlers
        const friendSettingsToggle = document.getElementById('friend-settings-toggle');
        const friendSettingsMenu = document.getElementById('friend-settings-menu');
        if (friendSettingsToggle && friendSettingsMenu) {
            // Normalize to use `hidden`
            if (friendSettingsMenu.style && friendSettingsMenu.style.display === 'none') {
                friendSettingsMenu.setAttribute('hidden', '');
                friendSettingsMenu.style.display = '';
            }

            const closeFriendMenu = () => friendSettingsMenu.setAttribute('hidden', '');
            const openFriendMenu = () => {
                const rect = friendSettingsToggle.getBoundingClientRect();
                friendSettingsMenu.style.top = (rect.bottom + 4) + 'px';
                friendSettingsMenu.style.right = (window.innerWidth - rect.right) + 'px';
                friendSettingsMenu.removeAttribute('hidden');
            };

            friendSettingsToggle.addEventListener('click', (event) => {
                event.stopPropagation();
                const isOpen = !friendSettingsMenu.hasAttribute('hidden');
                if (isOpen) closeFriendMenu(); else openFriendMenu();
            });
            friendSettingsMenu.addEventListener('click', (event) => event.stopPropagation());
            document.addEventListener('click', () => { closeFriendMenu(); });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFriendMenu(); });
        }
        const friendBgButtons = [
            ['friend-bg-default', 'default'],
            ['friend-bg-sunrise', 'sunrise'],
            ['friend-bg-ocean', 'ocean'],
            ['friend-bg-midnight', 'midnight'],
        ];
        friendBgButtons.forEach(([id, name]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => this.setFriendChatBackgroundGradient(name));
        });
        const friendBgUploadBtn = document.getElementById('friend-chat-bg-upload-btn');
        if (friendBgUploadBtn) {
            friendBgUploadBtn.addEventListener('click', () => this.uploadFriendChatBackground());
        }

        this._bindComposerControls();
        this._bindAddFriendModal();

        // If user session exists, join their personal room on connect
        this.socket.on('connect', () => {
            if (this.currentUser) {
                this.socket.emit('join_chat', { user_id: this.currentUser.id });
            }
        });
    }

    _bindAddFriendModal() {
        const modal = document.getElementById('add-friend-modal');
        const closeBtn = document.getElementById('add-friend-close');
        const submitBtn = document.getElementById('add-friend-submit');
        const input = document.getElementById('add-friend-code');

        if (closeBtn) closeBtn.addEventListener('click', () => this.hideAddFriendModal());
        if (submitBtn) submitBtn.addEventListener('click', () => this.submitAddFriend());
        if (modal) modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideAddFriendModal();
        });
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.submitAddFriend();
            });
        }
    }

    showAddFriendModal() {
        const modal = document.getElementById('add-friend-modal');
        const input = document.getElementById('add-friend-code');
        if (modal) modal.style.display = 'flex';
        if (input) {
            input.value = '';
            input.focus();
        }
    }

    hideAddFriendModal() {
        const modal = document.getElementById('add-friend-modal');
        if (modal) modal.style.display = 'none';
    }

    async submitAddFriend() {
        const input = document.getElementById('add-friend-code');
        const code = input.value.trim().toUpperCase();
        if (!code) {
            this.showCustomAlert('Please enter a friend\'s code');
            return;
        }
        if (code === this.currentUser.code) {
            this.showCustomAlert('You cannot add yourself as a friend');
            return;
        }
        try {
            const response = await fetch('/add_friend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.currentUser.id, friend_code: code })
            });
            if (response.ok) {
                this.showCustomAlert('Friend request sent!');
                this.refreshUserData();
                this.hideAddFriendModal();
            } else {
                const error = await response.json();
                this.showCustomAlert(error.error || 'Error sending friend request');
            }
        } catch (error) {
            this.showCustomAlert('Error sending friend request');
        }
    }

    _bindComposerControls() {
        const attachBtn = document.getElementById('attach-btn');
        const attachInput = document.getElementById('attach-input');
        if (attachBtn && attachInput) {
            attachBtn.onclick = () => attachInput.click();
            attachInput.onchange = () => this._handleAttachment(attachInput.files && attachInput.files[0]);
        }

        // Sign tools toggle and actions
        const signToggle = document.getElementById('sign-toggle');
        const signMenu = document.getElementById('sign-menu');
        const txtToSign = document.getElementById('mode-text-to-sign');
        const signToTxt = document.getElementById('mode-sign-to-text');
        const modeStrip = document.getElementById('mode-strip');
        if (signToggle && signMenu) {
            signToggle.onclick = (e) => {
                e.stopPropagation();
                // Toggle using hidden attribute to avoid inline display specificity issues
                if (signMenu.hasAttribute('hidden')) signMenu.removeAttribute('hidden'); else signMenu.setAttribute('hidden', '');
            };
            signMenu.onclick = (e) => e.stopPropagation();
            document.addEventListener('click', this._signDocClick || (this._signDocClick = () => { if (signMenu) signMenu.setAttribute('hidden', ''); }));
        }
        if (txtToSign) {
            txtToSign.onclick = () => {
                // Text to sign functionality removed - button kept for UI consistency
                this._setComposerMode('text-to-sign');
                if (signMenu) signMenu.setAttribute('hidden', '');
                this._focusComposer();
            };
        }
        if (signToTxt) {
            signToTxt.onclick = () => {
                // Open sign-to-text popup
                this.openSignToTextPopup();
                if (signMenu) signMenu.setAttribute('hidden', '');
            };
        }
        if (modeStrip && !this._modeStripWired) {
            // Click on strip clears mode
            modeStrip.addEventListener('click', () => this._clearComposerMode());
            this._modeStripWired = true;
        }
        const aiToggle = document.getElementById('ai-toggle');
        const aiMenu = document.getElementById('ai-menu');
        const aiStyleToggle = document.getElementById('ai-style-toggle');
        const aiStyleGrid = document.getElementById('ai-style-grid');
        const aiLanguageToggle = document.getElementById('ai-language-toggle');
        const aiLanguageGrid = document.getElementById('ai-language-grid');
        if (aiToggle && aiMenu) {
            aiToggle.onclick = (e) => {
                e.stopPropagation();
                if (aiMenu.hasAttribute('hidden')) aiMenu.removeAttribute('hidden'); else aiMenu.setAttribute('hidden', '');
            };
            aiMenu.onclick = (e) => e.stopPropagation();
            document.addEventListener('click', this._aiDocClick || (this._aiDocClick = () => { if (aiMenu) aiMenu.setAttribute('hidden', ''); }));
        }
        if (aiStyleToggle && aiStyleGrid) {
            aiStyleToggle.onclick = (e) => {
                e.stopPropagation();
                const isOpen = !aiStyleGrid.hasAttribute('hidden');
                if (isOpen) aiStyleGrid.setAttribute('hidden', ''); else aiStyleGrid.removeAttribute('hidden');
                aiStyleToggle.textContent = isOpen ? 'Style ▸' : 'Style ▾';
                // Accessibility: reflect expanded state
                aiStyleToggle.setAttribute('aria-expanded', String(!isOpen));
            };
        }
        if (aiLanguageToggle && aiLanguageGrid) {
            aiLanguageToggle.onclick = (e) => {
                e.stopPropagation();
                const isOpen = !aiLanguageGrid.hasAttribute('hidden');
                if (isOpen) aiLanguageGrid.setAttribute('hidden', ''); else aiLanguageGrid.removeAttribute('hidden');
                aiLanguageToggle.textContent = isOpen ? 'Translate ▸' : 'Translate ▾';
                // Accessibility: reflect expanded state
                aiLanguageToggle.setAttribute('aria-expanded', String(!isOpen));
            };
        }
        const grammarBtn = document.getElementById('ai-grammar');
        if (grammarBtn) grammarBtn.onclick = async () => { await this._applyGrammarCorrection(); if (aiMenu) aiMenu.setAttribute('hidden', ''); this._focusComposer(); };
        document.querySelectorAll('.style-btn').forEach(btn => {
            btn.onclick = async () => { await this._applyStyleEnhancement(btn.getAttribute('data-style')); if (aiMenu) aiMenu.setAttribute('hidden', ''); this._focusComposer(); };
        });
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.onclick = async () => { await this._applyLanguageConversion(btn.getAttribute('data-language')); if (aiMenu) aiMenu.setAttribute('hidden', ''); this._focusComposer(); };
        });

        // Attachment confirmation panel wiring
        const panel = document.getElementById('attach-panel');
        const preview = document.getElementById('attach-preview');
        const fnameEl = document.getElementById('attach-filename');
        const metaEl = document.getElementById('attach-meta');
        const closeBtn = document.getElementById('attach-close-btn');
        this._attachState = this._attachState || { file: null };
        if (attachBtn && attachInput) {
            attachBtn.onclick = () => attachInput.click();
            attachInput.onchange = () => {
                const file = attachInput.files && attachInput.files[0];
                if (!file) return;
                this._attachState.file = file;
                // Fill panel
                if (fnameEl) fnameEl.textContent = file.name;
                if (metaEl) metaEl.textContent = `${(file.size/1024).toFixed(1)} KB`;
                if (preview) {
                    preview.innerHTML = '';
                    const isImage = /^image\//.test(file.type);
                    if (isImage) {
                        const img = document.createElement('img');
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.objectFit = 'cover';
                        img.src = URL.createObjectURL(file);
                        preview.appendChild(img);
                        // Revoke later
                        setTimeout(() => { try { URL.revokeObjectURL(img.src); } catch {} }, 10000);
                    } else {
                        preview.textContent = file.type || 'file';
                    }
                }
                if (panel) panel.style.display = 'block';
            };
        }
        if (closeBtn) {
            closeBtn.onclick = () => {
                this._clearAttachPanel();
            };
        }
    }

    _setComposerMode(mode) {
        // mode: 'text-to-sign' | 'sign-to-text' - functionality removed but UI kept
        this._activeMode = mode;
        const strip = document.getElementById('mode-strip');
        if (!strip) return;
        let label;
        switch (mode) {
            case 'text-to-sign':
                label = 'Mode: Text → Sign (click to clear)';
                break;
            case 'sign-to-text':
                label = 'Mode: Sign → Text (click to clear)';
                break;
            default:
                label = 'Mode: ' + mode + ' (click to clear)';
        }
        strip.textContent = label;
        if (strip.hasAttribute('hidden')) strip.removeAttribute('hidden');
    }

    _clearComposerMode() {
        this._activeMode = null;
        const strip = document.getElementById('mode-strip');
        if (strip) strip.setAttribute('hidden', '');
    }

    _focusComposer() {
        const input = document.getElementById('message-input');
        if (input) input.focus();
    }



    // Save user session to localStorage
    saveUserSession() {
        if (this.currentUser) {
            localStorage.setItem('chatapp_current_user', JSON.stringify(this.currentUser));
        }
    }

    // Load user session from localStorage
    loadUserSession() {
        const userData = localStorage.getItem('chatapp_current_user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
    }

    // Create new user account
    async createNewAccount(username, password) {
        try {
const response = await fetch(`${this.API_BASE}/register_chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });
            
            if (response.ok) {
                const user = await response.json();
                this.currentUser = user;
                this.saveUserSession();
                this.showChatInterface();
            } else {
                const err = await response.json();
                this.showCustomAlert(err.error || 'Error creating account');
            }
        } catch (error) {
            this.showCustomAlert('Error creating account');
        }
    }

    // Login with existing code
    async loginWithCode() {
        const code = document.getElementById('login-code').value.trim().toUpperCase();
        const password = document.getElementById('login-password').value;
        
        if (!code) {
            this.showCustomAlert('Please enter a valid code');
            return;
        }
        
        try {
const response = await fetch(`${this.API_BASE}/login_chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code: code, password })
            });
            
            if (response.ok) {
                const user = await response.json();
                this.currentUser = user;
                this.saveUserSession();
                this.showChatInterface();
            } else {
                const err = await response.json();
                this.showCustomAlert(err.error || 'Login failed');
            }
        } catch (error) {
            this.showCustomAlert('Error logging in');
        }
    }

    async setLegacyPassword() {
        const code = document.getElementById('login-code').value.trim().toUpperCase();
        const password = document.getElementById('setpass-password').value;
        if (!code || !password) {
            this.showCustomAlert('Enter code and new password');
            return;
        }
        try {
const res = await fetch(`${this.API_BASE}/set_password_chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, password })
            });
            const data = await res.json();
            if (!res.ok) {
                this.showCustomAlert(data.error || 'Failed to set password');
                return;
            }
            this.showCustomAlert('Password set. You can login now.');
        } catch (e) {
            this.showCustomAlert('Failed to set password');
        }
    }



    // Update UI based on current state
    updateUI() {
        if (this.currentUser) {
            this.showChatInterface();
        } else {
            this.showAuthSection();
        }
    }

    // Show authentication section
    showAuthSection() {
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('chat-interface').style.display = 'none';
    }

    // Show chat interface
    showChatInterface() {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('chat-interface').style.display = 'flex';
        
        // Update user info
        document.getElementById('current-user-name').textContent = this.currentUser.username;
        document.getElementById('current-user-code').textContent = `Code: ${this.currentUser.code}`;
        document.getElementById('display-code').textContent = this.currentUser.code;
        this._updateAvatarElement(this.currentUser?.avatar_url);
        const settingsUsername = document.getElementById('settings-username');
        if (settingsUsername) settingsUsername.value = this.currentUser.username;
        
        this.updateFriendsList();
        this.updateFriendRequests();
        
        // On mobile, show welcome popup; on desktop, show welcome chat normally
        if (this._isMobile()) {
            this.showWelcomeModal();
        } else {
            this.showWelcomeChat();
        }

    // Join personal room to receive events like friend requests
    this.socket.emit('join_chat', { user_id: this.currentUser.id });

        // Populate code in settings panel if present
        const settingsCode = document.getElementById('settings-code');
        if (settingsCode) settingsCode.value = this.currentUser.code;
    }
    async _updateAvatarElement(avatarUrl) {
        const avatar = document.getElementById('current-user-avatar');
        if (!avatar) return;
        if (!avatarUrl) {
            avatar.style.backgroundImage = '';
            avatar.textContent = '👤';
            return;
        }
        try {
            const bust = `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
            const res = await fetch(bust, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            avatar.style.backgroundImage = `url('${objectUrl}')`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.textContent = '';
            // Revoke old object URLs on next tick
            setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
        } catch (e) {
            // Fallback to cache-busted direct URL
            const bust = `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
            avatar.style.backgroundImage = `url('${bust}')`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.textContent = '';
        }
    }

    async _updateActiveFriendAvatar(avatarUrl) {
        const headerAvatar = document.querySelector('#active-chat .friend-avatar');
        if (!headerAvatar) return;
        if (!avatarUrl) {
            headerAvatar.style.backgroundImage = '';
            headerAvatar.textContent = '👤';
            return;
        }
        try {
            const bust = `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
            const res = await fetch(bust, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            headerAvatar.style.backgroundImage = `url('${objectUrl}')`;
            headerAvatar.style.backgroundSize = 'cover';
            headerAvatar.style.backgroundPosition = 'center';
            headerAvatar.textContent = '';
            setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
        } catch (e) {
            const bust = `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
            headerAvatar.style.backgroundImage = `url('${bust}')`;
            headerAvatar.style.backgroundSize = 'cover';
            headerAvatar.style.backgroundPosition = 'center';
            headerAvatar.textContent = '';
        }
    }


    // Add friend functionality
    async addFriend() {
        const friendCode = document.getElementById('friend-code').value.trim().toUpperCase();
        
        if (!friendCode) {
            this.showCustomAlert('Please enter a friend\'s code');
            return;
        }
        
        if (friendCode === this.currentUser.code) {
            this.showCustomAlert('You cannot add yourself as a friend');
            return;
        }
        
        try {
const response = await fetch(`${this.API_BASE}/add_friend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.currentUser.id,
                    friend_code: friendCode
                })
            });
            
            if (response.ok) {
                this.showCustomAlert('Friend request sent!');
                // Refresh user data from server
const userResponse = await fetch(`${this.API_BASE}/user_data_chat?code=${encodeURIComponent(this.currentUser.code)}`);
                if (userResponse.ok) {
                    const updatedUser = await userResponse.json();
                    this.currentUser = updatedUser;
                    this.saveUserSession();
                }
                this.updateFriendRequests();
            } else {
                const error = await response.json();
                this.showCustomAlert(error.error || 'Error sending friend request');
            }
        } catch (error) {
            this.showCustomAlert('Error sending friend request');
        }
        
        document.getElementById('friend-code').value = '';
    }

    // Accept friend request
    async acceptFriendRequest(requesterId) {
        try {
            const response = await fetch('/accept_request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.currentUser.id,
                    request_id: requesterId
                })
            });
            
            if (response.ok) {
                // Refresh user data from server
const userResponse = await fetch(`${this.API_BASE}/user_data_chat?code=${encodeURIComponent(this.currentUser.code)}`);
                if (userResponse.ok) {
                    const updatedUser = await userResponse.json();
                    this.currentUser = updatedUser;
                    this.saveUserSession();
                }
                this.updateFriendsList();
                this.updateFriendRequests();
            } else {
                this.showCustomAlert('Error accepting friend request');
            }
        } catch (error) {
            this.showCustomAlert('Error accepting friend request');
        }
    }

    // Decline friend request
    async declineFriendRequest(requesterId) {
        try {
const response = await fetch(`${this.API_BASE}/decline_request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: this.currentUser.id,
                    request_id: requesterId
                })
            });
            
            if (response.ok) {
                // Refresh user data from server
const userResponse = await fetch(`${this.API_BASE}/user_data_chat?code=${encodeURIComponent(this.currentUser.code)}`);
                if (userResponse.ok) {
                    const updatedUser = await userResponse.json();
                    this.currentUser = updatedUser;
                    this.saveUserSession();
                }
                this.updateFriendRequests();
            } else {
                this.showCustomAlert('Error declining friend request');
            }
        } catch (error) {
            this.showCustomAlert('Error declining friend request');
        }
    }

    // Generate consistent chat ID
    generateChatId(userId1, userId2) {
        return [userId1, userId2].sort().join('_');
    }

    // Update friends list
    updateFriendsList() {
        const friendsList = document.getElementById('friends-list');
        const friendsCount = document.getElementById('friends-count');
        
        // Compute a deterministic signature of the friends list to detect changes
        const friendsSignature = JSON.stringify(
            (this.currentUser.friends || [])
                .map(f => ({ id: f.id, u: f.username, c: f.code }))
                .sort((a, b) => a.id - b.id)
        );

        // If nothing changed, skip rerender to prevent flicker
        if (friendsSignature === this._lastFriendsSignature) {
            friendsCount.textContent = this.currentUser.friends.length;
            return;
        }

        this._lastFriendsSignature = friendsSignature;

        friendsList.innerHTML = '';
        friendsCount.textContent = this.currentUser.friends.length;
        
        this.currentUser.friends.forEach(friend => {
            const friendElement = document.createElement('div');
            friendElement.className = 'friend-item';
            friendElement.innerHTML = `
                <div class="friend-info">
                    <div class="friend-avatar-small" id="friend-avatar-${friend.id}"><span class="online-dot" id="online-dot-${friend.id}"></span></div>
                    <div class="friend-details-small">
                        <h5>${friend.username}</h5>
                        <p>Code: ${friend.code}</p>
                    </div>
                </div>
                <span class="unread-badge" id="unread-${friend.id}" style="display:none">0</span>
                <button class="btn-chat" onclick="chatApp.startChat(${friend.id})">💬 Chat</button>
            `;
            friendsList.appendChild(friendElement);
            // Apply friend avatar if available (with cache-busting)
            if (friend.avatar_url) {
                const el = document.getElementById(`friend-avatar-${friend.id}`);
                if (el) {
                    const bust = `${friend.avatar_url}${friend.avatar_url.includes('?') ? '&' : '?'}t=${Date.now()}`;
                    el.style.backgroundImage = `url('${bust}')`;
                    el.style.backgroundSize = 'cover';
                    el.style.backgroundPosition = 'center';
                    el.textContent = '';
                }
            }
            // Presence dot state
            const dot = document.getElementById(`online-dot-${friend.id}`);
            if (dot) {
                const isOnline = this._onlineFriendIds.has(friend.id);
                dot.classList.toggle('online', !!isOnline);
                dot.classList.toggle('offline', !isOnline);
            }
            // Unread badge
            this._updateUnreadBadge(friend.id);
        });
    }

    // Update friend requests
    updateFriendRequests() {
        const requestsList = document.getElementById('friend-requests');
        const requestCount = document.getElementById('request-count');
        
        // Compute signature to avoid unnecessary re-rendering
        const requestsSignature = JSON.stringify(
            (this.currentUser.friendRequests || [])
                .map(r => ({ id: r.id, u: r.username, c: r.code }))
                .sort((a, b) => a.id - b.id)
        );

        if (requestsSignature === this._lastRequestsSignature) {
            requestCount.textContent = this.currentUser.friendRequests.length;
            return;
        }

        this._lastRequestsSignature = requestsSignature;

        requestsList.innerHTML = '';
        requestCount.textContent = this.currentUser.friendRequests.length;
        
        this.currentUser.friendRequests.forEach(request => {
            const requestElement = document.createElement('div');
            requestElement.className = 'friend-request';
            requestElement.innerHTML = `
                <div class="friend-info">
                    <div class="friend-avatar-small">👤</div>
                    <div class="friend-details-small">
                        <h5>${request.username}</h5>
                        <p>Code: ${request.code}</p>
                    </div>
                </div>
                <div class="request-actions">
                    <button class="btn-accept" onclick="chatApp.acceptFriendRequest(${request.id})">✓ Accept</button>
                    <button class="btn-decline" onclick="chatApp.declineFriendRequest(${request.id})">✗ Decline</button>
                </div>
            `;
            requestsList.appendChild(requestElement);
        });
    }

    // Start chat with friend
    startChat(friendId) {
        // Coerce types to ensure matching even if id is string/number
        const friend = this.currentUser.friends.find(f => String(f.id) === String(friendId));
        if (!friend) return;
        
        // Leave previous chat room if any
        if (this.currentChatFriend) {
            const prevChatId = this.generateChatId(this.currentUser.id, this.currentChatFriend.id);
            this.socket.emit('leave_room_chat', { chat_id: prevChatId });
        }

        this.currentChatFriend = friend;
        this.showActiveChat();
        this._resetUnread(friendId);
        // Apply friend-specific background if exists, otherwise fallback to global
        const friendPreset = this._loadFriendChatBackground(friendId);
        this.applyChatBackground(friendPreset || this._loadChatBackground());

        // Mobile: open full-screen chat and show back button
        if (this._isMobile()) {
            const sidebar = document.querySelector('.sidebar');
            const backBtn = document.getElementById('mobile-back-btn');
            if (sidebar) sidebar.style.display = 'none';
            const welcome = document.getElementById('welcome-chat');
            if (welcome) welcome.style.display = 'none';
            const active = document.getElementById('active-chat');
            if (active) {
                active.style.display = 'flex';
                active.classList.add('mobile-active');
            }
            if (backBtn) backBtn.style.display = 'inline-flex';
        }
    }

    // Show welcome chat
    showWelcomeChat() {
        document.getElementById('welcome-chat').style.display = 'flex';
        document.getElementById('active-chat').style.display = 'none';
        this.currentChatFriend = null;
    }

    // Show active chat
    showActiveChat() {
        document.getElementById('welcome-chat').style.display = 'none';
        document.getElementById('active-chat').style.display = 'flex';
        
        // Update chat header
        document.getElementById('active-friend-name').textContent = this.currentChatFriend.username;
        // Update friend avatar in chat header
        this._updateActiveFriendAvatar(this.currentChatFriend?.avatar_url);
        
        // Join chat room for real-time messages
    const chatId = this.generateChatId(this.currentUser.id, this.currentChatFriend.id);
    this.socket.emit('join_room_chat', { chat_id: chatId });

        // Load messages and presence
        this.loadMessages();
        this.refreshPresence();

        // Re-bind composer controls after view switch
        this._bindComposerControls();
    }

    _isMobile() {
        try { return window.matchMedia && window.matchMedia('(max-width: 768px)').matches; } catch { return false; }
    }

    closeChatMobile() {
        if (!this._isMobile()) return;
        // Leave chat room if present
        if (this.currentChatFriend) {
            const chatId = this.generateChatId(this.currentUser.id, this.currentChatFriend.id);
            this.socket.emit('leave_room_chat', { chat_id: chatId });
        }
        this.currentChatFriend = null;
        // Restore lists and welcome view
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.style.display = '';
        const activeChat = document.getElementById('active-chat');
        if (activeChat) {
            activeChat.style.display = 'none';
            activeChat.classList.remove('mobile-active');
        }
        const backBtn = document.getElementById('mobile-back-btn');
        if (backBtn) backBtn.style.display = 'none';
        this.showWelcomeChat();
    }

    showWelcomeModal() {
        if (!this._isMobile()) return;
        const welcomeChat = document.getElementById('welcome-chat');
        if (welcomeChat) {
            welcomeChat.style.display = 'flex';
        }
    }

    closeWelcomeModal() {
        if (!this._isMobile()) return;
        const welcomeChat = document.getElementById('welcome-chat');
        if (welcomeChat) {
            welcomeChat.style.display = 'none';
        }
    }

    // Load messages for current chat
    async loadMessages() {
        try {
const response = await fetch(`${this.API_BASE}/get_messages_chat?user_id=${this.currentUser.id}&friend_id=${this.currentChatFriend.id}`);
            
            if (response.ok) {
                const messages = await response.json();
                
                const messagesContainer = document.getElementById('messages-container');
                messagesContainer.innerHTML = '';
                
                messages.forEach(message => {
                    this.displayMessage(message);
                });
                
                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    // Display message in chat
    displayMessage(message) {
        const messagesContainer = document.getElementById('messages-container');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender_id === this.currentUser.id ? 'sent' : 'received'}`;
        
        // Ensure device-local timezone formatting; server sends ISO with Z (UTC)
        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const isFileLink = typeof message.text === 'string' && message.text.startsWith('/static/uploads/');
        let contentHtml;
        if (isFileLink) {
            const url = message.text;
            const filename = this._filenameFromPath(url);
            const lower = filename.toLowerCase();
            const isImage = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp');
            if (isImage) {
                contentHtml = `
                    <a href="${url}" target="_blank" rel="noopener" style="text-decoration:none; color:inherit;">
                        <img src="${url}" alt="${filename}" style="max-width: 260px; max-height: 260px; border-radius: 10px; display:block;">
                    </a>
                    <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${filename}</div>
                `;
            } else {
                contentHtml = `
                    <a href="${url}" target="_blank" rel="noopener" download style="display:inline-flex; align-items:center; gap:8px; padding:8px 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; text-decoration:none; color:inherit;">
                        <span style="font-size:16px;">📎</span>
                        <span style="font-weight:600;">${filename}</span>
                    </a>
                `;
            }
        } else {
            contentHtml = message.text;
        }
        messageElement.innerHTML = `
            <div class="message-bubble">
                ${contentHtml}
                <div class="message-time">${time}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    _filenameFromPath(path) {
        try { return path.split('/').pop() || path; } catch { return path; }
    }

    _clearAttachPanel() {
        const panel = document.getElementById('attach-panel');
        const preview = document.getElementById('attach-preview');
        const fnameEl = document.getElementById('attach-filename');
        const metaEl = document.getElementById('attach-meta');
        const attachInput = document.getElementById('attach-input');
        if (panel) panel.style.display = 'none';
        if (preview) preview.innerHTML = '';
        if (fnameEl) fnameEl.textContent = 'Selected file';
        if (metaEl) metaEl.textContent = '—';
        if (attachInput) attachInput.value = '';
        this._attachState = { file: null };
    }

    // Send message
    async sendMessage() {
        const messageInput = document.getElementById('message-input');
        const text = messageInput.value.trim();
        
        if (!this.currentChatFriend) {
            return;
        }
        
        // Check if there's an attachment to send
        if (this._attachState && this._attachState.file) {
            try {
                const form = new FormData();
                form.append('file', this._attachState.file);
                form.append('sender_id', this.currentUser.id);
                form.append('receiver_id', this.currentChatFriend.id);
                const res = await fetch(`${this.API_BASE}/upload_attachment`, { method: 'POST', body: form });
                const data = await res.json();
                if (!res.ok) {
                    this.showCustomAlert(data.error || 'Failed to send file');
                    return;
                }
                this._clearAttachPanel();
                this._focusComposer();
                return;
            } catch (e) {
                this.showCustomAlert('Failed to send file');
                return;
            }
        }
        
        // Send text message if no attachment and text is provided
        if (!text) return;
        
        try {
            const res = await fetch(`${this.API_BASE}/send_message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sender_id: this.currentUser.id,
                    receiver_id: this.currentChatFriend.id,
                    text: text
                })
            });
            
            if (res.ok) {
                messageInput.value = '';
                this._focusComposer();
            } else {
                try {
                    const err = await res.json();
                    console.error('send_message failed', res.status, err);
                    this.showCustomAlert(err.error || `Error sending message (HTTP ${res.status})`);
                } catch (e) {
                    console.error('send_message failed (non-JSON)', res.status);
                    this.showCustomAlert(`Error sending message (HTTP ${res.status})`);
                }
            }
        } catch (error) {
            console.error('send_message network error', error);
            this.showCustomAlert('Network error sending message');
        }
    }

    // ===== Attachments (placeholder flow) =====
    async _handleAttachment(file) {
        if (!file || !this.currentChatFriend) return;
        this.showCustomAlert(`Selected file: ${file.name}`);
        // TODO: Implement server-side upload route if needed
    }

    // ===== AI Tools (client-side placeholders) =====
    async _applyGrammarCorrection() {
        const input = document.getElementById('message-input');
        const text = (input?.value || '').trim();
        if (!text) return;
        // show lightweight progress by disabling the input
        const prevPlaceholder = input.placeholder;
        input.disabled = true;
        input.placeholder = 'Processing grammar...';
        try {
            const res = await fetch('/grammar_correction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            if (!res.ok) {
                this.showCustomAlert(data.error || `Grammar service error (HTTP ${res.status})`);
                return;
            }
            const corrected = (data.corrected || data.reply || '').trim();
            if (corrected) input.value = corrected;
        } catch (e) {
            this.showCustomAlert('Network error during grammar correction');
        } finally {
            input.disabled = false;
            input.placeholder = prevPlaceholder;
        }
    }

    async _applyStyleEnhancement(style) {
        const input = document.getElementById('message-input');
        const text = (input?.value || '').trim();
        if (!text) return;
        if (!style) return;
        const prevPlaceholder = input.placeholder;
        input.disabled = true;
        input.placeholder = `Styling (${style})...`;
        try {
            const res = await fetch('/style_enhance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({ text, style })
            });
            const data = await res.json();
            if (!res.ok) {
                this.showCustomAlert(data.error || `Style service error (HTTP ${res.status})`);
                return;
            }
            const styled = (data.result || data.text || '').trim();
            if (styled) input.value = styled;
        } catch (e) {
            this.showCustomAlert('Network error during style enhancement');
        } finally {
            input.disabled = false;
            input.placeholder = prevPlaceholder;
        }
    }

    async _applyLanguageConversion(language) {
        const input = document.getElementById('message-input');
        const text = (input?.value || '').trim();
        if (!text) return;
        if (!language) return;
        const prevPlaceholder = input.placeholder;
        input.disabled = true;
        input.placeholder = `Translating to ${language}...`;
        try {
            const res = await fetch('/language_conversion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({ text, language })
            });
            const data = await res.json();
            if (!res.ok) {
                this.showCustomAlert(data.error || `Language conversion error (HTTP ${res.status})`);
                return;
            }
            const translated = (data.translated || '').trim();
            if (translated) input.value = translated;
        } catch (e) {
            this.showCustomAlert('Network error during language conversion');
        } finally {
            input.disabled = false;
            input.placeholder = prevPlaceholder;
        }
    }

    // Handle message input key press
    handleMessageKeyPress(event) {
        if (event.key === 'Enter') {
            this.sendMessage();
        }
    }

    // Setup Socket.IO listeners
    setupSocketListeners() {
        this.socket.on('new_message', (data) => {
            const isActive = this.currentChatFriend && 
                this.generateChatId(this.currentUser.id, this.currentChatFriend.id) === data.chat_id;
            if (isActive) {
                this.displayMessage(data);
                return;
            }
            // Increment unread if message pertains to a different friend and not sent by self
            const ids = data.chat_id.split('_').map(x => parseInt(x, 10));
            if (ids.length === 2) {
                const friendId = ids[0] === this.currentUser.id ? ids[1] : ids[1] === this.currentUser.id ? ids[0] : null;
                if (friendId && data.sender_id !== this.currentUser.id) {
                    this._incrementUnread(friendId);
                }
            }
        });

        this.socket.on('friend_request', (data) => {
            if (this.currentUser) {
                // Refresh user data from server
                this.refreshUserData();
            }
        });

        this.socket.on('request_accepted', (data) => {
            if (this.currentUser) {
                // Refresh user data from server
                this.refreshUserData();
            }
        });

        this.socket.on('request_declined', (data) => {
            if (this.currentUser) {
                // Refresh user data from server
                this.refreshUserData();
            }
        });

        // Friend profile updates (username/avatar)
        this.socket.on('friend_profile_updated', (data) => {
            if (!this.currentUser) return;
            const { friend_id, username, avatar_url } = data;
            // Update friend in friends list
            const friend = this.currentUser.friends?.find(f => String(f.id) === String(friend_id));
            if (friend) {
                if (username) friend.username = username;
                if (avatar_url) friend.avatar_url = avatar_url;
                this.updateFriendsList();
                // Update active chat header if chatting with this friend
                if (this.currentChatFriend && String(this.currentChatFriend.id) === String(friend_id)) {
                    this.currentChatFriend.username = username || this.currentChatFriend.username;
                    const header = document.getElementById('active-friend-name');
                    if (header) header.textContent = this.currentChatFriend.username;
                    // If avatar changed, refresh active friend's avatar in header
                    if (avatar_url) {
                        this._updateActiveFriendAvatar(avatar_url);
                    }
                }
                // Update avatar in friends list if provided
                if (avatar_url) {
                    friend.avatar_url = avatar_url;
                    const el = document.getElementById(`friend-avatar-${friend.id}`);
                    if (el) {
                        const bust = `${avatar_url}${avatar_url.includes('?') ? '&' : '?'}t=${Date.now()}`;
                        el.style.backgroundImage = `url('${bust}')`;
                        el.style.backgroundSize = 'cover';
                        el.style.backgroundPosition = 'center';
                        el.textContent = '';
                    }
                }
            }
        });

        // Presence updates
        this.socket.on('user_online', (data) => {
            if (!this.currentUser || !this.currentChatFriend) return;
            if (String(data.user_id) === String(this.currentChatFriend.id)) {
                this._setActiveFriendStatus(true);
            }
        });

        this.socket.on('user_offline', (data) => {
            if (!this.currentUser || !this.currentChatFriend) return;
            if (String(data.user_id) === String(this.currentChatFriend.id)) {
                this._setActiveFriendStatus(false);
            }
        });
    }

    // Refresh user data from server
    async refreshUserData() {
        try {
const response = await fetch(`${this.API_BASE}/user_data_chat?code=${encodeURIComponent(this.currentUser.code)}`);
            
            if (response.ok) {
                const updatedUser = await response.json();
                const previouslyActiveFriendId = this.currentChatFriend ? this.currentChatFriend.id : null;
                this.currentUser = updatedUser;
                this.saveUserSession();
                // Preserve active chat friend reference if still present
                if (previouslyActiveFriendId != null) {
                    const refreshedActive = this.currentUser.friends.find(f => f.id === previouslyActiveFriendId);
                    if (refreshedActive) {
                        this.currentChatFriend = refreshedActive;
                        // Ensure header reflects any name changes
                        if (document.getElementById('active-chat').style.display !== 'none') {
                            document.getElementById('active-friend-name').textContent = this.currentChatFriend.username;
                        }
                    }
                }
                this.updateFriendsList();
                this.updateFriendRequests();
            }
        } catch (error) {
            console.error('Error refreshing user data:', error);
        }
    }

    // Start periodic updates to sync data (now using Socket.IO)
    startPeriodicUpdates() {
        // No longer needed with Socket.IO, but keeping for friend requests
        setInterval(() => {
            if (this.currentUser) {
                this.refreshUserData();
                // Also refresh presence occasionally as a fallback
                this.refreshPresence();
            }
        }, 5000); // Check every 5 seconds
    }

    async refreshPresence() {
        try {
            if (!this.currentUser) return;
const res = await fetch(`${this.API_BASE}/online_friends?user_id=${this.currentUser.id}`);
            if (!res.ok) return;
            const data = await res.json();
            this._onlineFriendIds = new Set(data.online_friend_ids || []);
            if (this.currentChatFriend) {
                const isOnline = this._onlineFriendIds.has(this.currentChatFriend.id);
                this._setActiveFriendStatus(isOnline);
            }
        } catch (e) {
            // ignore
        }
    }

    _setActiveFriendStatus(isOnline) {
        const el = document.getElementById('active-friend-status');
        if (!el) return;
        el.textContent = isOnline ? 'Online' : 'Offline';
        el.classList.toggle('online', !!isOnline);
        el.classList.toggle('offline', !isOnline);
    }

    // Copy user code to clipboard
    copyUserCode() {
        const input = document.getElementById('settings-code');
        input.select();
            document.execCommand('copy');
                            this.showCustomAlert('Your code has been copied to clipboard!');
    }
    copyUserCodeFromSettings() {
        if (!this.currentUser) return;
        this.copyUserCode();
    }

    // Logout functionality
    logout() {
        this.showLogoutModal();
    }

    // Settings logic
    async saveSettings() {
        if (!this.currentUser) return;
        const newUsername = document.getElementById('settings-username')?.value?.trim();
        try {
const res = await fetch(`${this.API_BASE}/update_profile_chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.currentUser.id, username: newUsername })
            });
            const data = await res.json();
            if (!res.ok) {
                this.showCustomAlert(data.error || 'Failed to update profile');
                return;
            }
            this.currentUser = data;
            this.saveUserSession();
            this.showChatInterface();
            this.showCustomAlert('Profile updated');
        } catch (e) {
            this.showCustomAlert('Failed to update profile');
        }
    }

    async uploadAvatar() {
        if (!this.currentUser) return;
        const fileInput = document.getElementById('settings-avatar');
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            this.showCustomAlert('Select an image file');
            return;
        }
        // If user used adjust UI, prefer the cropped blob stored in state
        let fileToSend = fileInput.files[0];
        if (this._avatarAdjust && this._avatarAdjust.croppedBlob) {
            fileToSend = this._avatarAdjust.croppedBlob;
        }
        const form = new FormData();
        form.append('file', fileToSend, 'avatar.png');
        form.append('user_id', this.currentUser.id);
        try {
const res = await fetch(`${this.API_BASE}/upload_avatar`, { method: 'POST', body: form });
            const data = await res.json();
            if (!res.ok) {
                this.showCustomAlert(data.error || 'Failed to upload');
                return;
            }
            // Update profile with the new URL
const res2 = await fetch(`${this.API_BASE}/update_profile_chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.currentUser.id, avatar_url: data.avatar_url })
            });
            const user = await res2.json();
            if (!res2.ok) {
                this.showCustomAlert(user.error || 'Failed to set avatar');
                return;
            }
            this.currentUser = user;
            this.saveUserSession();
            // Update avatar immediately using robust loader
            await this._updateAvatarElement(this.currentUser.avatar_url);
            this.showChatInterface();
            this.showCustomAlert('Avatar updated');
            this._cancelAvatarAdjust();
        } catch (e) {
            this.showCustomAlert('Failed to upload avatar');
        }
    }

    setTheme(theme) {
        this.theme = theme;
        localStorage.setItem('chatapp_theme', theme);
        this.applyTheme(theme);
    }

    applyTheme(theme) {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }

    // ===== Unread storage =====
    _storageKeyUnread() {
        const uid = this.currentUser?.id || 'anon';
        return `chatapp_unread_${uid}`;
    }
    _loadUnreadMap() {
        try {
            const raw = localStorage.getItem(this._storageKeyUnread());
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }
    _saveUnreadMap() {
        try { localStorage.setItem(this._storageKeyUnread(), JSON.stringify(this._unreadByFriendId)); } catch {}
    }
    _incrementUnread(friendId) {
        const key = String(friendId);
        this._unreadByFriendId[key] = (this._unreadByFriendId[key] || 0) + 1;
        this._saveUnreadMap();
        this._updateUnreadBadge(friendId);
    }
    _resetUnread(friendId) {
        const key = String(friendId);
        if (this._unreadByFriendId[key]) {
            this._unreadByFriendId[key] = 0;
            this._saveUnreadMap();
            this._updateUnreadBadge(friendId);
        }
    }
    _updateUnreadBadge(friendId) {
        const el = document.getElementById(`unread-${friendId}`);
        if (!el) return;
        const count = this._unreadByFriendId[String(friendId)] || 0;
        el.textContent = String(count);
        el.style.display = count > 0 ? 'inline-block' : 'none';
    }

    // ===== Chat background customization =====
    _storageKeyChatBg() {
        const uid = this.currentUser?.id || 'anon';
        return `chatapp_chat_bg_${uid}`;
    }
    _storageKeyFriendChatBg(friendId) {
        const uid = this.currentUser?.id || 'anon';
        return `chatapp_chat_bg_${uid}_friend_${friendId}`;
    }
    _loadChatBackground() {
        try {
            const raw = localStorage.getItem(this._storageKeyChatBg());
            return raw ? JSON.parse(raw) : { type: 'gradient', value: 'default' };
        } catch { return { type: 'gradient', value: 'default' }; }
    }
    _saveChatBackground(preset) {
        try { localStorage.setItem(this._storageKeyChatBg(), JSON.stringify(preset)); } catch {}
    }
    _loadFriendChatBackground(friendId) {
        if (!friendId) return null;
        try {
            const raw = localStorage.getItem(this._storageKeyFriendChatBg(friendId));
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }
    _saveFriendChatBackground(friendId, preset) {
        if (!friendId) return;
        try { localStorage.setItem(this._storageKeyFriendChatBg(friendId), JSON.stringify(preset)); } catch {}
    }
    applyChatBackground(preset) {
        const container = document.getElementById('messages-container');
        if (!container) return;
        if (!preset) preset = { type: 'gradient', value: 'default' };
        if (preset.type === 'image' && preset.value) {
            container.style.background = `url('${preset.value}') center/cover no-repeat fixed`;
        } else {
            const map = {
                default: 'linear-gradient(180deg, var(--bg-secondary), var(--bg-secondary))',
                sunrise: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
                ocean: 'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)',
                midnight: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
            };
            container.style.background = map[preset.value] || map.default;
        }
    }
    // Global background setters are deprecated from UI, keeping methods if needed elsewhere
    async setChatBackgroundGradient(name) {
        const preset = { type: 'gradient', value: name };
        this._saveChatBackground(preset);
        this.applyChatBackground(preset);
    }
    async uploadChatBackground() {
        // No-op as UI controls were removed
        const input = document.getElementById('chat-bg-file');
        if (!input) return;
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        const url = URL.createObjectURL(file);
        const preset = { type: 'image', value: url };
        this._saveChatBackground(preset);
        this.applyChatBackground(preset);
    }

    // Friend-specific chat background
    async setFriendChatBackgroundGradient(name) {
        if (!this.currentChatFriend) return;
        const preset = { type: 'gradient', value: name };
        this._saveFriendChatBackground(this.currentChatFriend.id, preset);
        this.applyChatBackground(preset);
    }
    async uploadFriendChatBackground() {
        if (!this.currentChatFriend) return;
        const input = document.getElementById('friend-chat-bg-file');
        if (!input || !input.files || !input.files[0]) {
            this.showCustomAlert('Select an image file');
            return;
        }
        const file = input.files[0];
        const url = URL.createObjectURL(file);
        const preset = { type: 'image', value: url };
        this._saveFriendChatBackground(this.currentChatFriend.id, preset);
        this.applyChatBackground(preset);
    }

    // ===== Utilities =====
    async _centerCropToSquare(file) {
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = URL.createObjectURL(file);
        });
        const size = Math.min(img.width, img.height);
        const sx = Math.floor((img.width - size) / 2);
        const sy = Math.floor((img.height - size) / 2);
        const canvas = document.createElement('canvas');
        const target = 512;
        canvas.width = target;
        canvas.height = target;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, size, size, 0, 0, target, target);
        return await new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png', 0.95));
    }

    // ===== Avatar adjust workflow =====
    async _beginAvatarAdjust(file) {
        const previewImg = document.getElementById('avatar-preview');
        const wrapper = document.getElementById('avatar-adjust');
        const zoom = document.getElementById('avatar-zoom');
        if (!previewImg || !wrapper || !zoom) return;
        if (this._avatarAdjust?.objectUrl) {
            try { URL.revokeObjectURL(this._avatarAdjust.objectUrl); } catch {}
        }
        const objectUrl = URL.createObjectURL(file);
        previewImg.src = objectUrl;
        this._avatarAdjust = {
            originalFile: file,
            objectUrl: objectUrl,
            zoom: 1,
            croppedBlob: null,
            naturalWidth: 0,
            naturalHeight: 0,
        };
        previewImg.style.display = 'block';
        previewImg.style.width = '100%';
        previewImg.style.height = '100%';
        previewImg.style.objectFit = 'cover';
        previewImg.style.transformOrigin = 'center center';
        zoom.value = '1';
        wrapper.style.display = 'flex';

        await new Promise(resolve => {
            if (previewImg.complete) return resolve();
            previewImg.onload = () => resolve();
            previewImg.onerror = () => resolve();
        });
        this._avatarAdjust.naturalWidth = previewImg.naturalWidth || 0;
        this._avatarAdjust.naturalHeight = previewImg.naturalHeight || 0;
        this._updateAvatarPreviewTransform();
    }

    _updateAvatarPreviewTransform() {
        const previewImg = document.getElementById('avatar-preview');
        const zoomEl = document.getElementById('avatar-zoom');
        if (!previewImg || !zoomEl) return;
        const z = parseFloat(zoomEl.value || '1');
        if (!this._avatarAdjust) this._avatarAdjust = {};
        this._avatarAdjust.zoom = isFinite(z) && z > 0 ? z : 1;
        previewImg.style.transform = `scale(${this._avatarAdjust.zoom})`;
    }

    async _applyAdjustedAvatar() {
        if (!this._avatarAdjust || !this._avatarAdjust.originalFile) return;
        const file = this._avatarAdjust.originalFile;
        const zoom = this._avatarAdjust.zoom || 1;
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = this._avatarAdjust.objectUrl || URL.createObjectURL(file);
        });
        const w = img.width, h = img.height;
        const base = Math.min(w, h);
        const crop = base / (zoom > 0 ? zoom : 1);
        const sx = Math.max(0, Math.floor((w - crop) / 2));
        const sy = Math.max(0, Math.floor((h - crop) / 2));
        const canvas = document.createElement('canvas');
        const target = 512;
        canvas.width = target;
        canvas.height = target;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, crop, crop, 0, 0, target, target);
        const blob = await new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png', 0.95));
        this._avatarAdjust.croppedBlob = blob;
        await this.uploadAvatar();
    }

    _cancelAvatarAdjust() {
        const previewImg = document.getElementById('avatar-preview');
        const wrapper = document.getElementById('avatar-adjust');
        const avatarInput = document.getElementById('settings-avatar');
        if (wrapper) wrapper.style.display = 'none';
        if (previewImg) {
            previewImg.removeAttribute('src');
            previewImg.style.transform = 'none';
        }
        if (avatarInput) avatarInput.value = '';
        if (this._avatarAdjust?.objectUrl) {
            try { URL.revokeObjectURL(this._avatarAdjust.objectUrl); } catch {}
        }
        this._avatarAdjust = null;
    }

    // Text-to-sign functionality removed

    // Image gallery and text-to-sign functionality removed

    // ===== Sign-to-Text Popup Functionality =====
    openSignToTextPopup() {
        if (!this.currentChatFriend) {
            this.showCustomAlert('Please select a friend to chat with first');
            return;
        }
        
        const overlay = document.getElementById('sign-to-text-modal-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.add('active');
            this.initializeSignToTextPopup();
        }
    }
    
    closeSignToTextPopup() {
        const overlay = document.getElementById('sign-to-text-modal-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
                this.cleanupSignToTextPopup();
            }, 300);
        }
    }
    
    initializeSignToTextPopup() {
        console.log('Initializing sign-to-text popup');
        
        // Initialize variables
        this.signPopup = {
            video: document.getElementById('popup-video'),
            canvas: document.getElementById('popup-overlay'),
            ctx: null,
            status: document.getElementById('popup-status'),
            countdown: document.getElementById('popup-countdown'),
            progressBar: document.getElementById('popup-progress'),
            sentenceBox: document.getElementById('popup-sentence'),
            detectionActive: false,
            processing: false,
            lastResponse: null,
            activeTimers: {},
            serverSentence: '',
            confidenceThreshold: 0.3
        };
        
        // Check if all elements are found
        console.log('Popup elements found:', {
            video: !!this.signPopup.video,
            canvas: !!this.signPopup.canvas,
            status: !!this.signPopup.status,
            countdown: !!this.signPopup.countdown,
            progressBar: !!this.signPopup.progressBar,
            sentenceBox: !!this.signPopup.sentenceBox
        });
        
        if (!this.signPopup.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        this.signPopup.ctx = this.signPopup.canvas.getContext('2d');
        
        if (!this.signPopup.ctx) {
            console.error('Could not get 2D context from canvas!');
            return;
        }
        
        console.log('Canvas context created successfully');
        
        // Bind event handlers
        this.bindSignToTextEventHandlers();
        
        // Start camera
        this.startSignCamera();
    }
    
    bindSignToTextEventHandlers() {
        // Close button handlers
        const closeBtn = document.getElementById('sign-to-text-close-btn');
        const cancelBtn = document.getElementById('popup-cancel-btn');
        if (closeBtn) closeBtn.onclick = () => this.closeSignToTextPopup();
        if (cancelBtn) cancelBtn.onclick = () => this.closeSignToTextPopup();
        
        // Control button handlers
        const startBtn = document.getElementById('popup-start-btn');
        const stopBtn = document.getElementById('popup-stop-btn');
        const clearBtn = document.getElementById('popup-clear-btn');
        const sendBtn = document.getElementById('popup-send-btn');
        
        if (startBtn) startBtn.onclick = () => this.startSignDetection();
        if (stopBtn) stopBtn.onclick = () => this.stopSignDetection();
        if (clearBtn) clearBtn.onclick = () => this.clearSignText();
        if (sendBtn) sendBtn.onclick = () => this.sendSignMessage();
        
        // Settings are now handled by native HTML details/summary
        
        // Confidence slider
        const confidenceSlider = document.getElementById('popup-confidence-slider');
        const confidenceValue = document.getElementById('popup-confidence-value');
        
        if (confidenceSlider && confidenceValue) {
            confidenceSlider.oninput = async () => {
                const newValue = parseFloat(confidenceSlider.value);
                confidenceValue.textContent = newValue;
                this.signPopup.confidenceThreshold = newValue;
                
                try {
                    const response = await fetch('/set_confidence_threshold', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({confidence_threshold: newValue})
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        this.signPopup.countdown.textContent = `Confidence threshold updated to ${newValue}`;
                        setTimeout(() => {
                            this.signPopup.countdown.textContent = '';
                        }, 2000);
                    }
                } catch (error) {
                    console.error('Confidence threshold update error:', error);
                }
            };
        }
        
        // Style enhancement
        const applyStyleBtn = document.getElementById('popup-apply-style');
        if (applyStyleBtn) {
            applyStyleBtn.onclick = () => this.applySignStyleEnhancement();
        }
        
        // Language translation
        const applyLanguageBtn = document.getElementById('popup-apply-language');
        if (applyLanguageBtn) {
            applyLanguageBtn.onclick = () => this.applySignLanguageTranslation();
        }
        
        // Text input handler
        if (this.signPopup.sentenceBox) {
            this.signPopup.sentenceBox.oninput = () => {
                this.updateSendButton();
            };
        }
        
        // TTS event handlers
        this.bindTTSEventHandlers();
        
        // Close on overlay click
        const overlay = document.getElementById('sign-to-text-modal-overlay');
        if (overlay) {
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    this.closeSignToTextPopup();
                }
            };
        }
        
        // Escape key handler
        this.signPopupKeyHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeSignToTextPopup();
            }
        };
        document.addEventListener('keydown', this.signPopupKeyHandler);
    }
    
    bindTTSEventHandlers() {
        const speakBtn = document.getElementById('popupSpeakBtn');
        
        // Initialize TTS variables if not already done
        if (!this.speechSynthesis) {
            this.speechSynthesis = window.speechSynthesis;
            this.currentUtterance = null;
        }
        
        // Speak button handler
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                const text = this.signPopup.sentenceBox.textContent.trim();
                if (!text) {
                    this.showCustomAlert('No text to speak');
                    return;
                }
                
                // If already speaking, stop current speech
                if (this.speechSynthesis.speaking) {
                    this.speechSynthesis.cancel();
                    speakBtn.classList.remove('speaking');
                    speakBtn.querySelector('span').textContent = 'Speak';
                    this.currentUtterance = null;
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
                    this.currentUtterance = utterance;
                };
                
                utterance.onend = () => {
                    speakBtn.classList.remove('speaking');
                    speakBtn.querySelector('span').textContent = 'Speak';
                    this.currentUtterance = null;
                };
                
                utterance.onerror = (event) => {
                    console.error('Speech synthesis error:', event);
                    speakBtn.classList.remove('speaking');
                    speakBtn.querySelector('span').textContent = 'Speak';
                    this.showCustomAlert('Error speaking text');
                    this.currentUtterance = null;
                };
                
                this.speechSynthesis.speak(utterance);
            });
        }
    }
    
    async startSignCamera() {
        try {
            this.signPopup.status.textContent = 'Status: Requesting camera access...';
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
            
            this.signPopup.video.srcObject = stream;
            console.log('Video stream assigned:', stream);
            
            // Wait for video metadata to load
            await new Promise((resolve, reject) => {
                this.signPopup.video.onloadedmetadata = () => {
                    console.log('Video metadata loaded');
                    resolve();
                };
                this.signPopup.video.onerror = (e) => {
                    console.error('Video error:', e);
                    reject(e);
                };
                // Set a timeout in case metadata never loads
                setTimeout(() => resolve(), 3000);
            });
            
            // Try to play the video
            try {
                await this.signPopup.video.play();
                console.log('Video is playing');
            } catch (playError) {
                console.warn('Autoplay failed, but continuing:', playError);
            }
            
            // Hide placeholder and show video
            const placeholder = document.getElementById('popup-video-placeholder');
            if (placeholder) placeholder.style.display = 'none';
            this.signPopup.video.style.display = 'block';
            
            // Setup canvas after a short delay
            setTimeout(() => {
                this.resizeSignCanvas();
                console.log('Canvas resized');
            }, 1000);
            
            // Add event listeners
            const resizeHandler = () => this.resizeSignCanvas();
            window.addEventListener('resize', resizeHandler);
            this.signPopup.video.addEventListener('loadedmetadata', resizeHandler);
            
            this.signPopup.status.textContent = 'Status: Camera started. Ready to detect signs.';
            
            // Start the detection loop
            this.startSignLoop();
            
        } catch (err) {
            console.error('Camera initialization error:', err);
            
            let errorMessage = 'Error: Unable to access camera. ';
            if (err.name === 'NotAllowedError') {
                errorMessage += 'Please allow camera access and try again.';
            } else if (err.name === 'NotFoundError') {
                errorMessage += 'No camera found on this device.';
            } else if (err.name === 'NotSupportedError') {
                errorMessage += 'Camera not supported by browser.';
            } else {
                errorMessage += err.message || 'Unknown error occurred.';
            }
            
            this.signPopup.status.textContent = errorMessage;
            
            // Show placeholder with error message
            const placeholder = document.getElementById('popup-video-placeholder');
            if (placeholder) {
                placeholder.style.display = 'flex';
                placeholder.innerHTML = `
                    <div class="icon">⚠️</div>
                    <div>Camera Error</div>
                    <div style="font-size: 0.9rem; opacity: 0.8; text-align: center; margin: 8px 0;">Check permissions and try again</div>
                    <button onclick="window.chatApp.retryCamera()" style="
                        background: rgba(103, 126, 234, 0.8);
                        border: 1px solid rgba(103, 126, 234, 0.3);
                        color: white;
                        padding: 8px 16px;
                        border-radius: 8px;
                        font-size: 0.8rem;
                        cursor: pointer;
                        margin-top: 8px;
                    ">Retry Camera</button>
                `;
            }
        }
    }
    
    resizeSignCanvas() {
        if (!this.signPopup || !this.signPopup.video || !this.signPopup.canvas) {
            console.warn('SignPopup elements not available for canvas resize');
            return;
        }
        
        const videoWidth = this.signPopup.video.videoWidth;
        const videoHeight = this.signPopup.video.videoHeight;
        const container = this.signPopup.video.parentElement;
        
        console.log('Canvas resize - video dimensions:', videoWidth, 'x', videoHeight);
        console.log('Container dimensions:', container.clientWidth, 'x', container.clientHeight);
        
        if (!videoWidth || !videoHeight) {
            console.warn('Video dimensions not available yet');
            return;
        }
        
        // Set canvas to match video's actual dimensions
        this.signPopup.canvas.width = videoWidth;
        this.signPopup.canvas.height = videoHeight;
        
        // Position canvas to match video's display size and position
        const videoRect = this.signPopup.video.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate video's actual display size within container
        const videoAspectRatio = videoWidth / videoHeight;
        const containerAspectRatio = container.clientWidth / container.clientHeight;
        
        let displayWidth, displayHeight;
        
        if (videoAspectRatio > containerAspectRatio) {
            // Video is wider than container - fit to width
            displayWidth = container.clientWidth;
            displayHeight = container.clientWidth / videoAspectRatio;
        } else {
            // Video is taller than container - fit to height
            displayHeight = container.clientHeight;
            displayWidth = container.clientHeight * videoAspectRatio;
        }
        
        // Position canvas to overlay the video exactly
        this.signPopup.canvas.style.width = displayWidth + 'px';
        this.signPopup.canvas.style.height = displayHeight + 'px';
        this.signPopup.canvas.style.position = 'absolute';
        this.signPopup.canvas.style.top = '50%';
        this.signPopup.canvas.style.left = '50%';
        this.signPopup.canvas.style.transform = 'translate(-50%, -50%)';
        
        console.log('Canvas display size:', displayWidth, 'x', displayHeight);
        console.log('Canvas resized to:', this.signPopup.canvas.width, 'x', this.signPopup.canvas.height);
    }
    
    startSignLoop() {
        if (!this.signPopup) return;
        
        if (this.signPopup.video.videoWidth && this.signPopup.video.videoHeight) {
            this.signPopup.ctx.clearRect(0, 0, this.signPopup.canvas.width, this.signPopup.canvas.height);
            this.signPopup.ctx.drawImage(this.signPopup.video, 0, 0, this.signPopup.canvas.width, this.signPopup.canvas.height);
        }
        
        if (this.signPopup.detectionActive && !this.signPopup.processing) {
            this.signPopup.processing = true;
            this.sendSignFrame().then(json => {
                this.signPopup.lastResponse = json;
                this.signPopup.processing = false;
                
                if (json.sentence) {
                    const newText = json.sentence;
                    const isCountdownText = this.signPopup.serverSentence.includes('Detection will start') ||
                                           this.signPopup.serverSentence.includes('Detection started') ||
                                           this.signPopup.serverSentence.trim() === '';
                    
                    if (isCountdownText || !newText.startsWith(this.signPopup.serverSentence)) {
                        this.signPopup.sentenceBox.textContent = newText;
                    } else {
                        const toAppend = newText.slice(this.signPopup.serverSentence.length);
                        if (toAppend) this.signPopup.sentenceBox.textContent += toAppend;
                    }
                    this.signPopup.serverSentence = this.signPopup.sentenceBox.textContent;
                    this.updateSendButton();
                }
                
                this.updateSignTimers(json.countdowns);
            }).catch(() => {
                this.signPopup.processing = false;
            });
        }
        
        if (this.signPopup.lastResponse && this.signPopup.lastResponse.boxes) {
            this.signPopup.ctx.font = '16px Arial';
            for (const box of this.signPopup.lastResponse.boxes) {
                this.drawSignBox(box);
            }
            this.signPopup.status.textContent = `Status: ${this.signPopup.lastResponse.boxes.length} signs detected`;
        }
        
        this.renderSignTimer();
        
        if (this.signPopup) {
            requestAnimationFrame(() => this.startSignLoop());
        }
    }
    
    async sendSignFrame() {
        if (!this.signPopup.video.videoWidth || !this.signPopup.detectionActive) {
            return {boxes: [], sentence: this.signPopup.sentenceBox.textContent, countdowns: {}};
        }
        
        const offCanvas = document.createElement('canvas');
        offCanvas.width = this.signPopup.video.videoWidth;
        offCanvas.height = this.signPopup.video.videoHeight;
        offCanvas.getContext('2d').drawImage(this.signPopup.video, 0, 0, offCanvas.width, offCanvas.height);
        
        const dataUrl = offCanvas.toDataURL('image/jpeg', 0.7);
        
        try {
            const res = await fetch('/detect', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({image: dataUrl})
            });
            return await res.json();
        } catch (e) {
            console.error(e);
            return {boxes: [], sentence: this.signPopup.sentenceBox.textContent, countdowns: {}};
        }
    }
    
    updateSignTimers(countdowns) {
        this.signPopup.activeTimers = {};
        if (countdowns) {
            for (const k in countdowns) {
                const cd = countdowns[k];
                if (cd) {
                    this.signPopup.activeTimers[k] = { ...cd };
                    // Log safely without assuming label exists on all timers
                    const labelPart = typeof cd.label === 'string' && cd.label ? ` - ${cd.label}` : '';
                    try { console.log(`Timer updated: ${k}${labelPart} - ${Number(cd.remaining).toFixed(1)}s`); } catch {}
                }
            }
        }
    }
    
    renderSignTimer() {
        if (!this.signPopup || !this.signPopup.countdown || !this.signPopup.progressBar) {
            return;
        }
        
        let text = '', progress = 0;
        let hasActiveTimer = false;
        
        if (this.signPopup.activeTimers.hold) {
            const cd = this.signPopup.activeTimers.hold;
            const label = typeof cd.label === 'string' && cd.label ? cd.label : 'sign';
            text = `✋ Hold "${label}" for ${cd.remaining.toFixed(1)}s (keep steady)`;
            progress = ((cd.duration - cd.remaining) / cd.duration) * 100;
            hasActiveTimer = true;
        } else if (this.signPopup.activeTimers.space) {
            const cd = this.signPopup.activeTimers.space;
            text = `⏳ Pause detected — adding space in ${cd.remaining.toFixed(1)}s`;
            progress = ((cd.duration - cd.remaining) / cd.duration) * 100;
            hasActiveTimer = true;
        } else if (this.signPopup.activeTimers.fullstop) {
            const cd = this.signPopup.activeTimers.fullstop;
            text = `⏳ Long pause — adding full stop in ${cd.remaining.toFixed(1)}s`;
            progress = ((cd.duration - cd.remaining) / cd.duration) * 100;
            hasActiveTimer = true;
        } else if (this.signPopup.activeTimers.comma) {
            const cd = this.signPopup.activeTimers.comma;
            text = `⏳ Short pause — adding comma in ${cd.remaining.toFixed(1)}s`;
            progress = ((cd.duration - cd.remaining) / cd.duration) * 100;
            hasActiveTimer = true;
        }
        
        if (hasActiveTimer) {
            this.signPopup.countdown.textContent = text;
            this.signPopup.progressBar.style.width = progress + '%';
            
            // Ensure the progress container is visible and announced
            const container = this.signPopup.progressBar.parentElement;
            if (container) container.style.display = 'block';
        } else {
            // Only clear if we're not in other states
            const txt = this.signPopup.countdown.textContent || '';
            if (!txt.includes('Detection') && !txt.includes('Processing') && !txt.includes('Error')) {
                this.signPopup.countdown.textContent = '';
                this.signPopup.progressBar.style.width = '0%';
            }
        }
    }
    
    drawSignBox(box) {
        const x = box.x1, y = box.y1, w = box.x2 - box.x1, h = box.y2 - box.y1;
        this.signPopup.ctx.lineWidth = 2;
        this.signPopup.ctx.strokeStyle = 'lime';
        this.signPopup.ctx.strokeRect(x, y, w, h);
        
        const label = `${box.class} ${(box.conf * 100).toFixed(1)}%`;
        this.signPopup.ctx.fillStyle = 'rgba(0,0,0,0.6)';
        this.signPopup.ctx.fillRect(x, y - 22, this.signPopup.ctx.measureText(label).width + 10, 22);
        this.signPopup.ctx.fillStyle = 'white';
        this.signPopup.ctx.fillText(label, x + 5, y - 6);
    }
    
    async startSignDetection() {
        this.signPopup.activeTimers = {};
        this.signPopup.countdown.textContent = 'Detection will start in 2 seconds...';
        this.signPopup.progressBar.style.width = '0%';
        
        // Disable start button, enable stop button
        const startBtn = document.getElementById('popup-start-btn');
        const stopBtn = document.getElementById('popup-stop-btn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Starting...';
        }
        if (stopBtn) {
            stopBtn.disabled = false;
        }
        
        setTimeout(async () => {
            this.signPopup.detectionActive = true;
            this.signPopup.sentenceBox.setAttribute('contenteditable', 'false');
            this.signPopup.countdown.textContent = 'Detection active - perform signs now!';
            this.signPopup.serverSentence = this.signPopup.sentenceBox.textContent;
            
            if (startBtn) {
                startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Detecting...</span>';
            }
            
            // Add recording indicator to video section
            const videoSection = document.querySelector('.popup-video-section');
            if (videoSection) {
                videoSection.classList.add('recording');
            }
            
            await fetch('/resume_detection', {method: 'POST'}).catch(() => {});
            
            try {
                await fetch('/set_sentence', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({sentence: this.signPopup.serverSentence, pause: false})
                });
            } catch (e) {
                console.error(e);
            }
        }, 2000);
    }
    
    async stopSignDetection() {
        this.signPopup.detectionActive = false;
        const detectedText = this.signPopup.sentenceBox.textContent.trim();
        
        // Reset button states
        const startBtn = document.getElementById('popup-start-btn');
        const stopBtn = document.getElementById('popup-stop-btn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fa-solid fa-play"></i><span>Start Detection</span>';
        }
        if (stopBtn) {
            stopBtn.disabled = true;
        }
        
        // Remove recording indicator
        const videoSection = document.querySelector('.popup-video-section');
        if (videoSection) {
            videoSection.classList.remove('recording');
        }
        
        if (detectedText) {
            this.signPopup.sentenceBox.setAttribute('contenteditable', 'true');
            this.signPopup.countdown.textContent = 'Processing detected sentence...';
            this.signPopup.progressBar.style.width = '0%';
            
            try {
                // Apply grammar correction
                const grammarResponse = await fetch('/sentence_correction', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({text: detectedText})
                });
                
                const grammarData = await grammarResponse.json();
                
                if (grammarData.error) {
                    this.signPopup.countdown.textContent = 'Error in grammar correction: ' + grammarData.error;
                    return;
                }
                
                let finalText = grammarData.corrected;
                
                // Check if style enhancement is active
                const styleContent = document.getElementById('popup-style-content');
                if (styleContent && styleContent.classList.contains('active')) {
                    const styleSelect = document.getElementById('popup-style-select');
                    const selectedStyle = styleSelect.value;
                    
                    const styleResponse = await fetch('/style_enhancement', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({text: finalText, style: selectedStyle})
                    });
                    
                    const styleData = await styleResponse.json();
                    
                    if (!styleData.error) {
                        finalText = styleData.enhanced;
                    }
                }
                
                // Replace the detected text with the processed text
                this.signPopup.sentenceBox.textContent = finalText;
                this.signPopup.countdown.textContent = 'Sentence processed and corrected successfully!';
                this.updateSendButton();
                
            } catch (err) {
                console.error(err);
                this.signPopup.countdown.textContent = 'Error processing sentence. Check connection.';
            }
        } else {
            this.signPopup.sentenceBox.setAttribute('contenteditable', 'true');
            this.signPopup.countdown.textContent = 'Detection stopped. No sentence detected.';
        }
        
        this.signPopup.progressBar.style.width = '0%';
        this.signPopup.serverSentence = this.signPopup.sentenceBox.textContent;
        this.signPopup.activeTimers = {};
        
        await fetch('/set_sentence', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({sentence: this.signPopup.serverSentence, pause: true})
        }).catch(() => {});
    }
    
    async clearSignText() {
        await fetch('/reset', {method: 'POST'}).catch(() => {});
        this.signPopup.sentenceBox.textContent = '';
        this.signPopup.countdown.textContent = '';
        this.signPopup.progressBar.style.width = '0%';
        this.signPopup.activeTimers = {};
        this.signPopup.serverSentence = '';
        this.signPopup.detectionActive = false;
        
        console.log('Sign text cleared, timers reset');
        
        // Reset button states
        const startBtn = document.getElementById('popup-start-btn');
        const stopBtn = document.getElementById('popup-stop-btn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fa-solid fa-play"></i><span>Start Detection</span>';
        }
        if (stopBtn) {
            stopBtn.disabled = true;
        }
        
        // Remove recording indicator
        const videoSection = document.querySelector('.popup-video-section');
        if (videoSection) {
            videoSection.classList.remove('recording');
        }
        
        this.updateSendButton();
    }
    
    async applySignStyleEnhancement() {
        const currentText = this.signPopup.sentenceBox.textContent.trim();
        const styleSelect = document.getElementById('popup-style-select');
        const selectedStyle = styleSelect.value;
        
        if (!currentText) {
            this.signPopup.countdown.textContent = 'No text to enhance. Please add some text first.';
            return;
        }
        
        const applyBtn = document.getElementById('popup-apply-style');
        applyBtn.disabled = true;
        applyBtn.textContent = 'Applying...';
        this.signPopup.countdown.textContent = 'Applying style enhancement...';
        
        // Start progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
            if (progress >= 95) progress = 95;
            this.signPopup.progressBar.style.width = progress + '%';
        }, 200);
        
        try {
            const response = await fetch('/style_enhancement', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({text: currentText, style: selectedStyle})
            });
            
            const data = await response.json();
            
            if (data.error) {
                this.signPopup.countdown.textContent = 'Error: ' + data.error;
            } else {
                this.signPopup.sentenceBox.textContent = data.enhanced;
                this.signPopup.serverSentence = data.enhanced;
                this.signPopup.countdown.textContent = 'Style applied successfully!';
                this.updateSendButton();
            }
            
        } catch (error) {
            console.error('Style enhancement error:', error);
            this.signPopup.countdown.textContent = 'Error applying style. Please check your connection.';
        } finally {
            clearInterval(progressInterval);
            this.signPopup.progressBar.style.width = '100%';
            setTimeout(() => {
                this.signPopup.progressBar.style.width = '0%';
            }, 500);
            
            applyBtn.disabled = false;
            applyBtn.textContent = 'Apply Style';
        }
    }
    
    async applySignLanguageTranslation() {
        const currentText = this.signPopup.sentenceBox.textContent.trim();
        const languageSelect = document.getElementById('popup-language-select');
        const selectedLanguage = languageSelect.value;
        
        if (!currentText) {
            this.signPopup.countdown.textContent = 'No text to translate. Please add some text first.';
            return;
        }
        
        const applyBtn = document.getElementById('popup-apply-language');
        applyBtn.disabled = true;
        applyBtn.textContent = 'Translating...';
        this.signPopup.countdown.textContent = `Translating to ${selectedLanguage}...`;
        
        // Start progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
            if (progress >= 95) progress = 95;
            this.signPopup.progressBar.style.width = progress + '%';
        }, 200);
        
        try {
            const response = await fetch('/language_conversion', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({text: currentText, language: selectedLanguage})
            });
            
            const data = await response.json();
            
            if (data.error) {
                this.signPopup.countdown.textContent = 'Error: ' + data.error;
            } else {
                this.signPopup.sentenceBox.textContent = data.translated;
                this.signPopup.serverSentence = data.translated;
                this.signPopup.countdown.textContent = `Text translated to ${data.language} successfully!`;
                this.updateSendButton();
            }
            
        } catch (error) {
            console.error('Language translation error:', error);
            this.signPopup.countdown.textContent = 'Error translating text. Please check your connection.';
        } finally {
            clearInterval(progressInterval);
            this.signPopup.progressBar.style.width = '100%';
            setTimeout(() => {
                this.signPopup.progressBar.style.width = '0%';
            }, 500);
            
            applyBtn.disabled = false;
            applyBtn.textContent = 'Translate Text';
        }
    }
    
    updateSendButton() {
        const sendBtn = document.getElementById('popup-send-btn');
        const text = this.signPopup.sentenceBox.textContent.trim();
        
        if (sendBtn) {
            sendBtn.disabled = !text || !this.currentChatFriend;
        }
        
        // Update TTS section visibility
        this.updateTTSVisibility();
    }
    
    updateTTSVisibility() {
        const ttsSection = document.getElementById('popupTtsSection');
        const text = this.signPopup.sentenceBox.textContent.trim();
        
        if (ttsSection) {
            if (text) {
                ttsSection.style.display = 'block';
            } else {
                ttsSection.style.display = 'none';
            }
        }
    }
    
    async sendSignMessage() {
        const text = this.signPopup.sentenceBox.textContent.trim();
        
        if (!text) {
            this.showCustomAlert('No text to send');
            return;
        }
        
        if (!this.currentChatFriend) {
            this.showCustomAlert('Please select a friend to chat with');
            return;
        }
        
        try {
            const res = await fetch(`${this.API_BASE}/send_message`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    sender_id: this.currentUser.id,
                    receiver_id: this.currentChatFriend.id,
                    text: text
                })
            });
            
            if (res.ok) {
                // Message sent successfully, close the popup
                this.closeSignToTextPopup();
            } else {
                const err = await res.json();
                this.showCustomAlert(err.error || 'Error sending message');
            }
        } catch (error) {
            console.error('Send message error:', error);
            this.showCustomAlert('Network error sending message');
        }
    }
    
    cleanupSignToTextPopup() {
        if (this.signPopup) {
            // Stop camera stream
            if (this.signPopup.video && this.signPopup.video.srcObject) {
                const stream = this.signPopup.video.srcObject;
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
                this.signPopup.video.srcObject = null;
            }
            
            // Remove event listeners
            if (this.signPopupKeyHandler) {
                document.removeEventListener('keydown', this.signPopupKeyHandler);
                this.signPopupKeyHandler = null;
            }
            
            // Clear detection
            this.signPopup.detectionActive = false;
            
            // Reset elements
            const placeholder = document.getElementById('popup-video-placeholder');
            if (placeholder) placeholder.style.display = 'flex';
            if (this.signPopup.video) this.signPopup.video.style.display = 'none';
            
            // Reset button states
            const startBtn = document.getElementById('popup-start-btn');
            const stopBtn = document.getElementById('popup-stop-btn');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fa-solid fa-play"></i><span>Start Detection</span>';
            }
            if (stopBtn) {
                stopBtn.disabled = true;
            }
            
            // Clear popup object
            this.signPopup = null;
        }
    }
    
    // Retry camera initialization
    retryCamera() {
        if (this.signPopup) {
            console.log('Retrying camera initialization');
            
            // Reset placeholder
            const placeholder = document.getElementById('popup-video-placeholder');
            if (placeholder) {
                placeholder.style.display = 'flex';
                placeholder.innerHTML = `
                    <div class="icon">📹</div>
                    <div>Retrying camera...</div>
                    <div style="font-size: 0.8rem; opacity: 0.7;">Please allow camera access</div>
                `;
            }
            
            // Try to start camera again
            this.startSignCamera();
        }
    }

}

// Global functions for HTML onclick events
async function createNewAccount() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    if (!username || !password) {
        window.chatApp.showCustomAlert('Enter username and password');
        return;
    }
    await window.chatApp.createNewAccount(username, password);
}

// Separate alias for the button used in HTML
async function registerAccount() {
    await createNewAccount();
}

async function loginWithCode() {
    await window.chatApp.loginWithCode();
}

async function setLegacyPassword() {
    await window.chatApp.setLegacyPassword();
}

function copyUserCode() {
    window.chatApp.copyUserCode();
}

function logout() {
    window.chatApp.logout();
}

async function addFriend() {
    await window.chatApp.addFriend();
}

async function sendMessage() {
    await window.chatApp.sendMessage();
}

function handleMessageKeyPress(event) {
    window.chatApp.handleMessageKeyPress(event);
}
