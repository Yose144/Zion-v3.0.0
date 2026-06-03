// ─── ZION Dashboard v2 — Keyboard Help Modal (v2.9 glass) ────────────────────
import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface Props { onClose: () => void; }

const SHORTCUTS: [string, string][] = [
  ['O', 'Overview'],
  ['L', 'Logs'],
  ['E', 'Explorer'],
  ['C', 'Controls'],
  ['H', 'Hiran AI'],
  ['S', 'Services'],
  ['M', 'Charts (Metrics)'],
  ['A', 'Alerts'],
  ['W', 'Wallets'],
  ['T', 'Topology'],
  ['1', 'L1 Consensus'],
  ['2', 'L2 Bridge'],
  ['3', 'L3 Warp'],
  ['B  /  [', 'Toggle Sidebar'],
  ['?', 'This help'],
  ['Esc', 'Close modal'],
];

const GROUPS: Record<string, string[]> = {
  'Navigation': ['O','L','E','C','H','S','M','A','W','T'],
  'Layers':     ['1','2','3'],
  'UI':         ['B  /  [','?','Esc'],
};

export function KeyboardHelp({ onClose }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="zion-panel p-6 w-80 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(147,51,234,0.2)', border: '1px solid rgba(147,51,234,0.35)' }}
            >
              <Keyboard size={13} className="text-violet-400" />
            </div>
            <h2 className="text-sm font-bold text-gradient">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Shortcuts by group */}
        <div className="space-y-5">
          {Object.entries(GROUPS).map(([group, keys]) => {
            const entries = SHORTCUTS.filter(([k]) =>
              keys.some(gk => k.startsWith(gk.trim().split(/\s/)[0]))
            );
            return (
              <div key={group}>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-2">
                  {group}
                </p>
                <div className="space-y-1.5">
                  {entries.map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{label}</span>
                      <kbd
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold"
                        style={{
                          background: 'rgba(6,182,212,0.1)',
                          border: '1px solid rgba(6,182,212,0.25)',
                          color: 'rgb(34,211,238)',
                        }}
                      >
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="mt-5 pt-4 text-[10px] text-slate-600 text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          Shortcuts inactive when cursor is in an input field
        </div>
      </div>
    </div>
  );
}
