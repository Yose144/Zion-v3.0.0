#!/usr/bin/env node
/**
 * Start standalone serveru bez `next start` (to s `output: standalone` nefunguje).
 * Statiku stageuje `stage.mjs`, aby se nasazení a lokální běh chovaly stejně.
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { APP_DIR, stageStandalone } from './stage.mjs';

const appOut = stageStandalone(APP_DIR);
const port = process.env.PORT ?? '3020';

console.log(`start → http://127.0.0.1:${port}`);

const child = spawn(process.execPath, [join(appOut, 'server.js')], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port, HOSTNAME: process.env.HOSTNAME ?? '127.0.0.1' },
});

child.on('exit', (code) => process.exit(code ?? 0));
