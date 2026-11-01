'use client';

/**
 * Rozhovor s Hiranem.
 *
 * Leží v `core/`, ne v portálu: portály nesmí volat síť (hlídá check-boundaries),
 * a tohle je stavové UI hostitele. Portál ho jen vykreslí.
 */
import { useRef, useState } from 'react';
import type { Locale } from '@zion/contract';

interface Turn {
  role: 'user' | 'hiran';
  text: string;
}

export function HiranChat({ locale }: { locale: Locale }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const cs = locale === 'cs';

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;

    setDraft('');
    setBusy(true);
    setNote(null);
    setTurns((prev) => [...prev, { role: 'user', text: question }]);

    try {
      const response = await fetch('/api/hiran/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: question }),
      });

      const data = (await response.json()) as { response?: string; offline?: boolean };

      if (data.offline) {
        setNote(
          cs
            ? 'Hiran teď spí — inference uzel je offline. Zkus to později.'
            : 'Hiran is asleep — the inference node is offline. Try again later.',
        );
      } else if (data.response) {
        setTurns((prev) => [...prev, { role: 'hiran', text: data.response as string }]);
      } else {
        setNote(cs ? 'Hiran neodpověděl.' : 'Hiran did not answer.');
      }
    } catch {
      setNote(cs ? 'Spojení selhalo.' : 'Connection failed.');
    } finally {
      setBusy(false);
      requestAnimationFrame(() => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }

  return (
    <div className="k-card" style={{ maxWidth: 720 }}>
      <div className="k-card-title">{cs ? 'Rozhovor' : 'Conversation'}</div>

      <div
        ref={scroller}
        style={{
          maxHeight: 320,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '4px 2px',
        }}
      >
        {turns.length === 0 ? (
          <p className="k-card-desc">
            {cs
              ? 'Zeptej se na cokoli o ZIONu — řetěz, těžbu, vrstvy, knihy. Hiran odpovídá z kanonických dokumentů.'
              : 'Ask anything about ZION — chain, mining, layers, books. Hiran answers from the canonical docs.'}
          </p>
        ) : (
          turns.map((turn, index) => (
            <div
              key={index}
              style={{
                alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                background: turn.role === 'user' ? 'rgba(252,209,22,0.10)' : 'var(--k-panel-2)',
                border: '1px solid var(--k-line)',
                borderRadius: 'var(--k-radius-sm)',
                padding: '9px 12px',
                fontSize: 13.5,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {turn.text}
            </div>
          ))
        )}
      </div>

      <form onSubmit={ask} className="k-row" style={{ gap: 8, marginTop: 10 }}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={cs ? 'Napiš otázku…' : 'Type a question…'}
          maxLength={800}
          className="k-input"
          aria-label={cs ? 'Otázka pro Hirana' : 'Question for Hiran'}
        />
        <button type="submit" className="k-btn" disabled={busy || draft.trim().length === 0}>
          {busy ? '…' : cs ? 'Poslat' : 'Send'}
        </button>
      </form>

      {note ? (
        <p className="k-sub" style={{ color: 'var(--k-warn)', marginTop: 8 }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
