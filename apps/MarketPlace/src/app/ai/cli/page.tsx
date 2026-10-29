'use client';

import { Suspense, useCallback, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Loader2, Terminal } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

const INSTALL = `curl -fsSL https://market.zionterranova.com/install-hiran.sh | bash
zion-hiran`;

const MENU = [
  ['1', { cs: 'Chat', en: 'Chat' }],
  ['2', { cs: 'Login — tento kód', en: 'Login — this code' }],
  ['3', { cs: 'Account', en: 'Account' }],
  ['4', { cs: 'Models', en: 'Models' }],
  ['5', { cs: 'Coding agent', en: 'Coding agent' }],
  ['6', { cs: 'Subscribe', en: 'Subscribe' }],
  ['7', { cs: 'Session', en: 'Session' }],
  ['8', { cs: 'Help', en: 'Help' }],
  ['9', { cs: 'FAQ', en: 'FAQ' }],
  ['10', { cs: 'Vysvětlivky', en: 'Glossary' }],
] as const;

const FAQ: { q: { cs: string; en: string }; a: { cs: string; en: string } }[] = [
  {
    q: { cs: 'Co je Zion Hiran?', en: 'What is Zion Hiran?' },
    a: {
      cs: 'Veřejný terminálový klient Hiranyagarbhy. Chatuje s evropskou bránou. Operátorský příkaz zion je jiný, větší nástroj.',
      en: 'The public terminal client for Hiranyagarbha. It chats with the EU gateway. The operator command zion is a different, larger tool.',
    },
  },
  {
    q: { cs: 'Kam se ukládá klíč a proč se netiskne?', en: 'Where is the API key, and why is it never printed?' },
    a: {
      cs: 'Do ~/.zion/agent.toml (práva 600). Klient napíše jen „signed in“ a klíč nevypíše.',
      en: '~/.zion/agent.toml, mode 600. The CLI says “signed in” and does not echo the key.',
    },
  },
  {
    q: { cs: 'Proč login otevírá prohlížeč?', en: 'Why does login open a browser?' },
    a: {
      cs: 'Krátký kód schválíte na této stránce. Klíč se uloží, až se vrátíte do terminálu.',
      en: 'You approve a short device code on this page. The key is saved when you return to the terminal.',
    },
  },
  {
    q: { cs: 'Chat, nebo coding agent?', en: 'Chat or Coding agent?' },
    a: {
      cs: 'Chat jen mluví. Coding agent (menu 5, /agent) smí číst a upravovat soubory v aktuální složce a před zápisem nebo příkazem se zeptá.',
      en: 'Chat only talks. Coding agent (menu 5, /agent) may read and edit files in the current directory, and it asks before a write or a shell command.',
    },
  },
  {
    q: { cs: 'Proč nejde vybrat model?', en: 'Why can’t I select a model?' },
    a: {
      cs: 'Offline a mockup se vypíšou, aktivní smí být jen live model. Obvyklá volba je hiran-mini.',
      en: 'Offline and mockup models are listed, but only a live model can be active. hiran-mini is the usual choice.',
    },
  },
  {
    q: { cs: 'Co je denní limit?', en: 'What is the daily limit?' },
    a: {
      cs: 'Každý plán má strop tokenů. Menu 3 Account (/usage) ukáže dnešní spotřebu a zbytek. Odpověď 429 znamená, že strop došel.',
      en: 'Each plan has a token cap. Menu 3 Account (/usage) shows used today and what is left. A 429 means the cap was hit.',
    },
  },
  {
    q: { cs: 'Zapíše agent soubor bez ptaní?', en: 'Will the agent write without asking?' },
    a: {
      cs: 'Ne. Čtení proběhne samo. Náhrada textu a shell čekají na y/N. Cesty mimo složku, .env, klíče a roury jsou odmítnuté.',
      en: 'No. read_file runs. str_replace and run_shell wait for y/N. Paths outside the directory, .env, keys, and pipes are refused.',
    },
  },
  {
    q: { cs: 'Kde je historie a jak ji smažu?', en: 'Where is the conversation, and how do I delete it?' },
    a: {
      cs: '~/.zion/hiran/session.json. Menu 7 Session, pak c, nebo /clear.',
      en: '~/.zion/hiran/session.json. Menu 7 Session, then c, or /clear.',
    },
  },
];

const GLOSSARY: { term: { cs: string; en: string }; def: { cs: string; en: string } }[] = [
  { term: { cs: 'Chat', en: 'Chat' }, def: { cs: 'rozhovor bez úprav souborů', en: 'a conversation with no file tools' } },
  { term: { cs: 'Login', en: 'Login' }, def: { cs: 'schválení v prohlížeči, které uloží API klíč', en: 'browser approval that stores the API key' } },
  { term: { cs: 'Account', en: 'Account' }, def: { cs: 'plán, dnešní tokeny a zbytek limitu', en: 'plan, tokens used today, what is left' } },
  { term: { cs: 'Model', en: 'Model' }, def: { cs: 'který alias odpovídá (výchozí hiran-mini)', en: 'which alias answers (default hiran-mini)' } },
  { term: { cs: 'live', en: 'live' }, def: { cs: 'model teď umí odpovědět', en: 'the model can answer right now' } },
  { term: { cs: 'offline', en: 'offline' }, def: { cs: 'je v seznamu, chat nepřijímá', en: 'listed, but not accepting chats' } },
  { term: { cs: 'mockup', en: 'mockup' }, def: { cs: 'náhled jména, ještě to není model', en: 'a preview name, not a real model yet' } },
  { term: { cs: 'Coding agent', en: 'Coding agent' }, def: { cs: 'chat plus čtení, náhrada a omezený shell', en: 'chat plus read, replace, and an allowlisted shell' } },
  { term: { cs: 'Subscribe', en: 'Subscribe' }, def: { cs: 'otevře Free / Pro / Team na stránce /ai', en: 'opens Free / Pro / Team on the /ai page' } },
  { term: { cs: 'Session', en: 'Session' }, def: { cs: 'uložený přepis tohoto CLI', en: 'the saved transcript for this CLI' } },
  { term: { cs: 'API klíč', en: 'API key' }, def: { cs: 'tajemství v ~/.zion/agent.toml, nikdy se netiskne', en: 'secret in ~/.zion/agent.toml, never printed' } },
  { term: { cs: 'flowers', en: 'flowers' }, def: { cs: '1 ZION = 1 000 000 flowers', en: '1 ZION = 1 000 000 flowers' } },
  { term: { cs: 'plán', en: 'plan' }, def: { cs: 'Free, Pro nebo Team — limit v Account', en: 'Free, Pro, or Team — the limit on Account' } },
];

const T = {
  title: { cs: 'Přihlášení Hiran CLI', en: 'Hiran CLI sign-in' },
  subtitle: {
    cs: 'V terminálu spusťte zion-hiran a zvolte 2 Login (nebo /login). Kód schvalte tady a vraťte se do CLI.',
    en: 'In the terminal run zion-hiran and choose 2 Login (or /login). Approve the code here, then return to the CLI.',
  },
  installTitle: { cs: 'Instalace', en: 'Install' },
  menuTitle: { cs: 'Menu v terminálu', en: 'Terminal menu' },
  faqTitle: { cs: 'Časté otázky', en: 'FAQ' },
  glossaryTitle: { cs: 'Vysvětlivky', en: 'Glossary' },
  codeLabel: { cs: 'Kód zařízení', en: 'Device code' },
  approve: { cs: 'Schválit CLI', en: 'Approve CLI' },
  signIn: {
    cs: 'Nejdřív se přihlaste (Sign In / MetaMask v navigaci).',
    en: 'Sign in first (Sign In / MetaMask in the navigation).',
  },
  done: {
    cs: 'Hotovo — vraťte se do terminálu. Klíč se stáhne automaticky.',
    en: 'Done — return to your terminal. The key will download automatically.',
  },
  back: { cs: 'Zpět na /ai', en: 'Back to /ai' },
};

function CliApproveInner() {
  const { lang: l } = useLang();
  const { authenticated, loading: authLoading } = useAuth();
  const params = useSearchParams();
  const initial = useMemo(
    () => (params.get('code') ?? '').trim().toUpperCase(),
    [params],
  );
  const [code, setCode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const approve = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/hiran/cli/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_code: code.trim().toUpperCase() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  }, [code]);

  return (
    <div className="rasta-info-page">
      <section className="rasta-hero" aria-label="Hiran CLI">
        <div className="rasta-hero-inner">
          <div className="rasta-hero-kicker">
            <span className="dot" />
            <Terminal className="w-3.5 h-3.5" /> CLI
          </div>
          <h1 className="rasta-hero-title">{T.title[l]}</h1>
          <p className="rasta-hero-desc mx-auto max-w-2xl">{T.subtitle[l]}</p>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto max-w-lg space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rasta-gold">
              {T.installTitle[l]}
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-black/60 p-3 text-xs text-amber-200">{INSTALL}</pre>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              {T.menuTitle[l]}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-300">
              {MENU.map(([n, label]) => (
                <li key={n} className="flex gap-3">
                  <span className="w-6 font-mono text-rasta-gold">{n}</span>
                  <span>{label[l]}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              {T.faqTitle[l]}
            </p>
            <dl className="mt-3 space-y-3">
              {FAQ.map((item) => (
                <div key={item.q.en}>
                  <dt className="text-sm font-semibold text-white">{item.q[l]}</dt>
                  <dd className="mt-1 text-sm text-gray-400">{item.a[l]}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
              {T.glossaryTitle[l]}
            </p>
            <dl className="mt-3 space-y-2">
              {GLOSSARY.map((item) => (
                <div key={item.term.en} className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
                  <dt className="font-mono text-rasta-gold">{item.term[l]}</dt>
                  <dd className="text-gray-400">{item.def[l]}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="zion-rainbow-card p-6" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          {!authLoading && !authenticated && (
            <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {T.signIn[l]}
            </p>
          )}

          <label className="block text-sm font-semibold text-gray-300 mb-2">{T.codeLabel[l]}</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-1234"
            className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-center font-mono text-xl tracking-[0.3em] text-white focus:border-rasta-gold/40 focus:outline-none"
            disabled={ok}
          />

          <button
            type="button"
            onClick={approve}
            disabled={!authenticated || busy || ok || code.trim().length < 4}
            className="zion-button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin inline-block" />
            ) : (
              T.approve[l]
            )}
          </button>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {ok && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <Check className="w-4 h-4 shrink-0" /> {T.done[l]}
            </p>
          )}

          <p className="mt-8 text-sm text-gray-500">
            <Link href="/ai" className="underline hover:text-gray-300">
              {T.back[l]}
            </Link>
          </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AiCliPage() {
  return (
    <Suspense
      fallback={
        <div className="rasta-info-page p-10 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      }
    >
      <CliApproveInner />
    </Suspense>
  );
}
