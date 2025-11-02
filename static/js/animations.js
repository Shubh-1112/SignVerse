// Scroll animations for about us page
document.addEventListener('DOMContentLoaded', () => {
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
});
