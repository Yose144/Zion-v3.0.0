'use client';

import { useState } from 'react';
import { Check, Loader2, Send } from 'lucide-react';
import { SITE } from '@/data/site';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';

export default function NewsletterForm({ source = 'footer' }: { source?: string }) {
  const { lang } = useLang();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang, source }),
      });
      const json = await response.json();
      setState(json?.success ? 'done' : 'error');
      if (json?.success) setEmail('');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl border border-amber-600/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900">
        <Check className="h-4 w-4" /> {pick(SITE.newsletter.success, lang)}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`newsletter-${source}`}>
          E-mail
        </label>
        <input
          id={`newsletter-${source}`}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={pick(SITE.newsletter.placeholder, lang)}
          className="input flex-1"
          autoComplete="email"
        />
        <button type="submit" disabled={state === 'sending'} className="btn-primary shrink-0">
          {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {pick(SITE.newsletter.button, lang)}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {state === 'error' ? 'Zkuste to prosím znovu.' : pick(SITE.newsletter.consent, lang)}
      </p>
    </form>
  );
}
