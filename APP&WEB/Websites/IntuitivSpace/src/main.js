/* =============================================
   INTUITIVE SPACE v0.1 — JavaScript
   Hero slider, scroll effects, CZ/EN, nav
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_CONTENT = {
        news: [
            {
                id: 'news-1',
                date: '2026-05-07',
                title: {
                    cs: 'Otevírá se první čtvrteční kruh',
                    en: 'The first Thursday circle is opening'
                },
                text: {
                    cs: 'První komorní online setkání pro tvůrce, podnikatele a citlivé srdcaře startuje v květnu. Kapacita zůstává malá, aby byl prostor pro skutečné sdílení.',
                    en: 'The first intimate online gathering for creators, entrepreneurs and sensitive hearts starts in May. Capacity stays intentionally small to keep space for real sharing.'
                }
            },
            {
                id: 'news-2',
                date: '2026-05-14',
                title: {
                    cs: 'Vzniká večerní skupina',
                    en: 'An evening group is taking shape'
                },
                text: {
                    cs: 'Pokud se potvrdí zájem, otevře se i středeční večerní varianta pro ty, kdo chtějí být součástí prostoru, ale nevyhovuje jim dopolední čas.',
                    en: 'If interest is confirmed, a Wednesday evening format will open as well for those who want to join the space but cannot attend in the morning.'
                }
            },
            {
                id: 'news-3',
                date: '2026-05-21',
                title: {
                    cs: 'Intuitive Space roste i offline',
                    en: 'Intuitive Space is growing offline too'
                },
                text: {
                    cs: 'Součástí měsíčního rytmu budou i živá setkání, kde se může přirozeně propojit byznys, umění, vědomí i obyčejná lidská blízkost.',
                    en: 'The monthly rhythm will also include in-person gatherings where business, art, awareness and simple human closeness can meet naturally.'
                }
            }
        ],
        gallery: [
            {
                id: 'gallery-1',
                image: 'src/foto/WhatsApp Image 2026-04-16 at 20.34.16.jpeg',
                alt: { cs: 'Pobřeží a otevřený horizont', en: 'Coastline and open horizon' },
                caption: { cs: 'Prostor pro nový dech', en: 'Space for a new breath' }
            },
            {
                id: 'gallery-2',
                image: 'src/foto/WhatsApp Image 2026-04-16 at 20.35.44.jpeg',
                alt: { cs: 'Cesta podél oceánu', en: 'Walk by the ocean' },
                caption: { cs: 'Lehkost a směr', en: 'Lightness and direction' }
            },
            {
                id: 'gallery-3',
                image: 'src/foto/WhatsApp Image 2026-04-16 at 20.38.25 (1).jpeg',
                alt: { cs: 'Portrét v jemném světle', en: 'Portrait in soft light' },
                caption: { cs: 'Klid v přítomnosti', en: 'Calm in presence' }
            },
            {
                id: 'gallery-4',
                image: 'src/foto/WhatsApp Image 2026-04-16 at 20.40.27.jpeg',
                alt: { cs: 'Volnost a pohyb', en: 'Freedom and movement' },
                caption: { cs: 'Dovolit si rozlet', en: 'Allowing expansion' }
            },
            {
                id: 'gallery-5',
                image: 'src/foto/WhatsApp Image 2026-04-16 at 20.38.25 (2).jpeg',
                alt: { cs: 'Přírodní detail', en: 'Nature detail' },
                caption: { cs: 'Cit pro detail', en: 'A sense for detail' }
            },
            {
                id: 'gallery-6',
                image: 'src/foto/WhatsApp Image 2026-04-16 at 20.38.02.jpeg',
                alt: { cs: 'Západ slunce a něha', en: 'Sunset and tenderness' },
                caption: { cs: 'Měkkost večera', en: 'Softness of evening' }
            }
        ]
    };

    function cloneDefaultContent() {
        return JSON.parse(JSON.stringify(DEFAULT_CONTENT));
    }

    async function loadContent() {
        const fallback = cloneDefaultContent();
        try {
            const response = await fetch('/api/content', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('Unable to fetch content.');
            }

            const parsed = await response.json();
            return {
                news: Array.isArray(parsed.news) ? parsed.news : fallback.news,
                gallery: Array.isArray(parsed.gallery) ? parsed.gallery : fallback.gallery
            };
        } catch (error) {
            console.warn('Unable to load API content, using fallback defaults.', error);
            return fallback;
        }
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(dateValue, lang) {
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) {
            return escapeHtml(dateValue);
        }

        return new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);
    }

    const newsGrid = document.getElementById('newsGrid');
    const galleryGrid = document.getElementById('galleryGrid');
    let currentLang = document.documentElement.getAttribute('data-lang') || 'cs';
    let contentState = cloneDefaultContent();

    function renderNews() {
        if (!newsGrid) {
            return;
        }

        if (!contentState.news.length) {
            newsGrid.innerHTML = `<div class="news-empty reveal">${currentLang === 'cs' ? 'Zatím tu nejsou žádné novinky.' : 'No news items yet.'}</div>`;
            return;
        }

        newsGrid.innerHTML = contentState.news
            .slice()
            .sort((left, right) => right.date.localeCompare(left.date))
            .map((item) => `
                <article class="news-card reveal">
                    <div class="news-card-date">${formatDate(item.date, currentLang)}</div>
                    <h3>${escapeHtml(item.title[currentLang])}</h3>
                    <p>${escapeHtml(item.text[currentLang])}</p>
                </article>
            `)
            .join('');
    }

    function renderGallery() {
        if (!galleryGrid) {
            return;
        }

        if (!contentState.gallery.length) {
            galleryGrid.innerHTML = `<div class="news-empty reveal">${currentLang === 'cs' ? 'Galerie je momentálně prázdná.' : 'The gallery is currently empty.'}</div>`;
            return;
        }

        galleryGrid.innerHTML = contentState.gallery
            .map((item) => `
                <figure class="gallery-item reveal">
                    <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt[currentLang])}" loading="lazy">
                    ${item.caption[currentLang] ? `<figcaption>${escapeHtml(item.caption[currentLang])}</figcaption>` : ''}
                </figure>
            `)
            .join('');
    }

    function renderDynamicContent() {
        renderNews();
        renderGallery();
        observeReveals();
    }

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

    function observeReveals() {
        document.querySelectorAll('.reveal:not([data-reveal-observed])').forEach((element) => {
            element.dataset.revealObserved = 'true';
            revealObserver.observe(element);
        });
    }

    loadContent().then((content) => {
        contentState = content;
        renderDynamicContent();
    });

    observeReveals();

    // --- CZ / EN Language Toggle ---
    const langToggle = document.getElementById('langToggle');
    const langCs = langToggle.querySelector('.lang-cs');
    const langEn = langToggle.querySelector('.lang-en');

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
        renderDynamicContent();
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
