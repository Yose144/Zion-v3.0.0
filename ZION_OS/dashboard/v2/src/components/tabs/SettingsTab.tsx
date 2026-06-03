// ─── ZION Dashboard v2 — Settings Tab (v2.9 glass) ──────────────────────────
import React from 'react';
import { motion } from 'framer-motion';
import { Settings, Monitor, Cpu, Info } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/4 last:border-0">
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

export default function SettingsTab() {
  const settings = useSettingsStore();
  const { update, reset } = settings;

  const selectClass = "px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/20";

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

      {/* ── Display Panel ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0 * 0.06 }}
        className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
            <Monitor size={15} className="text-gray-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Display</h3>
            <p className="text-[11px] text-gray-500">Visual and layout preferences</p>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="rounded-2xl bg-white/5 border border-white/8 p-4">
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
          </div>
        </div>
      </motion.div>

      {/* ── Performance Panel ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 1 * 0.06 }}
        className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
            <Cpu size={15} className="text-gray-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Performance</h3>
            <p className="text-[11px] text-gray-500">Polling and memory settings</p>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="rounded-2xl bg-white/5 border border-white/8 p-4">
            <Row label="Refresh Interval" sub="How often to poll backend APIs">
              <select
                value={settings.refreshIntervalMs}
                onChange={e => update({ refreshIntervalMs: Number(e.target.value) })}
                className={selectClass}
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
                className={selectClass}
              >
                <option value={1000}>1 000</option>
                <option value={3000}>3 000  (default)</option>
                <option value={10000}>10 000</option>
                <option value={50000}>50 000</option>
              </select>
            </Row>
          </div>
        </div>
      </motion.div>

      {/* ── About Panel ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 2 * 0.06 }}
        className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
            <Info size={15} className="text-gray-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">About</h3>
            <p className="text-[11px] text-gray-500">Stack info and build details</p>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="rounded-2xl bg-white/5 border border-white/8 p-4">
            <div className="flex items-center justify-between py-3 border-b border-white/4">
              <span className="text-sm text-slate-500">Frontend</span>
              <span className="text-sm text-slate-300 font-mono">React 19 + TypeScript + Vite 8</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/4">
              <span className="text-sm text-slate-500">Styling</span>
              <span className="text-sm text-slate-300 font-mono">Tailwind CSS 4 + v2.9 design</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/4">
              <span className="text-sm text-slate-500">Backend</span>
              <span className="text-sm text-slate-300 font-mono">Python stdlib · port 8766</span>
            </div>
            <div className="flex items-center justify-between py-3 last:border-0">
              <span className="text-sm text-slate-500">WebSocket</span>
              <span className="text-sm text-slate-300 font-mono">ws://127.0.0.1:8766/ws</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Reset ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 3 * 0.06 }}
        className="rounded-[28px] border border-white/8 bg-black/60 backdrop-blur-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/6">
          <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
            <Settings size={15} className="text-gray-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Reset</h3>
            <p className="text-[11px] text-gray-500">Restore default configuration</p>
          </div>
        </div>
        <div className="px-6 py-4">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl border border-red-500/20 bg-red-500/10 text-sm text-red-400 hover:border-red-500/40 hover:bg-red-500/20 transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </motion.div>

    </div>
  );
}
