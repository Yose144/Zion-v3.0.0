#!/usr/bin/env node
// Sestaví embedded Kingdom server pro desktop klienta:
//   npm run build -w @zion/kingdom   →  stageStandalone()  →  apps/desktop/bundle/
// Spustit před `npm start -w @zion/desktop` (jinak main spadne s nápovědou).
import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageStandalone } from '../../kingdom/scripts/stage.mjs';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const flat = stageStandalone();
const dest = join(appDir, 'bundle');
rmSync(dest, { recursive: true, force: true });
cpSync(flat, dest, { recursive: true });
// Flat stage adresář je per-pid pracovní kopie — bundle držíme v desktopu.
rmSync(flat, { recursive: true, force: true });

// Agent UI do embedded serveru: mining portál embeduje /agent/index.html
// v iframu — servíruje ho Next static z bundle/public/agent/.
const agentUiSrc = join(appDir, 'src', 'ui');
const agentUiDest = join(dest, 'public', 'agent');
rmSync(agentUiDest, { recursive: true, force: true });
cpSync(agentUiSrc, agentUiDest, { recursive: true });
console.log(`agent ui: ${agentUiDest}`);
console.log(`bundle: ${dest}`);
