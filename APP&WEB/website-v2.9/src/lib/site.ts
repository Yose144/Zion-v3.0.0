export const SITE_VERSION = 'v3.2.0';
export const SITE_RELEASE_NAME = 'One Love';
export const SITE_RELEASE_TAGLINE = 'Mainnet Alpha';
export const SITE_RELEASE_LABEL = `${SITE_VERSION} "${SITE_RELEASE_NAME}"`;
export const SITE_RUNTIME_VERSION = 'v3.2.0';
export const SITE_RUNTIME_NAME = 'One Love · 6-decimal flowers';
export const SITE_RUNTIME_LABEL = `${SITE_RUNTIME_VERSION} ${SITE_RUNTIME_NAME}`;
export const SITE_ENVIRONMENT_LABEL = 'One Love Mainnet Alpha';
export const SITE_PUBLIC_LAUNCH_STATUS = 'In Development · Launch Postponed';
export const SITE_LAUNCH_DATE = 'TBD';
export const SITE_LAUNCH_DATE_DISPLAY = 'Postponed (TBD)';
export const SITE_NETWORK_LABEL = `${SITE_ENVIRONMENT_LABEL} · ${SITE_RELEASE_LABEL}`;

// app.zionterranova.com is the actual Next.js web app (explorer, pool, defi,
// downloads, docs, etc). zionterranova.com is a separate static intro/hub
// page that only serves its own index.html for every path — it does NOT
// proxy to this app, so links must point at the app subdomain.
export const SITE_APP_URL = 'https://app.zionterranova.com';
export const SITE_INTRO_URL = 'https://zionterranova.com';

// ── Public endpoints (One Love Mainnet Stable, 2026-08-06) ─────────────────
export const SITE_PRIMARY_HOST = process.env.NEXT_PUBLIC_ZION_RPC_HOST || 'rpc.zionterranova.com';
export const SITE_PRIMARY_RPC_PORT = 9445;
export const SITE_PRIMARY_RPC_URL = `${SITE_PRIMARY_HOST}:${SITE_PRIMARY_RPC_PORT}`;
// Pool metrics API — localhost-only, not exposed publicly.
export const SITE_PRIMARY_POOL_API_URL = process.env.ZION_POOL_API_URL || `http://127.0.0.1:8080`;
export const SITE_PRIMARY_DAO_API_URL = process.env.ZION_DAO_API_URL || `http://127.0.0.1:8456`;

// Public pool stratum
export const SITE_POOL_PRIMARY = `${process.env.NEXT_PUBLIC_ZION_POOL_HOST || 'stratum.zionterranova.com'}:8444`;

// Network topology descriptor (operational details are injected via environment variables only)
export const SITE_NETWORK_TOPOLOGY = 'single-node Mainnet Alpha';
export const EKAM_GOLDEN_EGG_IMAGE = 'https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/file-uploads/themes/2147915250/settings_images/8802b3-c826-05c7-bcd2-12b608d18d1_ABOUT-ONENESS.webp';
export const EKAM_HERO_IMAGE = '/images/ekam/hero.webp';
export const EKAM_BANNER_IMAGE = '/images/ekam/temple.webp';
export const EKAM_FOUNDERS_BANNER_IMAGE = '/images/ekam/founders.webp';
export const EKAM_SOURCE_URL = 'https://www.theonenessmovement.org/about-oneness';

/* ── Ekam extended image gallery ── */
export const EKAM_PREETHAJI_KRISHNAJI_IMAGE = '/images/ekam/preethaji.webp';
export const EKAM_NORDIC_IMAGE = '/images/ekam/nordic.webp';
export const EKAM_TURIYA_IMAGE = '/images/ekam/turiya.webp';
export const EKAM_PREETHAJI_KRISHNAJI_URL = 'https://www.theonenessmovement.org/sri-preethaji-and-sri-krishnaji';
export const EKAM_YOUTUBE_CHANNEL = 'https://www.youtube.com/@theonenessmovement';
