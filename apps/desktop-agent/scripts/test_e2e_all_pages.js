#!/usr/bin/env node
/**
 * E2E Page Data Tests — exercises every IPC handler that the renderer calls.
 *
 * This script loads main.js (which registers all ipcMain handlers),
 * then creates a hidden test window with preload.js to call each
 * electronAPI method and verify it returns real data.
 *
 * Usage:  npx electron scripts/test_e2e_all_pages.js
 */
'use strict';

// Load main.js — this registers all ipcMain.handle() calls.
// main.js will create its own windows and may auto-start mining,
// but that's fine — we just need the IPC handlers registered.
require('../src/main.js');

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let testWindow = null;
const results = {};
const errors = {};

function log(msg) {
  const ts = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${ts}] ${msg}`);
}

function channelToMethod(channel) {
  return channel.split('-').map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function summarizeResult(r) {
  if (r === null || r === undefined) return 'null';
  if (typeof r === 'string') return `"${r.substring(0, 60)}${r.length > 60 ? '...' : ''}"`;
  if (typeof r === 'number' || typeof r === 'boolean') return String(r);
  if (typeof r === 'object') {
    if (Array.isArray(r)) return `Array[${r.length}]`;
    const keys = Object.keys(r);
    if (keys.length === 0) return '{}';
    if (keys.length <= 6) return `{${keys.join(', ')}}`;
    return `{${keys.slice(0, 6).join(', ')} +${keys.length - 6} more}`;
  }
  return String(r).substring(0, 80);
}

async function testChannel(channel, ...args) {
  const method = channelToMethod(channel);
  log(`  Testing ${method}() ...`);
  try {
    const js = `window.electronAPI && window.electronAPI.${method} ? window.electronAPI.${method}(${args.map(a => JSON.stringify(a)).join(', ')}) : Promise.reject(new Error('electronAPI.${method} not found'))`;
    const result = await testWindow.webContents.executeJavaScript(js);
    results[channel] = result;
    log(`  ✓ ${method}() → ${summarizeResult(result)}`);
    return result;
  } catch (err) {
    errors[channel] = err.message;
    log(`  ✗ ${method}() → ERROR: ${err.message}`);
    return null;
  }
}

async function runAllTests() {
  log('=== E2E Page Data Tests ===\n');

  // ── Dashboard ──
  log('━━━ DASHBOARD ━━━');
  await testChannel('get-stats');
  await testChannel('get-gpu-info');

  // ── Wallet ──
  log('\n━━━ WALLET ━━━');
  await testChannel('get-config');
  await testChannel('list-wallets');
  await testChannel('validate-address', 'zion1g8y2r8j8l6q6f643u5v4s5k2z8a0q8t6a2nw8g3');
  await testChannel('wallet-get-balance', { address: 'zion1g8y2r8j8l6q6f643u5v4s5k2z8a0q8t6a2nw8g3' });

  // ── Bridge ──
  log('\n━━━ BRIDGE ━━━');
  await testChannel('cli-bridge-status');
  await testChannel('cli-bridge-chains');
  await testChannel('cli-bridge-pending');

  // ── DEX ──
  log('\n━━━ DEX ━━━');
  log('  (uses direct HTTP fetch to localhost:8454 — skipping IPC test)');

  // ── DeFi ──
  log('\n━━━ DEFI ━━━');
  log('  (uses openExternal + BaseScan API — skipping IPC test)');

  // ── DAO ──
  log('\n━━━ DAO ━━━');
  await testChannel('cli-dao-status');
  await testChannel('cli-dao-proposals');
  await testChannel('cli-dao-treasury');
  await testChannel('cli-dao-params');
  await testChannel('dao-get-proposals');
  await testChannel('dao-get-treasury');

  // ── Network ──
  log('\n━━━ NETWORK ━━━');
  await testChannel('get-server-status');
  await testChannel('get-network-metrics');
  await testChannel('get-peer-list');

  // ── Node ──
  log('\n━━━ NODE ━━━');
  await testChannel('node-get-status');
  await testChannel('node-get-peers');
  await testChannel('node-get-checkpoints');

  // ── CLI ──
  log('\n━━━ CLI ━━━');
  await testChannel('cli-get-version');
  await testChannel('cli-mine-status');
  await testChannel('cli-wallet-list');
  await testChannel('cli-config-get', { key: 'pool' });
  await testChannel('cli-pool-stats', { pool: '62.171.141.136:8444' });
  await testChannel('cli-pool-miners', { pool: '62.171.141.136:8444' });

  // ── Settings ──
  log('\n━━━ SETTINGS ━━━');
  await testChannel('get-system-info');

  // ── Logs ──
  log('\n━━━ LOGS ━━━');
  log('  (uses onMinerOutput event stream — skipping IPC test)');

  // ── AI ──
  log('\n━━━ AI ━━━');
  await testChannel('ai-chat-status');
  await testChannel('ai-native-status');
  await testChannel('ncl-get-status');
  await testChannel('ncl-get-leaderboard');

  // ── About ──
  log('\n━━━ ABOUT ━━━');
  await testChannel('get-update-settings');
  await testChannel('get-security-status');
  await testChannel('get-license-key');

  // ── Summary ──
  log('\n=== SUMMARY ===');
  const tested = Object.keys(results).length + Object.keys(errors).length;
  const passed = Object.keys(results).length;
  const failed = Object.keys(errors).length;
  log(`Tested: ${tested} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    log('\n--- FAILED CHANNELS ---');
    for (const [ch, err] of Object.entries(errors)) {
      log(`  ✗ ${ch}: ${err}`);
    }
  }

  // Check for empty/null results (potential data flow issues)
  const emptyResults = [];
  for (const [ch, r] of Object.entries(results)) {
    if (r === null || r === undefined || (typeof r === 'object' && r !== null && Object.keys(r).length === 0)) {
      emptyResults.push(ch);
    }
    if (r && r.success === false && !r.error) {
      emptyResults.push(`${ch} (success=false)`);
    }
  }
  if (emptyResults.length > 0) {
    log('\n--- EMPTY/NULL RESULTS (potential data issues) ---');
    for (const ch of emptyResults) {
      log(`  ⚠ ${ch}`);
    }
  }

  // Write full results to file
  const reportPath = path.join(__dirname, '..', 'e2e_test_report.json');
  try {
    fs.writeFileSync(reportPath, JSON.stringify({ results, errors, timestamp: new Date().toISOString() }, null, 2));
    log(`\nFull report: ${reportPath}`);
  } catch (e) {
    log(`\nCould not write report: ${e.message}`);
  }

  app.quit();
}

// Wait for main.js to finish initializing, then create our test window
app.whenReady().then(async () => {
  // Give main.js time to initialize
  await new Promise(r => setTimeout(r, 3000));

  // Create a hidden test window that loads the UI (to get preload.js context)
  testWindow = new BrowserWindow({
    width: 400,
    height: 300,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  const htmlPath = path.join(__dirname, '..', 'src', 'ui', 'index.html');
  try {
    await testWindow.loadFile(htmlPath);
  } catch (e) {
    log(`Failed to load HTML: ${e.message}`);
    app.quit();
    return;
  }

  // Wait for preload to initialize
  await new Promise(r => setTimeout(r, 2000));

  await runAllTests();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
