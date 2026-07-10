// ─────────────────────────────────────────────────────────────────────────────
// ZION Update Server — SQLite Database layer
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3';
import crypto from 'crypto';
import { mkdirSync, dirname } from 'path';
import { existsSync } from 'fs';

let db = null;

// ── Initialize database ───────────────────────────────────────────────────────
export function initDb(dbPath) {
  if (db) return db;

  // Ensure parent dir exists
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── Licenses table ──────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS licenses (
      key           TEXT PRIMARY KEY,
      email         TEXT NOT NULL,
      customer_name TEXT,
      max_activations INTEGER DEFAULT 1,
      activation_count INTEGER DEFAULT 0,
      status        TEXT DEFAULT 'active',  -- active | revoked | expired
      notes         TEXT DEFAULT '',
      created_at    TEXT DEFAULT (datetime('now')),
      revoked_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS activations (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key   TEXT NOT NULL,
      platform      TEXT,
      arch          TEXT,
      version       TEXT,
      device_hash   TEXT,
      first_seen    TEXT DEFAULT (datetime('now')),
      last_seen     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (license_key) REFERENCES licenses(key) ON DELETE CASCADE,
      UNIQUE(license_key, device_hash)
    );

    CREATE TABLE IF NOT EXISTS releases (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      version       TEXT NOT NULL,
      platform      TEXT NOT NULL,
      arch          TEXT NOT NULL,
      file_name     TEXT NOT NULL,
      sha512        TEXT,
      release_date  TEXT,
      release_notes TEXT DEFAULT '',
      created_at    TEXT DEFAULT (datetime('now')),
      UNIQUE(version, platform, arch)
    );
  `);

  return db;
}

// ── License operations ────────────────────────────────────────────────────────

export function createLicense({ email, customerName, maxActivations = 1, notes = '' }) {
  // Generate license key: ZION-XXXX-XXXX-XXXX-XXXX
  const bytes = crypto.randomBytes(8);
  const hex = bytes.toString('hex').toUpperCase();
  const key = `ZION-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;

  db.prepare(`
    INSERT INTO licenses (key, email, customer_name, max_activations, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(key, email, customerName || null, maxActivations, notes);

  return getLicense(key);
}

export function getLicense(key) {
  return db.prepare('SELECT * FROM licenses WHERE key = ?').get(key);
}

export function validateLicense(key) {
  const license = db.prepare('SELECT * FROM licenses WHERE key = ? AND status = ?').get(key, 'active');
  if (!license) return null;
  if (license.activation_count > license.max_activations) return null;
  return license;
}

export function listLicenses() {
  return db.prepare(`
    SELECT l.*, COUNT(a.id) as device_count
    FROM licenses l
    LEFT JOIN activations a ON l.key = a.license_key
    GROUP BY l.key
    ORDER BY l.created_at DESC
  `).all();
}

export function revokeLicense(key) {
  db.prepare(`
    UPDATE licenses SET status = 'revoked', revoked_at = datetime('now')
    WHERE key = ?
  `).run(key);
}

// ── Activation tracking ───────────────────────────────────────────────────────

export function recordActivation(key, { platform, arch, currentVersion }) {
  // Device hash: platform + arch (no hardware fingerprinting for privacy)
  const deviceHash = crypto.createHash('sha256').update(`${platform}:${arch}`).digest('hex').slice(0, 16);

  // Upsert activation
  const existing = db.prepare('SELECT * FROM activations WHERE license_key = ? AND device_hash = ?').get(key, deviceHash);
  if (existing) {
    db.prepare(`
      UPDATE activations SET last_seen = datetime('now'), version = ?
      WHERE license_key = ? AND device_hash = ?
    `).run(currentVersion, key, deviceHash);
  } else {
    const license = getLicense(key);
    if (license && license.activation_count < license.max_activations) {
      db.prepare(`
        INSERT INTO activations (license_key, platform, arch, version, device_hash)
        VALUES (?, ?, ?, ?, ?)
      `).run(key, platform, arch, currentVersion, deviceHash);

      // Increment activation count
      db.prepare('UPDATE licenses SET activation_count = activation_count + 1 WHERE key = ?').run(key);
    }
  }
}

// ── Release operations ────────────────────────────────────────────────────────

export function saveReleaseInfo({ version, platform, arch, fileName, sha512, releaseDate, releaseNotes }) {
  db.prepare(`
    INSERT INTO releases (version, platform, arch, file_name, sha512, release_date, release_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(version, platform, arch) DO UPDATE SET
      file_name = excluded.file_name,
      sha512 = excluded.sha512,
      release_date = excluded.release_date,
      release_notes = excluded.release_notes
  `).run(version, platform, arch, fileName, sha512 || null, releaseDate || null, releaseNotes || '');

  // Update latest.yml files
  updateLatestYml(platform);
}

export function getLatestRelease(platform, arch) {
  const releases = db.prepare(`
    SELECT * FROM releases
    WHERE platform = ? AND arch = ?
    ORDER BY version DESC
    LIMIT 1
  `).all(platform, arch);

  if (releases.length === 0) {
    // Try without arch filter (some platforms have single arch)
    const fallback = db.prepare(`
      SELECT * FROM releases WHERE platform = ?
      ORDER BY version DESC LIMIT 1
    `).get(platform);
    return fallback || null;
  }

  return releases[0];
}

export function getAllReleases() {
  return db.prepare('SELECT * FROM releases ORDER BY version DESC, platform').all();
}

// ── latest.yml generation ─────────────────────────────────────────────────────

function updateLatestYml(platform) {
  // This is called after saveReleaseInfo — the yml files are generated
  // by electron-builder during build and uploaded separately.
  // This function is a no-op placeholder — yml files are uploaded as-is.
  // The DB just tracks metadata for the check-update API.
}
