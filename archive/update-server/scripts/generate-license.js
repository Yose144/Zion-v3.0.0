#!/usr/bin/env node
// Generate a new license key
// Usage: node scripts/generate-license.js --email user@example.com [--name "John"] [--max 3] [--notes "..."]
// Env: UPDATE_ADMIN_TOKEN, UPDATE_SERVER_URL (default http://localhost:3001)

import { parseArgs } from 'util';

const args = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    max: { type: 'string', default: '1' },
    notes: { type: 'string', default: '' },
  },
  allowPositionals: false,
});

if (!args.values.email) {
  console.error('Usage: node scripts/generate-license.js --email <email> [--name "Name"] [--max N] [--notes "..."]');
  process.exit(1);
}

const SERVER_URL = process.env.UPDATE_SERVER_URL || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.UPDATE_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('ERROR: UPDATE_ADMIN_TOKEN not set');
  process.exit(1);
}

const body = {
  email: args.values.email,
  customerName: args.values.name || undefined,
  maxActivations: parseInt(args.values.max, 10) || 1,
  notes: args.values.notes || '',
};

try {
  const res = await fetch(`${SERVER_URL}/admin/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Failed:', data.error || res.statusText);
    process.exit(1);
  }

  console.log('License created:');
  console.log(`  Key:    ${data.licenseKey}`);
  console.log(`  Email:  ${data.email}`);
  console.log(`  Max:    ${data.max_activations} activation(s)`);
  console.log(`  Status: ${data.status}`);
  console.log('');
  console.log('Send this key to the customer.');
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
