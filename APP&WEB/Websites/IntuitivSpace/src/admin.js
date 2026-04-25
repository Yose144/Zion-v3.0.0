document.addEventListener('DOMContentLoaded', () => {
    const loginCard = document.getElementById('loginCard');
    const adminDashboard = document.getElementById('adminDashboard');
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');
    const newsForm = document.getElementById('newsForm');
    const galleryForm = document.getElementById('galleryForm');
    const newsList = document.getElementById('newsList');
    const galleryList = document.getElementById('galleryList');
    const resetContentBtn = document.getElementById('resetContentBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const uploadStatus = document.getElementById('uploadStatus');
    const galleryImageInput = document.getElementById('galleryImageInput');
    const langToggle = document.getElementById('langToggle');
    const langCs = langToggle.querySelector('.lang-cs');
    const langEn = langToggle.querySelector('.lang-en');

    let currentLang = document.documentElement.getAttribute('data-lang') || 'cs';
    let contentState = { news: [], gallery: [] };

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(dateValue) {
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) {
            return escapeHtml(dateValue);
        }

        return new Intl.DateTimeFormat(currentLang === 'cs' ? 'cs-CZ' : 'en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);
    }

    async function request(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'same-origin',
            ...options
        });

        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json') ? await response.json() : null;

        if (!response.ok) {
            throw new Error(payload?.error || 'Request failed.');
        }

        return payload;
    }

    function setMessage(message, type = '') {
        loginMessage.textContent = message;
        loginMessage.className = `admin-message${type ? ` ${type}` : ''}`;
    }

    function updateLanguageUI() {
        langCs.classList.toggle('active', currentLang === 'cs');
        langEn.classList.toggle('active', currentLang === 'en');
        document.documentElement.lang = currentLang;
        document.documentElement.setAttribute('data-lang', currentLang);

        document.querySelectorAll('[data-cs][data-en]').forEach((element) => {
            const text = element.getAttribute(`data-${currentLang}`);
            if (!text) {
                return;
            }

            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = text;
            } else {
                element.textContent = text;
            }
        });
    }

    function renderLists() {
        newsList.innerHTML = contentState.news.length
            ? contentState.news
                .slice()
                .sort((left, right) => right.date.localeCompare(left.date))
                .map((item) => `
                    <div class="admin-item">
                        <div>
                            <strong>${escapeHtml(item.title[currentLang])}</strong>
                            <div class="admin-item-meta">${formatDate(item.date)}</div>
                        </div>
                        <button class="admin-remove" type="button" data-remove-news="${escapeHtml(item.id)}">${currentLang === 'cs' ? 'Smazat' : 'Delete'}</button>
                    </div>
                `)
                .join('')
            : `<div class="admin-empty">${currentLang === 'cs' ? 'Žádné novinky.' : 'No news items.'}</div>`;

        galleryList.innerHTML = contentState.gallery.length
            ? contentState.gallery
                .map((item) => `
                    <div class="admin-item">
                        <div class="admin-item-preview">
                            <img src="/${escapeHtml(item.image)}" alt="${escapeHtml(item.alt[currentLang])}">
                            <div>
                                <strong>${escapeHtml(item.caption[currentLang] || item.alt[currentLang])}</strong>
                                <div class="admin-item-meta">${escapeHtml(item.image)}</div>
                            </div>
                        </div>
                        <button class="admin-remove" type="button" data-remove-gallery="${escapeHtml(item.id)}">${currentLang === 'cs' ? 'Smazat' : 'Delete'}</button>
                    </div>
                `)
                .join('')
            : `<div class="admin-empty">${currentLang === 'cs' ? 'Galerie je prázdná.' : 'Gallery is empty.'}</div>`;
    }

    async function refreshContent() {
        contentState = await request('/api/content');
        renderLists();
    }

    async function setAuthenticated(isAuthenticated) {
        loginCard.hidden = isAuthenticated;
        adminDashboard.hidden = !isAuthenticated;
        if (isAuthenticated) {
            await refreshContent();
        }
    }

    langToggle.addEventListener('click', () => {
        currentLang = currentLang === 'cs' ? 'en' : 'cs';
        updateLanguageUI();
        renderLists();
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage('');
        const formData = new FormData(loginForm);

        try {
            await request('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: String(formData.get('password') || '') })
            });
            loginForm.reset();
            setMessage(currentLang === 'cs' ? 'Přihlášení proběhlo úspěšně.' : 'Login successful.', 'success');
            await setAuthenticated(true);
        } catch (error) {
            setMessage(error.message, 'error');
        }
    });

    newsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(newsForm);
        await request('/api/admin/news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: String(formData.get('date') || '').trim(),
                title: {
                    cs: String(formData.get('titleCs') || '').trim(),
                    en: String(formData.get('titleEn') || '').trim()
                },
                text: {
                    cs: String(formData.get('textCs') || '').trim(),
                    en: String(formData.get('textEn') || '').trim()
                }
            })
        });
        newsForm.reset();
        await refreshContent();
    });

    galleryForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(galleryForm);
        await request('/api/admin/gallery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: String(formData.get('image') || '').trim(),
                alt: {
                    cs: String(formData.get('altCs') || '').trim(),
                    en: String(formData.get('altEn') || '').trim()
                },
                caption: {
                    cs: String(formData.get('captionCs') || '').trim(),
                    en: String(formData.get('captionEn') || '').trim()
                }
            })
        });
        galleryForm.reset();
        uploadStatus.textContent = '';
        await refreshContent();
    });

    uploadImageBtn.addEventListener('click', async () => {
        const fileInput = galleryForm.elements.imageFile;
        if (!fileInput.files.length) {
            uploadStatus.textContent = currentLang === 'cs' ? 'Nejprve vyber obrázek.' : 'Choose an image first.';
            return;
        }

        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        uploadStatus.textContent = currentLang === 'cs' ? 'Nahrávám obrázek...' : 'Uploading image...';

        try {
            const payload = await request('/api/admin/upload', {
                method: 'POST',
                body: formData
            });
            galleryImageInput.value = payload.path;
            uploadStatus.textContent = currentLang === 'cs' ? 'Obrázek nahrán a vložen do URL pole.' : 'Image uploaded and inserted into the URL field.';
        } catch (error) {
            uploadStatus.textContent = error.message;
        }
    });

    newsList.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-remove-news]');
        if (!target) {
            return;
        }

        await request(`/api/admin/news/${encodeURIComponent(target.dataset.removeNews)}`, {
            method: 'DELETE'
        });
        await refreshContent();
    });

    galleryList.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-remove-gallery]');
        if (!target) {
            return;
        }

        await request(`/api/admin/gallery/${encodeURIComponent(target.dataset.removeGallery)}`, {
            method: 'DELETE'
        });
        await refreshContent();
    });

    resetContentBtn.addEventListener('click', async () => {
        await request('/api/admin/reset', { method: 'POST' });
        await refreshContent();
    });

    logoutBtn.addEventListener('click', async () => {
        await request('/api/logout', { method: 'POST' });
        await setAuthenticated(false);
    });

    updateLanguageUI();

    request('/api/admin/session')
        .then((payload) => setAuthenticated(Boolean(payload.authenticated)))
        .catch(() => setAuthenticated(false));
});