// ─── ZION Dashboard v2 — Settings Tab ───────────────────────────────────────
import React from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-(--color-border-dim) last:border-0">
      <label className="text-sm text-(--color-text)">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-(--color-zion-purple)' : 'bg-(--color-border)'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}

export default function SettingsTab() {
  const settings = useSettingsStore();
  const { update, reset } = settings;

  return (
    <div className="p-6 space-y-6 max-w-2xl">

      <Card title="Display" accent="purple">
        <Row label="Show Timestamps">
          <Toggle value={settings.showTimestamps} onChange={v => update({ showTimestamps: v })} />
        </Row>
        <Row label="Auto-scroll Logs">
          <Toggle value={settings.autoScroll} onChange={v => update({ autoScroll: v })} />
        </Row>
        <Row label="Compact Mode">
          <Toggle value={settings.compactMode} onChange={v => update({ compactMode: v })} />
        </Row>
        <Row label="Sidebar Collapsed">
          <Toggle value={settings.sidebarCollapsed} onChange={v => update({ sidebarCollapsed: v })} />
        </Row>
      </Card>

      <Card title="Performance" accent="cyan">
        <Row label="Refresh Interval">
          <select
            value={settings.refreshIntervalMs}
            onChange={e => update({ refreshIntervalMs: Number(e.target.value) })}
            className="bg-(--color-bg-base) border border-(--color-border) rounded px-2 py-1 text-xs text-(--color-text) focus:outline-none focus:border-(--color-zion-purple)/60"
          >
            <option value={3000}>3s (fast)</option>
            <option value={5000}>5s (default)</option>
            <option value={10000}>10s (slow)</option>
            <option value={30000}>30s (very slow)</option>
          </select>
        </Row>
        <Row label="Max Log Lines">
          <select
            value={settings.maxLogLines}
            onChange={e => update({ maxLogLines: Number(e.target.value) })}
            className="bg-(--color-bg-base) border border-(--color-border) rounded px-2 py-1 text-xs text-(--color-text) focus:outline-none focus:border-(--color-zion-purple)/60"
          >
            <option value={1000}>1 000</option>
            <option value={3000}>3 000 (default)</option>
            <option value={10000}>10 000</option>
            <option value={50000}>50 000</option>
          </select>
        </Row>
      </Card>

      <Card title="About" accent="gold">
        <div className="space-y-2 text-xs text-(--color-text-muted)">
          <p>ZION Dashboard v2.0 — React 19 + TypeScript + Vite + Tailwind CSS 4</p>
          <p>Backend: Python stdlib HTTP server on port 8766</p>
          <p>WebSocket: ws://127.0.0.1:8766/ws</p>
        </div>
      </Card>

      <Button variant="danger" size="sm" onClick={reset}>Reset to Defaults</Button>
    </div>
  );
}
