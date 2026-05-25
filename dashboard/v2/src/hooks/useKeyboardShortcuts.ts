// ─── ZION Dashboard v2 — Keyboard Shortcuts ──────────────────────────────────
import { useEffect } from 'react';
import type { TabId } from '../components/layout/Sidebar';

const TAB_KEYS: Record<string, TabId> = {
  o: 'overview',
  l: 'logs',
  e: 'explorer',
  c: 'controls',
  h: 'hiran',
  s: 'services',
  m: 'charts',    // m for metrics/charts
  a: 'alerts',
  w: 'wallets',
  t: 'topology',
  '1': 'l1',
  '2': 'l2',
  '3': 'l3',
};

interface Options {
  onTabChange: (id: TabId) => void;
  onToggleSidebar: () => void;
  onShowHelp: () => void;
}

export function useKeyboardShortcuts({ onTabChange, onToggleSidebar, onShowHelp }: Options) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in form fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) return;

      // ? or Shift+/ → help
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        onShowHelp();
        return;
      }
      // b or [ → toggle sidebar
      if (e.key === 'b' || e.key === '[') {
        e.preventDefault();
        onToggleSidebar();
        return;
      }
      // Escape → close modals (dispatched via CustomEvent)
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('zion:escape'));
        return;
      }
      // Single-key tab navigation
      const tabId = TAB_KEYS[e.key.toLowerCase()];
      if (tabId && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onTabChange(tabId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onTabChange, onToggleSidebar, onShowHelp]);
}
