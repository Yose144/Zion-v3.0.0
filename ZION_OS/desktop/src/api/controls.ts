// Local control actions executed via Tauri shell — no Python dashboard required.

import { Command } from '@tauri-apps/plugin-shell';
import { isTauri } from '../lib/fs';

const SCRIPTS_DIR = '/home/zionserver/2.9.6-main/scripts';

export interface ControlResult {
  ok: boolean;
  output?: string;
  error?: string;
}

export async function runScript(scriptName: string, args: string[] = []): Promise<ControlResult> {
  if (!isTauri()) {
    return { ok: false, error: 'Tauri shell not available' };
  }
  try {
    const output = await Command.create('bash', [`${SCRIPTS_DIR}/${scriptName}`, ...args]).execute();
    return {
      ok: output.code === 0,
      output: output.stdout,
      error: output.stderr || undefined,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function startLocalBackup(): Promise<ControlResult> {
  return runScript('launch-local-backup.sh');
}

export async function stopLocalBackup(): Promise<ControlResult> {
  return runScript('stop-stack.sh');
}

export async function restartStack(): Promise<ControlResult> {
  return runScript('autostart-all.sh');
}

export async function stopStack(): Promise<ControlResult> {
  return runScript('stop-stack.sh');
}

export async function toggleWatchdog(): Promise<{ ok: boolean; enabled?: boolean; error?: string }> {
  const res = await runScript('watchdog-toggle.sh');
  return { ok: res.ok, error: res.error };
}

export async function restartService(service: string): Promise<ControlResult> {
  if (service === 'zion-stack') {
    return restartStack();
  }
  if (service === 'zion-backup-node') {
    return runScript('systemctl', ['--user', 'restart', 'zion-backup-node.service']);
  }
  return runScript('systemctl', ['--user', 'restart', `${service}.service`]);
}
