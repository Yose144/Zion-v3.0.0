#!/usr/bin/env node
/**
 * Cross-platform Electron launcher.
 * Bypasses the npm → cmd.exe shell which breaks on paths containing '&'
 * (e.g. APP&WEB).  This script calls electron directly via Node child_process.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const electronPath = require('electron');
const appRoot = path.join(__dirname, '..');

try {
  execFileSync(electronPath, [appRoot], {
    stdio: 'inherit',
    cwd: appRoot,
    env: { ...process.env }
  });
} catch (err) {
  if (err.status) process.exit(err.status);
  process.exit(1);
}
