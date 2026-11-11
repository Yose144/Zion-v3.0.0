'use client';

import { useState } from 'react';
import { Check, Loader2, Send } from 'lucide-react';
import { CONTACT } from '@/data/pages';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';

export default function InquiryForm({
  type,
  compact = false,
}: {
  type: 'svatba' | 'firma' | 'kontakt';
  compact?: boolean;
}) {
  const { lang } = useLang();
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    eventDate: '',
    quantity: '',
    message: '',
  });

  const labels = CONTACT.inquiryForm;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          eventDate: form.eventDate,
          quantity: form.quantity ? Number(form.quantity) : undefined,
          message: form.message || (type === 'svatba' ? 'Mám zájem o lampiony na svatbu.' : type === 'firma' ? 'Mám zájem o firemní dárky.' : ''),
          lang,
        }),
      });
      const json = await response.json();
      if (json?.success) {
        setState('done');
        setForm({ name: '', email: '', phone: '', company: '', eventDate: '', quantity: '', message: '' });
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-2xl border border-amber-600/30 bg-amber-500/10 p-6">
        <p className="inline-flex items-start gap-2 text-sm font-medium text-amber-900">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          {pick(labels.success, lang)}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">{pick(labels.name, lang)} *</span>
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="input"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="label">{pick(labels.email, lang)} *</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="input"
            autoComplete="email"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">{pick(labels.phone, lang)}</span>
          <input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            className="input"
            autoComplete="tel"
          />
        </label>
        <label className="block">
          <span className="label">{pick(labels.company, lang)}</span>
          <input
            value={form.company}
            onChange={(event) => setForm({ ...form, company: event.target.value })}
            className="input"
            autoComplete="organization"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">{pick(labels.eventDate, lang)}</span>
          <input
            type="date"
            value={form.eventDate}
            onChange={(event) => setForm({ ...form, eventDate: event.target.value })}
            className="input"
          />
        </label>
        <label className="block">
          <span className="label">{pick(labels.quantity, lang)}</span>
          <input
            type="number"
            min={1}
            max={500}
            value={form.quantity}
            onChange={(event) => setForm({ ...form, quantity: event.target.value })}
            className="input"
            inputMode="numeric"
          />
        </label>
      </div>

      {!compact && (
        <label className="block">
          <span className="label">{pick(labels.message, lang)} *</span>
          <textarea
            required
            rows={4}
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
            className="input"
          />
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === 'sending'} className="btn-primary">
          {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {pick(labels.submit, lang)}
        </button>
        <p className="text-xs text-muted">
          {pick(
            {
              cs: 'Ozveme se do jednoho pracovního dne.',
              en: 'We will get back to you within one working day.',
              de: 'Wir melden uns innerhalb eines Werktags.',
            },
            lang,
          )}
        </p>
      </div>
      {state === 'error' && <p className="text-sm text-rust">{pick(labels.error, lang)}</p>}
    </form>
  );
}
