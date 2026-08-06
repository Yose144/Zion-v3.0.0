// ─────────────────────────────────────────────────────────────────────────────
// ZION Update Server — License-gated auto-update server for Desktop Agent
// ─────────────────────────────────────────────────────────────────────────────
// Architecture:
//   POST /api/check-update     → license validation + version check
//   GET  /api/releases/:yml    → electron-updater manifest (license-gated)
//   GET  /api/releases/:v/:f   → binary download (license-gated, JWT)
//   POST /admin/generate       → create license key (admin token)
//   GET  /admin/licenses       → list licenses (admin token)
//   POST /admin/revoke         → revoke license (admin token)
//   POST /admin/upload         → upload release artifacts (admin token)
//   GET  /health               → health check
// ─────────────────────────────────────────────────────────────────────────────

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { initDb, validateLicense, createLicense, listLicenses, revokeLicense, recordActivation, saveReleaseInfo, getLatestRelease,
         saveIapReceipt, getEntitlements, upsertEntitlement, listIapReceipts, getAllEntitlements, revokeEntitlement, productToEntitlement, computeExpiry } from './db.js';
import { verifyReceipt } from './iap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ───────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.UPDATE_SERVER_PORT || '3001', 10);
const HOST = process.env.UPDATE_SERVER_HOST || '0.0.0.0';
const ADMIN_TOKEN = process.env.UPDATE_ADMIN_TOKEN || (() => {
  console.warn('[WARN] UPDATE_ADMIN_TOKEN not set — using random ephemeral token');
  const tok = crypto.randomBytes(32).toString('hex');
  console.log('[WARN] Ephemeral admin token:', tok);
  return tok;
})();
const DB_PATH = process.env.UPDATE_DB_PATH || join(__dirname, 'data', 'licenses.db');
const RELEASES_DIR = process.env.UPDATE_RELEASES_DIR || join(__dirname, 'data', 'releases');
const JWT_SECRET = process.env.UPDATE_JWT_SECRET || crypto.randomBytes(64).toString('hex');

// ── Ensure data dirs ──────────────────────────────────────────────────────────
mkdirSync(join(__dirname, 'data'), { recursive: true });
mkdirSync(RELEASES_DIR, { recursive: true });

// ── Init DB ───────────────────────────────────────────────────────────────────
initDb(DB_PATH);

// ── JWT helpers ───────────────────────────────────────────────────────────────
function signJwt(payload, ttlSeconds = 300) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── License key extraction ────────────────────────────────────────────────────
function extractLicenseKey(request) {
  // electron-updater sends requestHeaders — we look for X-License-Key
  return request.headers['x-license-key'] || request.headers['x-zion-license'] || null;
}

function extractBearerToken(request) {
  const auth = request.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// ── Admin auth middleware ─────────────────────────────────────────────────────
async function adminAuth(request, reply) {
  const token = extractBearerToken(request);
  if (token !== ADMIN_TOKEN) {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── Fastify server ────────────────────────────────────────────────────────────
const server = Fastify({ logger: true, bodyLimit: 500 * 1024 * 1024 }); // 500MB for uploads

await server.register(fastifyCors, {
  origin: false, // disable CORS — Electron doesn't need it
});

// Serve static release files from RELEASES_DIR (for direct download fallback)
await server.register(fastifyStatic, {
  root: RELEASES_DIR,
  prefix: '/static/',
  decorateReply: true,
});

// ── Health check ──────────────────────────────────────────────────────────────
server.get('/health', async () => {
  return { status: 'ok', service: 'zion-update-server', timestamp: new Date().toISOString() };
});

// ── POST /api/check-update ────────────────────────────────────────────────────
// Body: { licenseKey, platform, arch, currentVersion }
// Returns: { updateAvailable, latestVersion, releaseNotes, downloadUrl, jwt }
server.post('/api/check-update', async (request, reply) => {
  const { licenseKey, platform, arch, currentVersion } = request.body || {};

  if (!licenseKey) {
    return reply.code(400).send({ error: 'licenseKey required' });
  }

  const license = validateLicense(licenseKey);
  if (!license) {
    return reply.code(403).send({ error: 'Invalid or revoked license' });
  }

  // Record activation (device fingerprinting — platform + arch + version)
  recordActivation(licenseKey, { platform, arch, currentVersion });

  const latest = getLatestRelease(platform, arch);
  if (!latest) {
    return reply.code(404).send({ error: 'No releases available for this platform' });
  }

  const updateAvailable = isNewerVersion(latest.version, currentVersion);

  // Issue short-lived JWT for download auth
  const jwt = signJwt({ licenseKey, version: latest.version }, 600); // 10 min

  return {
    updateAvailable,
    currentVersion,
    latestVersion: latest.version,
    releaseDate: latest.releaseDate,
    releaseNotes: latest.releaseNotes,
    downloadUrl: `/api/releases/${latest.version}/${latest.fileName}?token=${jwt}`,
    jwt,
  };
});

// ── GET /api/releases/:ymlFile ────────────────────────────────────────────────
// electron-updater fetches latest.yml / latest-mac.yml / latest-linux.yml
// License key passed via X-License-Key header
server.get('/api/releases/:ymlFile', async (request, reply) => {
  const { ymlFile } = request.params;

  // Only allow yml files
  if (!ymlFile.match(/^latest(-mac|-linux)?\.yml$/)) {
    return reply.code(404).send({ error: 'Not found' });
  }

  // Validate license
  const licenseKey = extractLicenseKey(request);
  if (!licenseKey) {
    return reply.code(403).send({ error: 'License key required (X-License-Key header)' });
  }
  const license = validateLicense(licenseKey);
  if (!license) {
    return reply.code(403).send({ error: 'Invalid or revoked license' });
  }

  const ymlPath = join(RELEASES_DIR, ymlFile);
  if (!existsSync(ymlPath)) {
    return reply.code(404).send({ error: 'No releases published yet' });
  }

  const content = readFileSync(ymlPath, 'utf-8');
  reply.type('text/yaml').send(content);
});

// ── GET /api/releases/:version/:fileName ──────────────────────────────────────
// Binary download — requires JWT token (from check-update) or license header
server.get('/api/releases/:version/:fileName', async (request, reply) => {
  const { version, fileName } = request.params;

  // Auth: JWT via query param OR license key via header
  let authorized = false;
  const token = request.query.token;
  if (token) {
    const payload = verifyJwt(token);
    if (payload) authorized = true;
  }
  if (!authorized) {
    const licenseKey = extractLicenseKey(request);
    if (licenseKey) {
      const license = validateLicense(licenseKey);
      if (license) authorized = true;
    }
  }

  if (!authorized) {
    return reply.code(403).send({ error: 'Authentication required' });
  }

  const filePath = join(RELEASES_DIR, version, fileName);
  if (!existsSync(filePath)) {
    return reply.code(404).send({ error: 'File not found' });
  }

  return reply.sendFile(fileName, join(RELEASES_DIR, version));
});

// ── POST /admin/generate — Create license key ─────────────────────────────────
server.post('/admin/generate', async (request, reply) => {
  if (!(await adminAuth(request, reply))) return;

  const { email, customerName, maxActivations = 1, notes = '' } = request.body || {};
  if (!email) {
    return reply.code(400).send({ error: 'email required' });
  }

  const license = createLicense({ email, customerName, maxActivations, notes });
  return { success: true, licenseKey: license.key, ...license };
});

// ── GET /admin/licenses — List all licenses ───────────────────────────────────
server.get('/admin/licenses', async (request, reply) => {
  if (!(await adminAuth(request, reply))) return;
  return { licenses: listLicenses() };
});

// ── POST /admin/revoke — Revoke a license ─────────────────────────────────────
server.post('/admin/revoke', async (request, reply) => {
  if (!(await adminAuth(request, reply))) return;

  const { licenseKey } = request.body || {};
  if (!licenseKey) {
    return reply.code(400).send({ error: 'licenseKey required' });
  }

  revokeLicense(licenseKey);
  return { success: true, message: 'License revoked' };
});

// ── POST /admin/upload — Upload release artifacts ─────────────────────────────
// Multipart: files + metadata (version, platform, releaseNotes)
server.post('/admin/upload', async (request, reply) => {
  if (!(await adminAuth(request, reply))) return;

  const data = await request.file();
  if (!data) {
    return reply.code(400).send({ error: 'No file uploaded' });
  }

  // This is a simplified upload — in production use multipart properly
  return reply.code(501).send({ error: 'Use scripts/upload-release.js for file uploads' });
});

// ── POST /admin/publish-release — Register release metadata ───────────────────
server.post('/admin/publish-release', async (request, reply) => {
  if (!(await adminAuth(request, reply))) return;

  const { version, platform, arch, fileName, sha512, releaseDate, releaseNotes, ymlContent } = request.body || {};
  if (!version || !platform || !fileName) {
    return reply.code(400).send({ error: 'version, platform, fileName required' });
  }

  saveReleaseInfo({ version, platform, arch, fileName, sha512, releaseDate, releaseNotes });

  // If ymlContent provided, save it to RELEASES_DIR
  if (ymlContent) {
    const ymlPath = join(RELEASES_DIR, platform === 'win32' ? 'latest.yml' : platform === 'darwin' ? 'latest-mac.yml' : 'latest-linux.yml');
    const { writeFileSync } = await import('fs');
    writeFileSync(ymlPath, ymlContent, 'utf-8');
  }

  return { success: true, message: `Release ${version} for ${platform}-${arch} published` };
});

// ═══════════════════════════════════════════════════════════════════════════════
// IAP ROUTES — Mobile In-App Purchase validation + entitlements
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/iap/validate — Validate receipt and create entitlement ──────────
// Body: { platform, productId, receiptData, transactionId, purchaseToken, deviceId }
server.post('/api/iap/validate', async (request, reply) => {
  const { platform, productId, receiptData, transactionId, purchaseToken, deviceId } = request.body || {};

  if (!platform || !productId || !deviceId) {
    return reply.code(400).send({ error: 'platform, productId, deviceId required' });
  }
  if (!transactionId) {
    return reply.code(400).send({ error: 'transactionId required' });
  }

  // Map product ID to entitlement
  const productMap = productToEntitlement(productId);
  if (!productMap) {
    return reply.code(400).send({ error: `Unknown product ID: ${productId}` });
  }

  // Verify receipt with Apple/Google (or skip in dev mode)
  const verification = await verifyReceipt({ platform, productId, receiptData, purchaseToken, transactionId });
  if (!verification.valid) {
    return reply.code(403).send({ success: false, error: verification.error || 'Receipt verification failed' });
  }

  // Compute expiry
  const expiresAt = verification.expiresDate || computeExpiry(productMap.expiresAt) || null;
  const purchasedAt = verification.purchaseDate || new Date().toISOString();

  // Save receipt
  saveIapReceipt({
    platform,
    productId,
    receiptData,
    purchaseToken,
    transactionId: verification.transactionId || transactionId,
    entitlement: productMap.entitlement,
    deviceId,
    purchasedAt,
    expiresAt,
  });

  // Create/update entitlement
  const source = platform === 'ios' ? 'iap_apple' : 'iap_google';
  upsertEntitlement({
    deviceId,
    iapTransaction: verification.transactionId || transactionId,
    platform,
    entitlement: productMap.entitlement,
    source,
    purchasedAt,
    expiresAt,
  });

  return {
    success: true,
    entitlement: productMap.entitlement,
    expiresAt,
    productId,
    transactionId: verification.transactionId || transactionId,
  };
});

// ── GET /api/iap/entitlements — Get device's active entitlements ──────────────
// Query: ?deviceId=<device_id>
server.get('/api/iap/entitlements', async (request, reply) => {
  const { deviceId } = request.query || {};
  if (!deviceId) {
    return reply.code(400).send({ error: 'deviceId required' });
  }

  const entitlements = getEntitlements(deviceId);
  // Filter out expired
  const now = new Date();
  const active = entitlements.filter(e =>
    e.status === 'active' &&
    (!e.expires_at || new Date(e.expires_at) > now)
  );

  return {
    success: true,
    entitlements: active.map(e => ({
      entitlement: e.entitlement,
      status: e.status,
      source: e.source,
      expiresAt: e.expires_at,
      purchasedAt: e.purchased_at,
    })),
  };
});

// ── POST /api/iap/restore — Restore purchases ─────────────────────────────────
// Body: { deviceId, receipts: [{ platform, productId, receiptData, transactionId, purchaseToken }] }
server.post('/api/iap/restore', async (request, reply) => {
  const { deviceId, receipts } = request.body || {};
  if (!deviceId || !Array.isArray(receipts)) {
    return reply.code(400).send({ error: 'deviceId and receipts array required' });
  }

  const results = [];
  for (const r of receipts) {
    const productMap = productToEntitlement(r.productId);
    if (!productMap) continue;

    const verification = await verifyReceipt(r);
    if (!verification.valid) {
      results.push({ productId: r.productId, success: false, error: verification.error });
      continue;
    }

    const expiresAt = verification.expiresDate || computeExpiry(productMap.expiresAt) || null;
    const purchasedAt = verification.purchaseDate || new Date().toISOString();

    saveIapReceipt({
      platform: r.platform,
      productId: r.productId,
      receiptData: r.receiptData,
      purchaseToken: r.purchaseToken,
      transactionId: verification.transactionId || r.transactionId,
      entitlement: productMap.entitlement,
      deviceId,
      purchasedAt,
      expiresAt,
    });

    upsertEntitlement({
      deviceId,
      iapTransaction: verification.transactionId || r.transactionId,
      platform: r.platform,
      entitlement: productMap.entitlement,
      source: r.platform === 'ios' ? 'iap_apple' : 'iap_google',
      purchasedAt,
      expiresAt,
    });

    results.push({ productId: r.productId, success: true, entitlement: productMap.entitlement });
  }

  const entitlements = getEntitlements(deviceId);
  return { success: true, results, entitlements };
});

// ── Admin: GET /admin/iap/receipts — List all IAP receipts ────────────────────
server.get('/admin/iap/receipts', async (request, reply) => {
  if (!(await adminAuth(request, reply))) return;
  return { receipts: listIapReceipts() };
});

// ── Admin: GET /admin/entitlements — List all entitlements ────────────────────
server.get('/admin/entitlements', async (request, reply) => {
  if (!(await adminAuth(request, reply))) return;
  return { entitlements: getAllEntitlements() };
});

// ── Admin: POST /admin/entitlements/revoke — Revoke entitlement ───────────────
server.post('/admin/entitlements/revoke', async (request, reply) => {
  if (!(await adminAuth(request, reply))) return;
  const { deviceId, entitlement } = request.body || {};
  if (!deviceId || !entitlement) {
    return reply.code(400).send({ error: 'deviceId and entitlement required' });
  }
  revokeEntitlement(deviceId, entitlement);
  return { success: true, message: `Entitlement ${entitlement} revoked for device ${deviceId}` };
});

// ── Version comparison ────────────────────────────────────────────────────────
function isNewerVersion(latest, current) {
  if (!current) return true;
  const a = String(latest).split('.').map(Number);
  const b = String(current).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

// ── Start server ──────────────────────────────────────────────────────────────
server.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`ZION Update Server listening on ${address}`);
  console.log(`Releases dir: ${RELEASES_DIR}`);
  console.log(`DB: ${DB_PATH}`);
});
