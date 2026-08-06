#!/usr/bin/env node
// Revoke a license key
// Usage: node scripts/revoke-license.js <license-key>
// Env: UPDATE_ADMIN_TOKEN, UPDATE_SERVER_URL

const key = process.argv[2];
if (!key) {
  console.error('Usage: node scripts/revoke-license.js <license-key>');
  process.exit(1);
}

const SERVER_URL = process.env.UPDATE_SERVER_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.UPDATE_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('ERROR: UPDATE_ADMIN_TOKEN not set');
  process.exit(1);
}

try {
  const res = await fetch(`${SERVER_URL}/admin/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
    },
    body: JSON.stringify({ licenseKey: key }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Failed:', data.error || res.statusText);
    process.exit(1);
  }

  console.log(`License ${key} revoked.`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
