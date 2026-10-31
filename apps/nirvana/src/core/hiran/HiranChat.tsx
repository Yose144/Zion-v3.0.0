'use client';

/**
 * Chat Hirana — jedno tělo pro dvě místa: okno ve vesmíru a chrám
 * v `/present/hiran`. Žádná akce, žádné klíče: otázka a odpověď.
 *
 * Když inferenční uzel spí, řekne to. `degraded` drží pravdu odpovědi výš než
 * `/health`, protože ten umí říct „ano" i modelu, který nic nevydá.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '@/core/i18n';
import { hiranReviewOverride, type HiranState } from '@/core/hiran/presence';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_PROMPT = 2_000;
const PROBE_INTERVAL_MS = 30_000;

export function HiranChat({
  state,
  onStateChange,
  probe = true,
  autoFocus = true,
}: {
  state: HiranState;
  onStateChange: (next: HiranState) => void;
  /** Art review (`?hiran=`) drží stav, takže se nedotazuje na dostupnost. */
  probe?: boolean;
  autoFocus?: boolean;
}) {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const degraded = useRef(false);

  const probeNow = useCallback(async () => {
    try {
      const res = await fetch('/api/hiran', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { available?: boolean };
      const available = res.ok && data.available === true;
      if (!available) onStateChange('offline');
      else if (!degraded.current) onStateChange('idle');
    } catch {
      onStateChange('offline');
    }
  }, [onStateChange]);

  useEffect(() => {
    if (!probe || hiranReviewOverride()) return;
    void probeNow();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void probeNow();
    }, PROBE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [probe, probeNow]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || pending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setPending(true);
    onStateChange('thinking');
    try {
      const res = await fetch('/api/hiran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json().catch(() => ({}))) as { answer?: unknown; offline?: unknown };
      if (res.ok && typeof data.answer === 'string' && data.answer.trim()) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.answer as string }]);
        degraded.current = false;
        onStateChange('idle');
      } else if (data.offline === true || res.status === 503) {
        degraded.current = true;
        onStateChange('offline');
      } else {
        onStateChange('error');
      }
    } catch {
      onStateChange('error');
    } finally {
      setPending(false);
    }
  }

  const suggestions =
    lang === 'cs'
      ? ['Co je ZION?', 'Jak funguje těžba?', 'Co je Království srdce?']
      : ['What is ZION?', 'How does mining work?', 'What is the Kingdom of Hearts?'];

  return (
    <>
      <p className="muted hiran-sub">
        Hiranyagarbha · {state === 'offline' ? t('hiranOfflineShort') : t('hiranOnline')}
      </p>

      {state === 'offline' && <p className="hiran-note hiran-note-offline">{t('hiranOffline')}</p>}
      {state === 'error' && <p className="hiran-note hiran-note-error">{t('hiranError')}</p>}

      <div className="hiran-thread" ref={threadRef}>
        {messages.length === 0 && <p className="muted">{t('hiranEmpty')}</p>}
        {messages.map((message, index) => (
          <p key={index} className={`hiran-msg hiran-msg-${message.role}`}>
            {message.content}
          </p>
        ))}
        {pending && <p className="muted hiran-thinking">{t('hiranThinking')}</p>}
      </div>

      {messages.length === 0 && (
        <div className="hiran-suggestions">
          {suggestions.map((question) => (
            <button key={question} type="button" onClick={() => setInput(question)}>
              {question}
            </button>
          ))}
        </div>
      )}

      <form className="hiran-form" onSubmit={send}>
        <textarea
          ref={inputRef}
          value={input}
          maxLength={MAX_PROMPT}
          rows={2}
          placeholder={t('hiranPlaceholder')}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" disabled={pending || !input.trim()}>
          {t('hiranSend')}
        </button>
      </form>

      <p className="hiran-note muted">{t('hiranDisclaimer')}</p>
    </>
  );
}
