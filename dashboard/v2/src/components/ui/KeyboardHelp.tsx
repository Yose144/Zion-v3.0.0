// ─── ZION Dashboard v2 — Keyboard Help Modal ─────────────────────────────────
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
  ['B  or  [', 'Toggle Sidebar'],
  ['?', 'Show this help'],
  ['Esc', 'Close modals'],
];

export function KeyboardHelp({ onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-(--color-bg-card) border border-(--color-border) rounded-xl shadow-2xl p-6 w-80 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-(--color-zion-purple)" />
            <h2 className="text-sm font-bold text-(--color-text)">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-(--color-bg-hover) text-(--color-text-muted) hover:text-(--color-text)"
          >
            <X size={14} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-2">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs text-(--color-text-muted)">{label}</span>
              <kbd className="px-2 py-0.5 rounded bg-(--color-bg-base) border border-(--color-border) text-xs font-mono text-(--color-zion-cyan)">
                {key}
              </kbd>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[10px] text-(--color-text-muted) text-center">
          Shortcuts inactive when cursor is in an input field
        </p>
      </div>
    </div>
  );
}
