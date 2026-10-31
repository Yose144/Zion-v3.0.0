/* =============================================
   INTUITIVE SPACE v0.1 — JavaScript
   Hero slider, scroll effects, CZ/EN, nav
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

    // --- Hero Slider ---
    const slides = document.querySelectorAll('.hero-slide');
    let currentSlide = 0;
    const slideInterval = 6000;

    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }

    if (slides.length > 1) {
        setInterval(nextSlide, slideInterval);
    }

    // --- Scroll: Nav style ---
    const nav = document.getElementById('nav');
    const navLogo = document.getElementById('navLogo');

    function handleNavScroll() {
        if (window.scrollY > 80) {
            nav.classList.add('scrolled');
            if (navLogo) navLogo.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
            if (navLogo) navLogo.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleNavScroll, { passive: true });
    handleNavScroll();

    // --- Mobile nav toggle ---
    const navToggle = document.getElementById('navToggle');
    const navLinksLeft = document.getElementById('navLinksLeft');
    const navLinksRight = document.getElementById('navLinksRight');

    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinksLeft.classList.toggle('open');
        navLinksRight.classList.toggle('open');
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navLinksLeft.classList.remove('open');
            navLinksRight.classList.remove('open');
        });
    });

    // --- Scroll Reveal ---
    const reveals = document.querySelectorAll('.reveal');

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 100);
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    });

    reveals.forEach(el => revealObserver.observe(el));

    // --- CZ / EN Language Toggle ---
    const langToggle = document.getElementById('langToggle');
    const langCs = langToggle.querySelector('.lang-cs');
    const langEn = langToggle.querySelector('.lang-en');
    let currentLang = 'cs';

    langToggle.addEventListener('click', () => {
        currentLang = currentLang === 'cs' ? 'en' : 'cs';
        document.documentElement.setAttribute('data-lang', currentLang);

        langCs.classList.toggle('active', currentLang === 'cs');
        langEn.classList.toggle('active', currentLang === 'en');

        document.querySelectorAll('[data-cs][data-en]').forEach(el => {
            const text = el.getAttribute(`data-${currentLang}`);
            if (text) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = text;
                } else {
                    el.textContent = text;
                }
            }
        });

        document.documentElement.lang = currentLang;
    });

    // --- Smooth scroll for anchor links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const offset = 80;
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

    // --- Parallax hint for space & quote bg ---
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const scrolled = window.scrollY;
                document.querySelectorAll('.space-bg, .quote-bg').forEach(bg => {
                    const rect = bg.parentElement.getBoundingClientRect();
                    if (rect.top < window.innerHeight && rect.bottom > 0) {
                        const speed = 0.3;
                        const yPos = -(rect.top * speed);
                        bg.style.transform = `translateY(${yPos}px)`;
                    }
                });
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

});
