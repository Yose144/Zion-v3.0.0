const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const contentFile = path.join(dataDir, 'content.json');
const uploadDir = path.join(rootDir, 'src', 'uploads');
const port = Number(process.env.PORT || 3000);
const adminPassword = process.env.ADMIN_PASSWORD || 'intuitive-space-admin';
const sessionSecret = process.env.SESSION_SECRET || 'intuitive-space-session-secret';

const defaultContent = {
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
    return JSON.parse(JSON.stringify(defaultContent));
}

async function ensureStorage() {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(uploadDir, { recursive: true });

    try {
        await fs.access(contentFile);
    } catch {
        await fs.writeFile(contentFile, JSON.stringify(defaultContent, null, 2));
    }
}

async function readContent() {
    try {
        const raw = await fs.readFile(contentFile, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            news: Array.isArray(parsed.news) ? parsed.news : cloneDefaultContent().news,
            gallery: Array.isArray(parsed.gallery) ? parsed.gallery : cloneDefaultContent().gallery
        };
    } catch {
        const fallback = cloneDefaultContent();
        await writeContent(fallback);
        return fallback;
    }
}

async function writeContent(content) {
    await fs.writeFile(contentFile, JSON.stringify(content, null, 2));
}

function normalizeNewsItem(payload) {
    const item = {
        id: payload.id || `news-${Date.now()}`,
        date: String(payload.date || '').trim(),
        title: {
            cs: String(payload.title?.cs || '').trim(),
            en: String(payload.title?.en || '').trim()
        },
        text: {
            cs: String(payload.text?.cs || '').trim(),
            en: String(payload.text?.en || '').trim()
        }
    };

    if (!item.date || !item.title.cs || !item.title.en || !item.text.cs || !item.text.en) {
        return null;
    }

    return item;
}

function normalizeGalleryItem(payload) {
    const item = {
        id: payload.id || `gallery-${Date.now()}`,
        image: String(payload.image || '').trim(),
        alt: {
            cs: String(payload.alt?.cs || '').trim(),
            en: String(payload.alt?.en || '').trim()
        },
        caption: {
            cs: String(payload.caption?.cs || '').trim(),
            en: String(payload.caption?.en || '').trim()
        }
    };

    if (!item.image || !item.alt.cs || !item.alt.en) {
        return null;
    }

    return item;
}

function requireAuth(req, res, next) {
    if (req.session?.isAuthenticated) {
        next();
        return;
    }

    res.status(401).json({ error: 'Unauthorized' });
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, callback) => {
            callback(null, uploadDir);
        },
        filename: (_req, file, callback) => {
            const safeName = file.originalname
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]+/g, '-')
                .toLowerCase();
            callback(null, `${Date.now()}-${safeName}`);
        }
    }),
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (_req, file, callback) => {
        if (file.mimetype.startsWith('image/')) {
            callback(null, true);
            return;
        }

        callback(new Error('Only image uploads are allowed.'));
    }
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8
    }
}));

app.get('/api/content', async (_req, res) => {
    res.json(await readContent());
});

app.get('/api/admin/session', (req, res) => {
    res.json({ authenticated: Boolean(req.session?.isAuthenticated) });
});

app.post('/api/login', (req, res) => {
    const password = String(req.body.password || '');
    if (password !== adminPassword) {
        res.status(401).json({ error: 'Invalid password.' });
        return;
    }

    req.session.isAuthenticated = true;
    res.json({ authenticated: true });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ authenticated: false });
    });
});

app.post('/api/admin/upload', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded.' });
        return;
    }

    res.json({
        path: `src/uploads/${req.file.filename}`,
        filename: req.file.filename
    });
});

app.post('/api/admin/news', requireAuth, async (req, res) => {
    const item = normalizeNewsItem(req.body);
    if (!item) {
        res.status(400).json({ error: 'Invalid news item payload.' });
        return;
    }

    const content = await readContent();
    content.news.unshift(item);
    await writeContent(content);
    res.json(content);
});

app.delete('/api/admin/news/:id', requireAuth, async (req, res) => {
    const content = await readContent();
    content.news = content.news.filter((item) => item.id !== req.params.id);
    await writeContent(content);
    res.json(content);
});

app.post('/api/admin/gallery', requireAuth, async (req, res) => {
    const item = normalizeGalleryItem(req.body);
    if (!item) {
        res.status(400).json({ error: 'Invalid gallery item payload.' });
        return;
    }

    const content = await readContent();
    content.gallery.unshift(item);
    await writeContent(content);
    res.json(content);
});

app.delete('/api/admin/gallery/:id', requireAuth, async (req, res) => {
    const content = await readContent();
    content.gallery = content.gallery.filter((item) => item.id !== req.params.id);
    await writeContent(content);
    res.json(content);
});

app.post('/api/admin/reset', requireAuth, async (_req, res) => {
    const content = cloneDefaultContent();
    await writeContent(content);
    res.json(content);
});

app.use(express.static(rootDir));

app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message || 'Internal server error.' });
});

ensureStorage()
    .then(() => {
        app.listen(port, () => {
            console.log(`Intuitive Space server running on http://localhost:${port}`);
        });
    })
    .catch((error) => {
        console.error('Failed to initialize storage.', error);
        process.exit(1);
    });