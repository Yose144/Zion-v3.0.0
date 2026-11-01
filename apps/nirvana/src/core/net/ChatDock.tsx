'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { CHAT_MAX_LEN } from './protocol';
import { useNet, type NetLine } from './useNet';

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

function time(at: number): string {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function ChatDock() {
  const { lang, t } = useI18n();
  const { status, you, online, members, lines, rtt, connected, sendChat } = useNet();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState(0);
  const seenRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cs = lang === 'cs';
  const canWrite = you?.role === 'zis';

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

  // otevření: uvolnit pointer lock (aréna) a fokus do vstupu
  useEffect(() => {
    if (!open) return;
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      void document.exitPointerLock();
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [open]);

  // nové zprávy: odscrollovat dolů a počítat nepřečtené
  useEffect(() => {
    if (open) {
      seenRef.current = lines.length;
      setUnread(0);
      const node = listRef.current;
      if (node) node.scrollTop = node.scrollHeight;
      return;
    }
    setUnread(Math.max(0, lines.length - seenRef.current));
  }, [lines, open]);

  const submit = useCallback(() => {
    const text = draft;
    if (!text.trim()) return;
    if (!sendChat(text)) return;
    setDraft('');
  }, [draft, sendChat]);

  const statusLabel = useMemo(() => {
    if (status === 'open') return `${online} ${t('chatOnline')}${rtt !== null ? ` · ${rtt} ms` : ''}`;
    if (status === 'connecting') return t('chatConnecting');
    return t('chatOffline');
  }, [status, online, rtt, t]);

  const rows = useMemo<NetLine[]>(() => lines.slice(-80), [lines]);

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

      {open && (
        <section className="chat-panel" aria-label={t('chat')}>
          <header className="chat-head">
            <strong>{t('chat')}</strong>
            <span className={`chat-state${status === 'open' ? ' is-live' : ''}`}>{statusLabel}</span>
            <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label={t('close')}>
              ×
            </button>
          </header>

          {members.length > 0 && (
            <ul className="chat-members" title={members.map((m) => m.name).join(', ')}>
              {members.slice(0, 8).map((member) => (
                <li key={member.id} className={`chat-member${member.role === 'zis' ? ' is-zis' : ''}`}>
                  {member.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatar} alt="" loading="lazy" />
                  ) : (
                    <span aria-hidden>{member.name.slice(0, 1).toUpperCase()}</span>
                  )}
                  <em>{member.name}</em>
                </li>
              ))}
              {members.length > 8 && <li className="chat-more">+{members.length - 8}</li>}
            </ul>
          )}

          <div className="chat-lines" ref={listRef}>
            {rows.length === 0 && <p className="chat-empty">{t('chatEmpty')}</p>}
            {rows.map((line, index) =>
              line.kind === 'system' ? (
                <p key={`s-${line.at}-${index}`} className="chat-line is-system">
                  {line.text}
                </p>
              ) : (
                <p
                  key={`c-${line.at}-${index}`}
                  className={`chat-line${line.role === 'zis' ? ' is-zis' : ''}`}
                >
                  <span className="chat-time">{time(line.at)}</span>
                  <span className="chat-name">{line.name}</span>
                  <span className="chat-text">{line.text}</span>
                </p>
              ),
            )}
          </div>

          {canWrite ? (
            <form
              className="chat-compose"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <input
                ref={inputRef}
                value={draft}
                maxLength={CHAT_MAX_LEN}
                placeholder={connected ? t('chatPlaceholder') : t('chatOffline')}
                disabled={!connected}
                onChange={(event) => setDraft(event.target.value)}
                // klávesy nesmí propadnout do hry (WASD by rozjelo vozítko)
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === 'Escape') setOpen(false);
                }}
                onKeyUp={(event) => event.stopPropagation()}
              />
              <button type="submit" className="chat-send" disabled={!connected || !draft.trim()}>
                {t('chatSend')}
              </button>
            </form>
          ) : (
            <p className="chat-guest">
              {t('chatGuest')}{' '}
              <a href="/#portal=account">{t('chatGuestLink')}</a>
            </p>
          )}
        </section>
      )}
    </>
  );
}
