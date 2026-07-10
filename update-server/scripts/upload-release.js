#!/usr/bin/env node
// Upload release artifacts to the update server
// Usage: node scripts/upload-release.js --version 3.0.5 --dir ./dist [--notes "..."]
//
// This script:
//   1. Reads latest.yml / latest-mac.yml / latest-linux.yml from dist/
//   2. Uploads all installer files + yml files to the server
//   3. Registers release metadata in the DB
//
// Env: UPDATE_ADMIN_TOKEN, UPDATE_SERVER_URL

import { parseArgs } from 'util';
import { readFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, statSync } from 'fs';
import { join, basename } from 'path';
import crypto from 'crypto';

const args = parseArgs({
  options: {
    version: { type: 'string' },
    dir: { type: 'string', default: './dist' },
    notes: { type: 'string', default: '' },
  },
  allowPositionals: false,
});

if (!args.values.version) {
  console.error('Usage: node scripts/upload-release.js --version <ver> --dir <dist-dir> [--notes "..."]');
  process.exit(1);
}

const SERVER_URL = process.env.UPDATE_SERVER_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.UPDATE_ADMIN_TOKEN;
const RELEASES_DIR = process.env.UPDATE_RELEASES_DIR; // if set, copy directly to server filesystem

if (!ADMIN_TOKEN && !RELEASES_DIR) {
  console.error('ERROR: UPDATE_ADMIN_TOKEN or UPDATE_RELEASES_DIR not set');
  process.exit(1);
}

const version = args.values.version;
const distDir = args.values.dir;
const notes = args.values.notes;

if (!existsSync(distDir)) {
  console.error(`ERROR: dist directory not found: ${distDir}`);
  process.exit(1);
}

// ── Find yml files and installer artifacts ────────────────────────────────────
const ymlFiles = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml'];
const installerExts = ['.exe', '.dmg', '.AppImage', '.deb', '.zip', '.snap', '.rpm', '.blockmap'];

const files = readdirSync(distDir).filter(f => {
  if (ymlFiles.includes(f)) return true;
  return installerExts.some(ext => f.endsWith(ext));
});

if (files.length === 0) {
  console.error(`ERROR: No installer files or yml files found in ${distDir}`);
  console.error('Run electron-builder first: npm run build:mac / build:win / build:linux');
  process.exit(1);
}

console.log(`Found ${files.length} files in ${distDir}:`);
files.forEach(f => console.log(`  ${f}`));

// ── Determine platform + arch from yml files ──────────────────────────────────
function parseYml(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  // Simple YAML parsing for electron-builder format
  const version = content.match(/^version:\s*(.+)$/m)?.[1]?.trim();
  const path = content.match(/^path:\s*(.+)$/m)?.[1]?.trim();
  const sha512 = content.match(/^sha512:\s*(.+)$/m)?.[1]?.trim();
  const releaseDate = content.match(/^releaseDate:\s*(.+)$/m)?.[1]?.trim();
  return { version, path, sha512, releaseDate, raw: content };
}

// ── Upload via direct filesystem copy (if server is local) ────────────────────
if (RELEASES_DIR) {
  const versionDir = join(RELEASES_DIR, version);
  mkdirSync(versionDir, { recursive: true });

  for (const file of files) {
    const src = join(distDir, file);
    const dst = join(versionDir, file);
    copyFileSync(src, dst);
    const size = statSync(dst).size;
    console.log(`  Copied: ${file} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  }

  // Copy yml files to releases root
  for (const yml of ymlFiles) {
    const ymlPath = join(distDir, yml);
    if (existsSync(ymlPath)) {
      copyFileSync(ymlPath, join(RELEASES_DIR, yml));
      console.log(`  Published: ${yml}`);
    }
  }

  console.log(`\nRelease ${version} uploaded to ${RELEASES_DIR}`);
  console.log('Now register metadata via /admin/publish-release API or it will be auto-detected from yml files.');
  process.exit(0);
}

// ── Upload via HTTP API (remote server) ───────────────────────────────────────
// For remote uploads, we'd need multipart support. This is a simplified version
// that registers metadata + assumes files are uploaded separately (e.g., via SCP/S3).

console.log('\nNote: HTTP file upload not yet implemented. Use UPDATE_RELEASES_DIR for local filesystem copy.');
console.log('For remote servers, SCP the dist/ files to the server releases directory, then run:');

for (const yml of ymlFiles) {
  const ymlPath = join(distDir, yml);
  if (!existsSync(ymlPath)) continue;

  const parsed = parseYml(ymlPath);
  if (!parsed.version) continue;

  const platform = yml === 'latest.yml' ? 'win32' : yml === 'latest-mac.yml' ? 'darwin' : 'linux';

  console.log(`\n  curl -X POST ${SERVER_URL}/admin/publish-release \\`);
  console.log(`    -H "Authorization: Bearer $UPDATE_ADMIN_TOKEN" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"version":"${parsed.version}","platform":"${platform}","arch":"x64","fileName":"${parsed.path}","sha512":"${parsed.sha512}","releaseNotes":"${notes}"}'`);
}
