'use client';

/**
 * POZVAT DO HRY — jedno tlačítko, které zkopíruje odkaz na tvoji místnost.
 *
 * Odkaz míří na `/multiplayer?room=<id>`, takže funguje i pro člověka,
 * který lobby ještě neviděl: otevře stránku a server ho posadí do stejné
 * místnosti (hra se pozná z prefixu id).
 *
 * Proč komponenta: pozvánka je potřeba na třech místech (lobby banner,
 * chat, herní chrome). Kdyby si každé skládalo URL samo, rozejdou se.
 */

import { useCallback, useState } from 'react';
import { useI18n } from '@/core/i18n';

export function InviteButton({
  roomId,
  className = '',
  label,
}: {
  roomId: string | null;
  className?: string;
  label?: { cs: string; en: string };
}) {
  const { lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);

  const link =
    typeof window === 'undefined' || !roomId
      ? ''
      : `${window.location.origin}/multiplayer?room=${encodeURIComponent(roomId)}`;

  const copy = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setManual(null);
    } catch {
      // Bez schránky **nesmíme** otevřít `window.prompt` (blokuje stránku).
      setManual(link);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [link]);

  if (!roomId) return null;

  return (
    <>
      <button type="button" className={`invite-btn ${className}`.trim()} onClick={copy} title={link}>
        {copied
          ? lang === 'cs'
            ? 'odkaz zkopírován ✓'
            : 'link copied ✓'
          : (label?.[lang] ?? (lang === 'cs' ? 'Pozvat' : 'Invite'))}
      </button>
      {manual && (
        <input
          className="invite-manual"
          readOnly
          value={manual}
          aria-label={lang === 'cs' ? 'pozvánka' : 'invite'}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </>
  );
}
