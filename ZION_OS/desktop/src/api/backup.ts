// Direct backup status via filesystem shell commands (replaces /api/backup/status).

import { Command } from '@tauri-apps/plugin-shell';
import { isTauri } from '../lib/fs';

export interface BackupItem {
  name: string;
  size: number;
  age_seconds: number;
}

export interface BackupStatus {
  ok: boolean;
  backups: BackupItem[];
  manual_backups: BackupItem[];
  auto_backups: BackupItem[];
  total_backup_mb: number;
  datadir_mb: Record<string, number | null>;
  last_backup?: string;
  backup_dir: string;
  auto_backup_dir: string;
  error?: string;
}

const REPO_ROOT = '/home/zionserver/2.9.6-main';
const MANUAL_DIR = `${REPO_ROOT}/backups`;
const AUTO_DIR = `${REPO_ROOT}/backups/auto`;
const DATA_DIR = `${REPO_ROOT}/V3/data`;

function formatDate(ts: number): string {
  return new Date(ts * 1000).toISOString();
}

async function listTarGz(dir: string, prefix: string): Promise<BackupItem[]> {
  if (!isTauri()) return [];
  try {
    const output = await Command.create('find', [dir, '-maxdepth', '1', '-type', 'f', '-name', `${prefix}*.tar.gz`, '-printf', '%T@ %s %p\\n']).execute();
    if (output.code !== 0) return [];
    const now = Math.floor(Date.now() / 1000);
    return output.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const ts = Math.floor(Number(parts[0]));
        const sizeBytes = Number(parts[1]);
        const path = parts.slice(2).join(' ');
        return {
          name: path.split('/').pop() || path,
          size: sizeBytes,
          age_seconds: Number.isNaN(ts) ? 0 : now - ts,
        };
      })
      .sort((a, b) => b.age_seconds - a.age_seconds);
  } catch {
    return [];
  }
}

async function getFileSizeMb(path: string): Promise<number | null> {
  if (!isTauri()) return null;
  try {
    const output = await Command.create('stat', ['-c', '%s', path]).execute();
    if (output.code !== 0) return null;
    return Number((Number(output.stdout.trim()) / (1024 * 1024)).toFixed(2));
  } catch {
    return null;
  }
}

async function getDirSizeMb(path: string): Promise<number | null> {
  if (!isTauri()) return null;
  try {
    const output = await Command.create('du', ['-sb', path]).execute();
    if (output.code !== 0) return null;
    const bytes = Number(output.stdout.split('\t')[0]);
    return Number((bytes / (1024 * 1024)).toFixed(2));
  } catch {
    return null;
  }
}

export async function fetchBackupStatus(): Promise<BackupStatus> {
  if (!isTauri()) {
    return {
      ok: false,
      backups: [],
      manual_backups: [],
      auto_backups: [],
      total_backup_mb: 0,
      datadir_mb: {},
      backup_dir: MANUAL_DIR,
      auto_backup_dir: AUTO_DIR,
      error: 'Tauri shell not available',
    };
  }

  const manual = await listTarGz(MANUAL_DIR, 'backup_');
  const auto = await listTarGz(AUTO_DIR, 'zion-auto-');
  const all = [...manual, ...auto].sort((a, b) => b.age_seconds - a.age_seconds);
  const totalBytes = manual.reduce((s, b) => s + b.size, 0) + auto.reduce((s, b) => s + b.size, 0);
  const totalMb = Number((totalBytes / (1024 * 1024)).toFixed(2));

  const datadir_mb: Record<string, number | null> = {
    node1: await getFileSizeMb(`${DATA_DIR}/zion-node-state.db`),
    node2: await getFileSizeMb(`${DATA_DIR}/zion-node2-state.db`),
    pool: null,
    dashboard: await getDirSizeMb(`${REPO_ROOT}/ZION_OS/dashboard`),
  };

  return {
    ok: true,
    backups: all.slice(0, 10),
    manual_backups: manual.slice(0, 5),
    auto_backups: auto.slice(0, 5),
    total_backup_mb: totalMb,
    datadir_mb,
    last_backup: all[0] ? formatDate(Math.floor(Date.now() / 1000) - all[0].age_seconds) : undefined,
    backup_dir: MANUAL_DIR,
    auto_backup_dir: AUTO_DIR,
  };
}
