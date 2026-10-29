'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Info, Wrench, X } from 'lucide-react';
import { useLang } from '@/lib/i18n';

/**
 * Ops-driven status banner — reads `/status.json` from the static webroot so
 * operators can post notices (deferred payouts, maintenance, degraded legs)
 * WITHOUT a UI rebuild. Absence of the file = no banner, zero noise.
 *
 * File shape (all fields optional):
 *   { "level": "info|warning|maintenance",
 *     "cs": "text", "en": "text", "id": "unique-key" }
 * `id` versions the dismiss — bump it and previously-dismissed users see it
 * again. Dismissal persists in localStorage.
 */
interface StatusNotice {
  id?: string;
  level?: 'info' | 'warning' | 'maintenance';
  cs?: string;
  en?: string;
}

const LEVEL_STYLE: Record<string, { border: string; icon: typeof Info; chip: string }> = {
  info: { border: 'border-zion-cyan/40', icon: Info, chip: 'bg-zion-cyan/15 text-zion-cyan' },
  warning: {
    border: 'border-rasta-gold/50',
    icon: AlertTriangle,
    chip: 'bg-rasta-gold/15 text-rasta-gold',
  },
  maintenance: {
    border: 'border-zion-purple/50',
    icon: Wrench,
    chip: 'bg-zion-purple/15 text-zion-purple',
  },
};

export default function StatusBanner() {
  const { lang, t } = useLang();
  const [notice, setNotice] = useState<StatusNotice | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch('/status.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: StatusNotice | null) => {
        if (!j || (!j.cs && !j.en)) return;
        const key = `pool-status-dismissed:${j.id ?? j.cs ?? j.en}`;
        try {
          if (localStorage.getItem(key)) setDismissed(true);
          else setNotice(j);
        } catch {
          setNotice(j);
        }
      })
      .catch(() => {});
  }, []);

  if (!notice || dismissed) return null;
  const level = LEVEL_STYLE[notice.level ?? 'info'] ?? LEVEL_STYLE.info;
  const Icon = level.icon;
  const text = (lang === 'cs' ? notice.cs : notice.en) ?? notice.cs ?? notice.en ?? '';
  if (!text) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(`pool-status-dismissed:${notice.id ?? notice.cs ?? notice.en}`, '1');
    } catch {}
  };

  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-xl border ${level.border} bg-black/40 px-4 py-3 backdrop-blur-sm`}
      role="status"
    >
      <span className={`mt-0.5 rounded-md p-1 ${level.chip}`}>
        <Icon size={14} />
      </span>
      <p className="flex-1 text-[0.8rem] leading-relaxed text-white/80">{text}</p>
      <button
        onClick={dismiss}
        aria-label={t('zavřít', 'dismiss')}
        className="mt-0.5 rounded-md p-1 text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
      >
        <X size={14} />
      </button>
    </div>
  );
}
