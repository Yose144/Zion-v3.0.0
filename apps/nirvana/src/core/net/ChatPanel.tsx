'use client';

/**
 * CHAT PANEL — jedno tělo chatu pro dva obaly.
 *
 * Používá ho plovoucí `ChatDock` (tlačítko v rohu, klávesa T) i lobby
 * (`/multiplayer`), kde je potřeba vidět, co se děje, ještě než do hry
 * vstoupíš. Kdyby měly dvě kopie, rozejdou se v tom, co smí host a co
 * přihlášený — a to je přesně pravidlo, které drží server.
 *
 * Panel neposílá jméno ani identitu: jen text. Server si je vezme z cookie.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/core/i18n';
import { avatarById } from '@/core/avatars/catalog';
import { CHAT_MAX_LEN } from './protocol';
import { useNet, type NetLine } from './useNet';
import { InviteButton } from './InviteButton';

function time(at: number): string {
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function ChatPanel({
  variant = 'dock',
  onClose,
}: {
  /** `dock` = plovoucí panel, `inline` = karta v lobby. */
  variant?: 'dock' | 'inline';
  onClose?: () => void;
}) {
  const { lang, t } = useI18n();
  const { status, you, online, members, lines, rtt, connected, sendChat, roomId } = useNet();
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cs = lang === 'cs';
  /**
   * Psát smí i host (server to dovolí s limitem 1 zprávy / 4 s) — jinak by
   * chat v multiplayeru byl pro nepřihlášené jen čtecí tabule.
   */
  const guest = you?.role !== 'zis';

  useEffect(() => {
    if (variant !== 'dock') return;
    const timer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [variant]);

  // nové zprávy: vždycky dolů (v lobby i v docku)
  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines]);

  const submit = useCallback(() => {
    if (!draft.trim()) return;
    if (!sendChat(draft)) return;
    setDraft('');
  }, [draft, sendChat]);

  const statusLabel = useMemo(() => {
    if (status === 'open') return `${online} ${t('chatOnline')}${rtt !== null ? ` · ${rtt} ms` : ''}`;
    if (status === 'connecting') return t('chatConnecting');
    return t('chatOffline');
  }, [status, online, rtt, t]);

  const rows = useMemo<NetLine[]>(() => lines.slice(-80), [lines]);

  return (
    <section className={variant === 'inline' ? 'chat-panel is-inline' : 'chat-panel'} aria-label={t('chat')}>
      <header className="chat-head">
        <strong>
          {t('chat')}
          {variant === 'inline' && (
            <em className="chat-channel">{roomId ? roomId : cs ? 'park' : 'park'}</em>
          )}
        </strong>
        <span className={`chat-state${status === 'open' ? ' is-live' : ''}`}>{statusLabel}</span>
        <InviteButton roomId={roomId} className="chat-invite" />
        {onClose && (
          <button type="button" className="chat-close" onClick={onClose} aria-label={t('close')}>
            ×
          </button>
        )}
      </header>

      {members.length > 0 && (
        <ul className="chat-members" title={members.map((member) => member.name).join(', ')}>
          {members.slice(0, 8).map((member) => {
            // ZIS sigil má přednost; bez něj se ukáže zvolený OASIS avatar,
            // takže člověk vidí v chatu stejnou tvář jako ve hře.
            const sigil = member.avatar ?? avatarById(member.avatarId)?.portrait ?? null;
            return (
              <li key={member.id} className={`chat-member${member.role === 'zis' ? ' is-zis' : ''}`}>
                {sigil ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sigil} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden>{member.name.slice(0, 1).toUpperCase()}</span>
                )}
                <em>{member.name}</em>
              </li>
            );
          })}
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
              className={`chat-line${line.role === 'zis' ? ' is-zis' : ''}${line.park ? ' is-park' : ''}`}
            >
              <span className="chat-time">{time(line.at)}</span>
              <span className="chat-name">
                {line.park ? (cs ? 'hala · ' : 'hall · ') : ''}
                {line.name}
              </span>
              <span className="chat-text">{line.text}</span>
            </p>
          ),
        )}
      </div>

      <>
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
            aria-label={cs ? 'zpráva' : 'message'}
            onChange={(event) => setDraft(event.target.value)}
            // klávesy nesmí propadnout do hry (WASD by rozjelo vozítko)
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') onClose?.();
            }}
            onKeyUp={(event) => event.stopPropagation()}
          />
          <button type="submit" className="chat-send" disabled={!connected || !draft.trim()}>
            {t('chatSend')}
          </button>
        </form>
        {guest && (
          <p className="chat-guest">
            {t('chatGuest')} <a href="/#portal=account">{t('chatGuestLink')}</a>
          </p>
        )}
      </>
    </section>
  );
}
