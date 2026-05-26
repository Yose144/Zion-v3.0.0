// ─── ZION Dashboard v2 — Settings Tab (v2.9 glass) ──────────────────────────
import React from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between py-3"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div>
        <label className="text-sm text-slate-200 font-medium">{label}</label>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-all duration-200"
      style={{
        background: value
          ? 'linear-gradient(135deg, rgb(147,51,234), rgb(168,85,247))'
          : 'rgba(255,255,255,0.1)',
        boxShadow: value ? '0 0 12px rgba(147,51,234,0.4)' : undefined,
      }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: value ? 'translateX(20px)' : undefined }}
      />
    </button>
  );
}

const SELECT_STYLE: React.CSSProperties = {
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '0.75rem',
  padding: '0.35rem 0.75rem',
  fontSize: '0.75rem',
  color: 'rgb(203,213,225)',
  outline: 'none',
};

export default function SettingsTab() {
  const settings = useSettingsStore();
  const { update, reset } = settings;

  return (
    <div className="p-6 space-y-6 max-w-2xl">

      <h2 className="text-sm font-bold text-gradient tracking-wide">Settings</h2>

      {/* Display */}
      <Card title="Display" accent="purple">
        <Row label="Show Timestamps" sub="Show HH:MM:SS in log rows">
          <Toggle value={settings.showTimestamps} onChange={v => update({ showTimestamps: v })} />
        </Row>
        <Row label="Auto-scroll Logs" sub="Follow new log lines automatically">
          <Toggle value={settings.autoScroll} onChange={v => update({ autoScroll: v })} />
        </Row>
        <Row label="Compact Mode" sub="Tighter padding for dense information">
          <Toggle value={settings.compactMode} onChange={v => update({ compactMode: v })} />
        </Row>
        <Row label="Sidebar Collapsed" sub="Show only icons in navigation">
          <Toggle value={settings.sidebarCollapsed} onChange={v => update({ sidebarCollapsed: v })} />
        </Row>
      </Card>

      {/* Performance */}
      <Card title="Performance" accent="cyan">
        <Row label="Refresh Interval" sub="How often to poll backend APIs">
          <select
            value={settings.refreshIntervalMs}
            onChange={e => update({ refreshIntervalMs: Number(e.target.value) })}
            style={SELECT_STYLE}
          >
            <option value={3000}>3 s  (fast)</option>
            <option value={5000}>5 s  (default)</option>
            <option value={10000}>10 s  (slow)</option>
            <option value={30000}>30 s  (very slow)</option>
          </select>
        </Row>
        <Row label="Max Log Lines" sub="Lines retained in memory per service">
          <select
            value={settings.maxLogLines}
            onChange={e => update({ maxLogLines: Number(e.target.value) })}
            style={SELECT_STYLE}
          >
            <option value={1000}>1 000</option>
            <option value={3000}>3 000  (default)</option>
            <option value={10000}>10 000</option>
            <option value={50000}>50 000</option>
          </select>
        </Row>
      </Card>

      {/* About */}
      <Card title="About" accent="gold">
        <div className="space-y-2.5 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>Frontend</span>
            <span className="text-slate-300 font-mono">React 19 + TypeScript + Vite 8</span>
          </div>
          <div
            className="h-px"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />
          <div className="flex justify-between">
            <span>Styling</span>
            <span className="text-slate-300 font-mono">Tailwind CSS 4 + v2.9 design</span>
          </div>
          <div
            className="h-px"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />
          <div className="flex justify-between">
            <span>Backend</span>
            <span className="text-slate-300 font-mono">Python stdlib · port 8766</span>
          </div>
          <div
            className="h-px"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />
          <div className="flex justify-between">
            <span>WebSocket</span>
            <span className="text-slate-300 font-mono">ws://127.0.0.1:8766/ws</span>
          </div>
        </div>
      </Card>

      {/* Reset */}
      <Button variant="danger" size="sm" onClick={reset}>
        Reset to Defaults
      </Button>

    </div>
  );
}
