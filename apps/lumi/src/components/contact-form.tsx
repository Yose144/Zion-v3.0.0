'use client';

import { useState } from 'react';
import { Check, Loader2, Send } from 'lucide-react';
import { CONTACT } from '@/data/pages';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';

export default function ContactForm() {
  const { lang } = useLang();
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: 'objednavka', message: '' });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.subject, name: form.name, email: form.email, phone: form.phone, message: form.message, lang }),
      });
      const json = await response.json();
      setState(json?.success ? 'done' : 'error');
      if (json?.success) setForm({ name: '', email: '', phone: '', subject: 'objednavka', message: '' });
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-2xl border border-amber-600/30 bg-amber-500/10 p-6">
        <p className="inline-flex items-start gap-2 text-sm font-medium text-amber-900">
          <Check className="mt-0.5 h-4 w-4 shrink-0" /> {pick(CONTACT.form.success, lang)}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">{pick(CONTACT.form.name, lang)} *</span>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" autoComplete="name" />
        </label>
        <label className="block">
          <span className="label">{pick(CONTACT.form.email, lang)} *</span>
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" autoComplete="email" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">{pick(CONTACT.form.phone, lang)}</span>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" autoComplete="tel" />
        </label>
        <label className="block">
          <span className="label">{pick(CONTACT.form.subject, lang)}</span>
          <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input">
            {CONTACT.form.subjectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {pick(option.label, lang)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">{pick(CONTACT.form.message, lang)} *</span>
        <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === 'sending'} className="btn-primary">
          {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {pick(CONTACT.form.submit, lang)}
        </button>
        <p className="text-xs text-muted">
          {pick({ cs: 'Odpovídáme obvykle do jednoho pracovního dne.', en: 'We usually reply within one working day.', de: 'Wir antworten meist innerhalb eines Werktags.' }, lang)}
        </p>
      </div>
      {state === 'error' && <p className="text-sm text-rust">{pick(CONTACT.form.error, lang)}</p>}
    </form>
  );
}
