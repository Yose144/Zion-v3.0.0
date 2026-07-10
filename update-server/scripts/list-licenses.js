#!/usr/bin/env node
// List all licenses
// Env: UPDATE_ADMIN_TOKEN, UPDATE_SERVER_URL

const SERVER_URL = process.env.UPDATE_SERVER_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.UPDATE_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('ERROR: UPDATE_ADMIN_TOKEN not set');
  process.exit(1);
}

try {
  const res = await fetch(`${SERVER_URL}/admin/licenses`, {
    headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Failed:', data.error || res.statusText);
    process.exit(1);
  }

  if (!data.licenses || data.licenses.length === 0) {
    console.log('No licenses found.');
    process.exit(0);
  }

  console.log(`${data.licenses.length} license(s):\n`);
  for (const l of data.licenses) {
    const status = l.status === 'active' ? 'OK' : l.status.toUpperCase();
    console.log(`  ${l.key}  ${status}  ${l.email}  (${l.activation_count}/${l.max_activations} activations, ${l.device_count} devices)  ${l.created_at}`);
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
