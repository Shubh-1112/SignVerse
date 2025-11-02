// Main JavaScript functionality
class LandingPage {
    constructor() {
        this.init();
    }
    
    init() {
        this.initLoadingScreen();
        this.initNavigation();
        this.initFAQ();
        this.initScrollEffects();
        this.initCardParticles();
        this.bindEvents();
    }

    // Loading screen functionality
    initLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const progressBar = document.querySelector('.progress-bar');

        if (!loadingScreen || !progressBar) return;

        // Simulate loading progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15; // Random increment for realistic feel
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(() => {
                    loadingScreen.classList.add('hidden');
                    // Show chatbot after loading screen is hidden
                    const chatbotToggle = document.getElementById('chatbot-toggle');
                    if (chatbotToggle) {
                        chatbotToggle.classList.remove('hidden');
                    }
                }, 500);
            }
            progressBar.style.transform = `scaleX(${progress / 100})`;
        }, 100);
    }

    // Navigation functionality
    initNavigation() {
        const navbar = document.getElementById('navbar');
        const navToggle = document.getElementById('nav-toggle');
        const profileToggle = document.getElementById('profile-toggle');
        const profileSlider = document.getElementById('profile-slider');
        const menuSlider = document.getElementById('menu-slider');

        // Menu slider toggle
        if (navToggle && menuSlider) {
            navToggle.addEventListener('click', () => {
                menuSlider.classList.toggle('active');
            });
        }

        // Profile slider toggle
        if (profileToggle && profileSlider) {
            profileToggle.addEventListener('click', () => {
                profileSlider.classList.toggle('active');
            });

            // Close profile slider when clicking outside
            document.addEventListener('click', (e) => {
                if (!profileToggle.contains(e.target) && !profileSlider.contains(e.target)) {
                    profileSlider.classList.remove('active');
                }
            });
        }

        // Close menu slider when clicking outside or on links
        if (menuSlider) {
            menuSlider.addEventListener('click', (e) => {
                if (e.target === menuSlider) {
                    menuSlider.classList.remove('active');
                }
            });

            document.querySelectorAll('.menu-link').forEach(link => {
                link.addEventListener('click', () => {
                    menuSlider.classList.remove('active');
                });
            });
        }

        // Close sliders when clicking on profile slider links
        document.querySelectorAll('.slider-link').forEach(link => {
            link.addEventListener('click', () => {
                if (profileSlider) {
                    profileSlider.classList.remove('active');
                }
            });
        });

        // Navbar scroll effect
        const throttledNavbarUpdate = utils.throttle(() => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }, 16);
        window.addEventListener('scroll', throttledNavbarUpdate, { passive: true });

        // Active link highlighting
        this.updateActiveNavLink();
        const throttledNavLinkUpdate = utils.throttle(() => this.updateActiveNavLink(), 16);
        window.addEventListener('scroll', throttledNavLinkUpdate, { passive: true });
    }
    
    updateActiveNavLink() {
        const sections = document.querySelectorAll('section[id]');
        const scrollY = window.pageYOffset;
        
        sections.forEach(section => {
            const sectionHeight = section.offsetHeight;
            const sectionTop = section.offsetTop - 100;
            const sectionId = section.getAttribute('id');
            const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);
            
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                if (navLink) {
                    navLink.classList.add('active');
                }
            }
        });
    }
    
    // FAQ accordion
    initFAQ() {
        const faqItems = document.querySelectorAll('.faq-item');

        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');

            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');

                // Close all FAQ items
                faqItems.forEach(faqItem => {
                    faqItem.classList.remove('active');
                });

                // Open clicked item if it wasn't active
                if (!isActive) {
                    item.classList.add('active');
                }
            });
        });
    }
    
    // Scroll effects
    initScrollEffects() {
        // Parallax effect for hero section
        const throttledParallax = utils.throttle(() => {
            const scrolled = window.pageYOffset;
            const heroContent = document.querySelector('.hero-content');
            const heroVisual = document.querySelector('.hero-visual');

            if (heroContent && heroVisual) {
                const rate = scrolled * -0.3;
                heroContent.style.transform = `translateY(${rate}px)`;
                heroVisual.style.transform = `translateY(${rate * 0.5}px)`;
            }
        }, 16);
        window.addEventListener('scroll', throttledParallax, { passive: true });

        // Scroll progress bar animation
        this.initScrollProgress();

        // Scrollbar visibility
        this.initScrollbarVisibility();



        // Optional: subtle parallax effect on features section background
        const featuresSection = document.querySelector('.features-section');
        if (featuresSection) {
            const throttledFeaturesParallax = utils.throttle(() => {
                const scrolled = window.pageYOffset;
                const rate = scrolled * -0.1;
                featuresSection.style.backgroundPosition = `center calc(50% + ${rate}px)`;
            }, 16);
            window.addEventListener('scroll', throttledFeaturesParallax, { passive: true });
        }
    }

    // Scroll progress bar animation
    initScrollProgress() {
        const progressFill = document.querySelector('.progress-fill');

        if (!progressFill) return;

        const updateScrollProgress = () => {
            const scrollTop = window.pageYOffset;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = (scrollTop / docHeight) * 100;

            // Use transform for better performance
            progressFill.style.transform = `scaleX(${scrollPercent / 100})`;
        };

        // Throttle the scroll progress updates for better performance
        const throttledUpdate = utils.throttle(updateScrollProgress, 16);

        // Update progress on scroll
        window.addEventListener('scroll', throttledUpdate, { passive: true });

        // Initial update
        updateScrollProgress();
    }

    // Scrollbar visibility toggle
    initScrollbarVisibility() {
        let scrollTimer;

        const showScrollbar = () => {
            document.body.classList.add('scrolling');
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                document.body.classList.remove('scrolling');
            }, 1000); // Hide scrollbar after 1 second of no scrolling
        };

        // Throttle scrollbar visibility updates
        const throttledShowScrollbar = utils.throttle(showScrollbar, 100);

        // Show scrollbar on scroll
        window.addEventListener('scroll', throttledShowScrollbar, { passive: true });

        // Show scrollbar on mouse wheel
        window.addEventListener('wheel', throttledShowScrollbar, { passive: true });

        // Show scrollbar on touch move
        window.addEventListener('touchmove', throttledShowScrollbar, { passive: true });
    }

    // Card particles
    initCardParticles() {
        const trustCards = document.querySelectorAll('.trust-card');
        const heroCards = document.querySelectorAll('.hero-visual .card');
        this.cardParticles = [];

        // Initialize particles for trust cards
        trustCards.forEach(card => {
            const particleSystem = new CardParticleSystem(card);
            this.cardParticles.push(particleSystem);

            card.addEventListener('mouseenter', () => {
                particleSystem.start();
            });

            card.addEventListener('mouseleave', () => {
                particleSystem.stop();
            });
        });

        // Initialize particles for hero visual cards
        heroCards.forEach(card => {
            const particleSystem = new CardParticleSystem(card);
            this.cardParticles.push(particleSystem);

            card.addEventListener('mouseenter', () => {
                particleSystem.start();
            });

            card.addEventListener('mouseleave', () => {
                particleSystem.stop();
            });
        });
    }
    
    // Trigger animations for elements already in view on page load
    triggerInitialAnimations() {
        document.querySelectorAll('.feature-card, .stat-item, .trust-card, .faq-item, .scroll-animate').forEach(el => {
            const rect = el.getBoundingClientRect();
            const windowHeight = window.innerHeight || document.documentElement.clientHeight;
            if (rect.top <= windowHeight * 0.9 && rect.bottom >= 0) {
                el.classList.add('animate');
            }
        });
    }

    // Bind additional events
    bindEvents() {
        // Button click effects
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                // Create ripple effect
                const ripple = document.createElement('span');
                ripple.classList.add('ripple');
                ripple.style.left = e.offsetX + 'px';
                ripple.style.top = e.offsetY + 'px';

                this.appendChild(ripple);

                setTimeout(() => {
                    ripple.remove();
                }, 600);
            });
        });

        // Smooth scroll for CTA buttons
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                if (this.textContent.includes('Get Started') || this.textContent.includes('Start Free Trial')) {
                    e.preventDefault();
                    // Removed alert popup as per user request
                    // alert('Sign-up functionality would be implemented here!');
                }
            });
        });

        // Logout button handler
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                try {
                    const response = await fetch('/logout', {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    const data = await response.json();
                    if (data.success) {
                        utils.showCustomPopup(data.message, 'success');
                        // Do not redirect after logout success as per user request
                    } else if (response.status === 401) {
                        utils.showCustomPopup('Please login first.', 'error');
                    } else {
                        utils.showCustomPopup('Logout failed: ' + data.message, 'error');
                    }
                } catch (error) {
                    console.error('Logout error:', error);
                    utils.showCustomPopup('An error occurred during logout. Please try again.', 'error');
                }
            });
        }

        // Intersection Observer for animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate');
                } else {
                    entry.target.classList.remove('animate');
                }
            });
        }, observerOptions);

        // Observe all animatable elements
        document.querySelectorAll('.feature-card, .stat-item, .trust-card, .faq-item, .scroll-animate').forEach(el => {
            observer.observe(el);
        });
    }


}

// Utility functions
const utils = {
    // Debounce function
    debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Custom popup function
    showCustomPopup(message, type = 'info') {
        const popup = document.createElement('div');
        popup.className = `custom-popup ${type}`;
        popup.innerHTML = `
            <div class="popup-content">
                <span class="popup-message">${message}</span>
                <button class="popup-close">&times;</button>
            </div>
        `;
        document.body.appendChild(popup);

        // Show popup
        setTimeout(() => popup.classList.add('show'), 10);

        // Auto hide after 3 seconds
        setTimeout(() => {
            popup.classList.remove('show');
            setTimeout(() => popup.remove(), 300);
        }, 3000);

        // Close on click
        popup.querySelector('.popup-close').addEventListener('click', () => {
            popup.classList.remove('show');
            setTimeout(() => popup.remove(), 300);
        });
    }
};

// Initialize the landing page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new LandingPage();

    // Hide Spline watermark with JavaScript as fallback
    hideSplineWatermark();

    // Chatbot toggle functionality
    const chatbotToggle = document.getElementById('chatbot-toggle');
    const chatbotModal = document.getElementById('chatbot-modal');
    const chatbotClose = document.getElementById('chatbot-close');
    const chatbotSend = document.getElementById('chatbot-send');
    const chatbotInput = document.getElementById('chatbot-input');
    const chatbotMessages = document.getElementById('chatbot-messages');

    if (chatbotToggle && chatbotModal && chatbotClose && chatbotSend && chatbotInput && chatbotMessages) {
        // Load saved chatbot size from localStorage
        const savedWidth = localStorage.getItem('chatbotWidth');
        const savedHeight = localStorage.getItem('chatbotHeight');

        if (savedWidth && savedHeight) {
            chatbotModal.style.width = savedWidth;
            chatbotModal.style.height = savedHeight;
        }

        chatbotToggle.addEventListener('click', () => {
            chatbotModal.classList.toggle('active');
            if (chatbotModal.classList.contains('active')) {
                chatbotInput.focus();
            }
        });

        chatbotClose.addEventListener('click', () => {
            chatbotModal.classList.remove('active');
        });

        // Chatbot resize functionality - 8-way resize
        let isResizing = false;
        let startX, startY, startWidth, startHeight, resizeDirection;

        const startResize = (e, direction) => {
            isResizing = true;
            resizeDirection = direction;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(getComputedStyle(chatbotModal).width, 10);
            startHeight = parseInt(getComputedStyle(chatbotModal).height, 10);

            chatbotModal.classList.add('resizing');
            document.body.style.userSelect = 'none';

            // Set appropriate cursor
            const cursors = {
                'n': 'n-resize',
                's': 's-resize',
                'e': 'e-resize',
                'w': 'w-resize',
                'ne': 'ne-resize',
                'nw': 'nw-resize',
                'se': 'se-resize',
                'sw': 'sw-resize'
            };
            document.body.style.cursor = cursors[direction] || 'default';

            // Prevent default behavior
            e.preventDefault();
        };

        const resize = (e) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = parseInt(getComputedStyle(chatbotModal).left) || 0;
            let newTop = parseInt(getComputedStyle(chatbotModal).top) || 0;

            // Apply constraints
            const minWidth = 280;
            const maxWidth = 600;
            const minHeight = 350;
            const maxHeight = window.innerHeight * 0.8;

            // Calculate new dimensions based on resize direction
            switch (resizeDirection) {
                case 'n': // Top edge
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
                    newTop = startY + deltaY;
                    break;
                case 's': // Bottom edge
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
                    break;
                case 'e': // Right edge
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
                    break;
                case 'w': // Left edge
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
                    newLeft = startX + deltaX;
                    break;
                case 'ne': // Top-right corner
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
                    newTop = startY + deltaY;
                    break;
                case 'nw': // Top-left corner
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
                    newLeft = startX + deltaX;
                    newTop = startY + deltaY;
                    break;
                case 'se': // Bottom-right corner
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
                    break;
                case 'sw': // Bottom-left corner
                    newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
                    newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
                    newLeft = startX + deltaX;
                    break;
            }

            // Apply new dimensions
            chatbotModal.style.width = newWidth + 'px';
            chatbotModal.style.height = newHeight + 'px';

            // Apply new position if changed
            if (newLeft !== (parseInt(getComputedStyle(chatbotModal).left) || 0)) {
                chatbotModal.style.left = newLeft + 'px';
            }
            if (newTop !== (parseInt(getComputedStyle(chatbotModal).top) || 0)) {
                chatbotModal.style.top = newTop + 'px';
            }

            // Ensure chatbot doesn't go off-screen
            const modalRect = chatbotModal.getBoundingClientRect();
            const maxX = window.innerWidth - 20;
            const maxY = window.innerHeight - 90;

            // Adjust position if going off-screen
            if (modalRect.right > maxX) {
                const adjustX = modalRect.right - maxX;
                chatbotModal.style.left = (newLeft - adjustX) + 'px';
            }
            if (modalRect.left < 20) {
                chatbotModal.style.left = '20px';
            }
            if (modalRect.bottom > maxY) {
                const adjustY = modalRect.bottom - maxY;
                chatbotModal.style.top = (newTop - adjustY) + 'px';
            }
            if (modalRect.top < 20) {
                chatbotModal.style.top = '20px';
            }

            // Save size to localStorage
            localStorage.setItem('chatbotWidth', newWidth + 'px');
            localStorage.setItem('chatbotHeight', newHeight + 'px');

            e.preventDefault();
        };

        const stopResize = () => {
            if (!isResizing) return;

            isResizing = false;
            chatbotModal.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizeDirection = null;
        };

        // Add resize event listeners for all handles
        const resizeHandles = [
            { selector: '.top-resize', direction: 'n' },
            { selector: '.bottom-resize', direction: 's' },
            { selector: '.left-resize', direction: 'w' },
            { selector: '.right-resize', direction: 'e' },
            { selector: '.top-left-resize', direction: 'nw' },
            { selector: '.top-right-resize', direction: 'ne' },
            { selector: '.bottom-left-resize', direction: 'sw' },
            { selector: '.bottom-right-resize', direction: 'se' }
        ];

        resizeHandles.forEach(handle => {
            const elements = chatbotModal.querySelectorAll(handle.selector);
            elements.forEach(element => {
                element.addEventListener('mousedown', (e) => {
                    startResize(e, handle.direction);
                });
            });
        });

        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);

        // Handle touch events for mobile
        resizeHandles.forEach(handle => {
            const elements = chatbotModal.querySelectorAll(handle.selector);
            elements.forEach(element => {
                element.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    startResize(touch, handle.direction);
                });
            });
        });

        document.addEventListener('touchmove', (e) => {
            if (isResizing) {
                e.preventDefault();
                resize(e.touches[0]);
            }
        });

        document.addEventListener('touchend', stopResize);

        // Send message handler
        const sendMessage = async () => {
            const message = chatbotInput.value.trim();
            if (message === '') return;

            // Add user message
            const userMessage = document.createElement('div');
            userMessage.classList.add('message', 'user-message');
            userMessage.innerHTML = `
                <div class="message-avatar"><i class="fas fa-user"></i></div>
                <div class="message-content"><p>${message}</p></div>
            `;
            chatbotMessages.appendChild(userMessage);

            // Clear input
            chatbotInput.value = '';

            // Scroll to bottom
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

        // Send to backend
        try {
            // Show loading animation
            const loadingMessage = document.createElement('div');
            loadingMessage.classList.add('message', 'bot-message', 'loading');
            loadingMessage.innerHTML = `
                <div class="message-avatar"><i class="fas fa-robot"></i></div>
                <div class="message-content">
                    <div class="loading-dots">
                        <span class="dot">.</span>
                        <span class="dot">.</span>
                        <span class="dot">.</span>
                    </div>
                </div>
            `;
            chatbotMessages.appendChild(loadingMessage);
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();

            // Remove loading animation
            loadingMessage.remove();

            if (response.ok) {
                const botMessage = document.createElement('div');
                botMessage.classList.add('message', 'bot-message');
                botMessage.innerHTML = `
                    <div class="message-avatar"><i class="fas fa-robot"></i></div>
                    <div class="message-content"><p>${data.reply}</p></div>
                `;
                chatbotMessages.appendChild(botMessage);
            } else {
                const errorMessage = document.createElement('div');
                errorMessage.classList.add('message', 'bot-message');
                errorMessage.innerHTML = `
                    <div class="message-avatar"><i class="fas fa-robot"></i></div>
                    <div class="message-content"><p>Sorry, I couldn't process your message. ${data.error || 'Please try again.'}</p></div>
                `;
                chatbotMessages.appendChild(errorMessage);
            }
        } catch (error) {
            console.error('Error:', error);
            // Remove loading animation if present
            const loading = chatbotMessages.querySelector('.loading');
            if (loading) loading.remove();

            const errorMessage = document.createElement('div');
            errorMessage.classList.add('message', 'bot-message');
            errorMessage.innerHTML = `
                <div class="message-avatar"><i class="fas fa-robot"></i></div>
                <div class="message-content"><p>Sorry, there was an error connecting to the server. Please try again later.</p></div>
            `;
            chatbotMessages.appendChild(errorMessage);
        }

        // Scroll to bottom
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    };

        chatbotSend.addEventListener('click', sendMessage);

        chatbotInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }
});

// Add some CSS for ripple effect and loading dots wave animation
const additionalStyles = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
    }

    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    .nav-link.active {
        color: #667eea;
        font-weight: 600;
    }

    .nav-link.active::after {
        width: 100%;
    }

    .loading-dots {
        display: inline-flex;
        align-items: center;
        gap: 2px;
    }

    .loading-dots .dot {
        display: inline-block;
        font-size: 1.2em;
        animation: wave 1.4s ease-in-out infinite;
    }

    .loading-dots .dot:nth-child(1) {
        animation-delay: 0s;
    }

    .loading-dots .dot:nth-child(2) {
        animation-delay: 0.2s;
    }

    .loading-dots .dot:nth-child(3) {
        animation-delay: 0.4s;
    }

    @keyframes wave {
        0%, 60%, 100% {
            transform: translateY(0);
        }
        30% {
            transform: translateY(-8px);
        }
    }

    .custom-popup {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        opacity: 0;
        transform: translateY(-20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        min-width: 300px;
        max-width: 500px;
    }

    .custom-popup.show {
        opacity: 1;
        transform: translateY(0);
    }

    .custom-popup.success .popup-content {
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
    }

    .custom-popup.error .popup-content {
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
    }

    .custom-popup.info .popup-content {
        background-color: #d1ecf1;
        border: 1px solid #bee5eb;
        color: #0c5460;
    }

    .popup-content {
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: 'Arial', sans-serif;
        font-size: 14px;
    }

    .popup-message {
        flex: 1;
    }

    .popup-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: inherit;
        margin-left: 10px;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .popup-close:hover {
        opacity: 0.7;
    }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);