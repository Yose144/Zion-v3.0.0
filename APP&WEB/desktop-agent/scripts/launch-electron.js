#!/usr/bin/env node
/**
 * Cross-platform Electron launcher.
 * Bypasses the npm → cmd.exe shell which breaks on paths containing '&'
 * (e.g. APP&WEB).  This script calls electron directly via Node child_process.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const electronPath = require('electron').trim();
const appRoot = path.join(__dirname, '..');

// Clean environment variables that break normal Electron GUI mode.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_NO_ATTACH_CONSOLE;

const args = [appRoot];

try {
  execFileSync(electronPath, args, {
    stdio: 'inherit',
    cwd: appRoot,
    env
  });
} catch (err) {
  if (err.status) process.exit(err.status);
  process.exit(1);
}
