export const SITE_VERSION = 'v3.0.4';
export const SITE_RELEASE_NAME = 'from genesis to the star';
export const SITE_RELEASE_LABEL = `${SITE_VERSION} "${SITE_RELEASE_NAME}"`;
export const SITE_RUNTIME_VERSION = 'v3.0.4';
export const SITE_RUNTIME_NAME = 'Deeksha/Ekam canonical · 6-decimal flowers';
export const SITE_RUNTIME_LABEL = `${SITE_RUNTIME_VERSION} ${SITE_RUNTIME_NAME}`;
export const SITE_ENVIRONMENT_LABEL = 'V3 Mainnet';
export const SITE_PUBLIC_LAUNCH_STATUS = 'from genesis to the star';
export const SITE_LAUNCH_DATE = '2026-12-31T00:00:00Z';
export const SITE_LAUNCH_DATE_DISPLAY = '31 December 2026 (New Year\'s Eve)';
export const SITE_NETWORK_LABEL = `${SITE_ENVIRONMENT_LABEL} · ${SITE_RELEASE_LABEL}`;

// ── Infrastructure (Edge server topology, 2026-07-09) ──────────────────────
// Edge server — cloud VPS, public-facing node + pool stratum
export const SITE_PRIMARY_HOST = process.env.NEXT_PUBLIC_ZION_RPC_HOST || 'rpc.zionterranova.com';
export const SITE_PRIMARY_RPC_PORT = 8443;
export const SITE_PRIMARY_RPC_URL = `${SITE_PRIMARY_HOST}:${SITE_PRIMARY_RPC_PORT}`;
// Pool metrics API — runs locally on Edge (port 8455).
export const SITE_PRIMARY_POOL_API_URL = process.env.ZION_POOL_API_URL || `http://127.0.0.1:8455`;
export const SITE_PRIMARY_DAO_API_URL = process.env.ZION_DAO_API_URL || `http://127.0.0.1:8450`;

// Edge pool stratum port is 8444 (ShareRelay architecture)
export const SITE_POOL_PRIMARY = `${SITE_PRIMARY_HOST}:8444`;

// Network topology descriptor (operational details are injected via environment variables only)
export const SITE_NETWORK_TOPOLOGY = 'Edge server (cloud VPS)';
export const EKAM_GOLDEN_EGG_IMAGE = 'https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/file-uploads/themes/2147915250/settings_images/8802b3-c826-05c7-bcd2-12b608d18d1_ABOUT-ONENESS.webp';
export const EKAM_BANNER_IMAGE = 'https://onenessoceania.org/wp-content/uploads/2024/04/Ekam-Banner.jpg';
export const EKAM_FOUNDERS_BANNER_IMAGE = 'https://onenessoceania.org/wp-content/uploads/2024/03/Sri-Amma-Bhagavan-1920x600-1.jpg';
export const EKAM_SOURCE_URL = 'https://www.theonenessmovement.org/about-oneness';

/* ── Ekam extended image gallery ── */
export const EKAM_PREETHAJI_KRISHNAJI_IMAGE = 'https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/file-uploads/themes/2147915250/settings_images/18b2aa8-d063-5aa1-0e7-145623a46531_a2012e18-e98c-4e65-8212-ff2823f727ae.png';
export const EKAM_NORDIC_IMAGE = 'https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/file-uploads/themes/2147915250/settings_images/831114-c24e-e4a-5a4a-d84434bb22c_ot.jpeg';
export const EKAM_TURIYA_IMAGE = 'https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/file-uploads/themes/2147915250/settings_images/0ea3f2-e65e-3cc-3cca-e6f67bd6e7cc_TheOnenessTuriya_Intorior-Page_V5_07.jpg';
export const EKAM_PREETHAJI_KRISHNAJI_URL = 'https://www.theonenessmovement.org/sri-preethaji-and-sri-krishnaji';
export const EKAM_YOUTUBE_CHANNEL = 'https://www.youtube.com/@theonenessmovement';
