'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/core/i18n';
import { useNet } from './useNet';
import { ChatPanel } from './ChatPanel';

/**
 * Chat pro přihlášené (ZIS) — plovoucí dok v pravém dolním rohu.
 *
 * Pravidla, která drží:
 *   - host **čte**, ale nepsíše (server to odmítne, UI to jen vysvětlí),
 *   - jméno ani avatar se odsud neposílají — server je bere z cookie,
 *   - klávesy v otevřeném panelu nesmí utíkat do hry (`stopPropagation`),
 *   - na stránkách se zámkem myši (aréna) otevření panelu zámek uvolní.
 *
 * Panel je záměrně malý a nezabírá HUD: hraje se i s ním otevřeným.
 */

export function ChatDock() {
  const { t } = useI18n();
  const pathname = usePathname();
  const { status, lines } = useNet();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const seenRef = useRef(0);

  // klávesa T otevře/zavře, Esc zavře; uvnitř inputu se do hry nic neposílá
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (event.key === 'Escape' && open) {
        setOpen(false);
        return;
      }
      if (!open && !typing && (event.key === 't' || event.key === 'T') && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // otevření: uvolnit pointer lock (aréna); fokus do vstupu řeší ChatPanel
  useEffect(() => {
    if (open && typeof document !== 'undefined' && document.pointerLockElement) {
      void document.exitPointerLock();
    }
  }, [open]);

  // nepřečtené: počítá jen dok a jen když je zavřený
  useEffect(() => {
    if (open) {
      seenRef.current = lines.length;
      setUnread(0);
      return;
    }
    setUnread(Math.max(0, lines.length - seenRef.current));
  }, [lines, open]);

  // Lobby má chat přímo ve stránce — plovoucí dok by byl druhý, navíc
  // s vlastním počítadlem nepřečtených.
  if (pathname === '/multiplayer') return null;

  return (
    <>
      <button
        type="button"
        className={`chat-dock-btn${open ? ' is-open' : ''}${status !== 'open' ? ' is-offline' : ''}`}
        aria-label={t('chat')}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden>◉</span>
        <span className="chat-dock-label">{t('chat')}</span>
        {unread > 0 && !open && <em className="chat-dock-badge">{unread > 9 ? '9+' : unread}</em>}
      </button>

      {open && <ChatPanel onClose={() => setOpen(false)} />}
    </>
  );
}
