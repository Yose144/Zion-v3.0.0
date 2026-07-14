// Tauri shell-based filesystem helpers for reading local service logs without Python dashboard.

import { Command } from '@tauri-apps/plugin-shell';

export function isTauri(): boolean {
  try {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  } catch {
    return false;
  }
}

const SERVICE_LOG_MAP: Record<string, string> = {
  node1: 'node1.log',
  'edge-node1': 'node1.log',
  node2: 'node2.log',
  'edge-node2': 'node2.log',
  'local-backup': 'node-backup.log',
  'node-backup': 'node-backup.log',
  pool: 'pool.log',
  'pool-edge': 'pool.log',
  miner: 'miner.log',
  'miner-low': 'miner-low.log',
  'miner-cpu': 'miner-cpu.log',
  'miner-gpu': 'miner-gpu.log',
  hiranyagarbha: 'hiranyagarbha.log',
  hiran: 'hiran-inference.log',
  'hiran-inference': 'hiran-inference.log',
  bridge: 'bridge.log',
  'dao-daemon': 'dao.log',
  dao: 'dao.log',
  'atomic-swap': 'atomic-swap.log',
  warp: 'warp.log',
  oasis: 'oasis.log',
  'free-world': 'free-world.log',
  issobella: 'issobella.log',
  dashboard: 'dashboard.log',
  'control-audit': 'control-audit.txt',
  watchdog: 'watchdog.log',
  backup: 'backup.log',
  autostart: 'autostart.log',
};

export function getLogFileName(svc: string): string | undefined {
  return SERVICE_LOG_MAP[svc];
}

function resolveLogDir(): string {
  // Matches the layout used by launch scripts in this repo.
  return '/home/zionserver/2.9.6-main/logs';
}

export async function tailLogFile(svc: string, lines = 100): Promise<{ ok: boolean; lines: string[]; error?: string }> {
  if (!isTauri()) {
    return { ok: false, lines: [], error: 'Tauri shell not available' };
  }
  const fileName = getLogFileName(svc);
  if (!fileName) {
    return { ok: false, lines: [], error: `Unknown service: ${svc}` };
  }
  const logPath = `${resolveLogDir()}/${fileName}`;
  try {
    const output = await Command.create('tail', ['-n', String(lines), logPath]).execute();
    if (output.code !== 0) {
      return { ok: false, lines: [], error: output.stderr || `tail exited ${output.code}` };
    }
    return { ok: true, lines: output.stdout.split('\n').filter(Boolean) };
  } catch (e) {
    return { ok: false, lines: [], error: String(e) };
  }
}

export interface LogFileInfo {
  name: string;
  svc_id: string;
  size_kb: number;
  modified: string;
}

export interface LogFilesResponse {
  files: LogFileInfo[];
  log_dir: string;
}

export async function fetchLogFiles(): Promise<LogFilesResponse | null> {
  if (!isTauri()) return null;
  const logDir = resolveLogDir();
  try {
    const output = await Command.create('ls', ['-la', logDir]).execute();
    if (output.code !== 0) return null;
    const files: LogFileInfo[] = [];
    for (const line of output.stdout.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 9 || parts[0].startsWith('total')) continue;
      const name = parts[parts.length - 1];
      const size = parseInt(parts[4], 10);
      const date = `${parts[5]} ${parts[6]} ${parts[7]}`;
      // Reverse map file name -> service id (best effort)
      const svc_id = Object.entries(SERVICE_LOG_MAP).find(([, fn]) => fn === name)?.[0] || name.replace(/\.log$/, '');
      files.push({ name, svc_id, size_kb: Math.round((size || 0) / 1024), modified: date });
    }
    return { files, log_dir: logDir };
  } catch {
    return null;
  }
}
