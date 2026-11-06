'use client';

/**
 * QvSection — quadratic voting on L5 grant rounds.
 *
 * Reads rounds from `/api/free-world/rounds`. For an open round a
 * signed-in ZIS user allocates integer votes per grant — each vote costs
 * votes² voice credits against the round's `credits_per_voter` budget.
 * The ballot is submitted through the same-origin proxy which binds
 * `voter_id` to the ZIS session server-side. QV results are advisory;
 * disbursement stays DAO-gated.
 */

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Lock, LogIn, Minus, Plus, Vote } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';
import { usePolling } from '@/hooks/usePolling';
import {
  FwApiError,
  fwApi,
  type FwResults,
  type FwRound,
  type FwRoundStatus,
} from '@/lib/freeworld-api';
import { formatZion } from './L5FundTracker';
import ZisAvatar from './ZisAvatar';

const LoginModal = dynamic(() => import('./LoginModal'), { ssr: false });

const copy = {
  roundsTitle: { cs: 'Kola kvadratického hlasování', en: 'Quadratic Voting Rounds' },
  intro: {
    cs: 'QV je poradní hlasování komunity o alokaci L5 fondu. Každý hlas stojí hlasů² kreditů — síla preference roste kvadraticky, takže široká shoda poráží jeden silný zájem. Výsledek doporučuje DAO; výplata zůstává pod DAO návrhem, timelockem a guardian multisig.',
    en: 'QV is the community advisory vote on L5 fund allocation. Each vote costs votes² credits — preference strength grows quadratically, so broad consensus beats a single strong interest. The outcome advises the DAO; disbursement remains gated by a DAO proposal, timelock and guardian multisig.',
  },
  credits: { cs: 'kreditů', en: 'credits' },
  pool: { cs: 'matching pool', en: 'matching pool' },
  ballots: { cs: 'hlasů', en: 'ballots' },
  status: {
    draft: { cs: 'Příprava', en: 'Draft' },
    open: { cs: 'Otevřené', en: 'Open' },
    tallying: { cs: 'Sčítání', en: 'Tallying' },
    closed: { cs: 'Uzavřené', en: 'Closed' },
  } satisfies Record<FwRoundStatus, { cs: string; en: string }>,
  empty: { cs: 'Zatím žádné kolo — první kolo se připravuje.', en: 'No rounds yet — the first round is being prepared.' },
  offline: { cs: 'Hlasování je momentálně nedostupné.', en: 'Voting is temporarily unavailable.' },
  requested: { cs: 'požadováno', en: 'requested' },
  cost: { cs: 'cena', en: 'cost' },
  votes: { cs: 'hlasy', en: 'votes' },
  spent: { cs: 'Využito', en: 'Spent' },
  remaining: { cs: 'Zbývá', en: 'Remaining' },
  submit: { cs: 'Odeslat hlasování', en: 'Cast ballot' },
  submitting: { cs: 'Odesílám…', en: 'Submitting…' },
  signIn: { cs: 'Přihlas se přes ZIS pro hlasování', en: 'Sign in with ZIS to vote' },
  success: { cs: 'Hlasování přijato — děkujeme za účast.', en: 'Ballot accepted — thank you for participating.' },
  errGeneric: { cs: 'Hlasování se nepodařilo odeslat.', en: 'The ballot could not be submitted.' },
  errBudget: { cs: 'Překročen rozpočet kreditů.', en: 'Credit budget exceeded.' },
  alreadyVoted: { cs: 'Hlasování přepsáno novým.', en: 'Previous ballot replaced.' },
  tallyingNote: { cs: 'Kolo se sčítá…', en: 'The round is being tallied…' },
  results: { cs: 'Výsledky', en: 'Results' },
  allocated: { cs: 'Alokováno', en: 'Allocated' },
  unallocated: { cs: 'Nerozděleno', en: 'Unallocated' },
  capped: { cs: 'cap', en: 'cap' },
  voters: { cs: 'hlasujících', en: 'voters' },
  yourBallot: { cs: 'Tvůj hlas', en: 'Your ballot' },
  noGrants: { cs: 'Kolo zatím nemá přiřazené granty.', en: 'This round has no grants assigned yet.' },
  openToVote: { cs: 'Hlasovat', en: 'Vote' },
  viewResults: { cs: 'Výsledky', en: 'Results' },
  loadingRound: { cs: 'Načítám kolo…', en: 'Loading round…' },
};

const ROUND_STATUS_CLS: Record<FwRoundStatus, string> = {
  draft: 'border-white/20 bg-white/5 text-gray-300',
  open: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  tallying: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  closed: 'border-white/20 bg-white/5 text-gray-400',
};

export default function QvSection() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { user, authenticated, loading: authLoading } = useAuth();

  const [rounds, setRounds] = useState<FwRound[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState<FwRound | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [results, setResults] = useState<FwResults | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [submitMsg, setSubmitMsg] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  const poll = useCallback(async () => {
    try {
      setRounds(await fwApi.rounds());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  usePolling(poll, 45_000);

  const openRound = useCallback(
    async (r: FwRound) => {
      setSelectedLoading(true);
      setSelected(null);
      setResults(null);
      setVotes({});
      setSubmitState('idle');
      setSubmitMsg('');
      try {
        const detail = await fwApi.round(r.id);
        setSelected(detail);
        // GET /rounds/:id embeds frozen results for closed rounds; only
        // hit the results endpoint as a fallback.
        if (detail.status === 'closed' && !detail.results) {
          try {
            detail.results = await fwApi.roundResults(r.id);
          } catch {
            /* results may not exist yet */
          }
        }
        setResults(detail.results ?? null);
      } catch {
        setOffline(true);
      } finally {
        setSelectedLoading(false);
      }
    },
    [],
  );

  const credits = selected?.credits_per_voter ?? 0;
  const spentCredits = useMemo(
    () => Object.values(votes).reduce((sum, v) => sum + v * v, 0),
    [votes],
  );
  const remaining = credits - spentCredits;

  const setGrantVotes = (grantId: string, v: number) =>
    setVotes((prev) => ({ ...prev, [grantId]: Math.max(0, v) }));

  const submit = async () => {
    if (!selected) return;
    if (!authenticated) {
      setShowLogin(true);
      return;
    }
    const entries = Object.entries(votes)
      .filter(([, v]) => v > 0)
      .map(([grant_id, v]) => ({ grant_id, votes: v }));
    if (entries.length === 0) return;
    setSubmitState('sending');
    try {
      await fwApi.castBallot(selected.id, entries);
      setSubmitState('ok');
      setSubmitMsg(tx5(copy.success, lang));
      void poll();
    } catch (e) {
      setSubmitState('error');
      if (e instanceof FwApiError && e.status === 401) {
        setSubmitMsg('');
        setShowLogin(true);
      } else if (e instanceof FwApiError && e.status === 400) {
        setSubmitMsg(tx5(copy.errBudget, lang));
      } else {
        setSubmitMsg(tx5(copy.errGeneric, lang));
      }
    }
  };

  if (offline && rounds === null) {
    return (
      <div className="zion-rainbow-sub p-5 text-sm text-gray-400" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
        {tx5(copy.offline, lang)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400 max-w-3xl">{tx5(copy.intro, lang)}</p>

      {/* ── Round list ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {!rounds ? (
          [0, 1].map((i) => (
            <div key={i} className="zion-rainbow-sub h-28 animate-pulse bg-white/[0.02]" style={{ '--rc': '252, 209, 22' } as React.CSSProperties} />
          ))
        ) : rounds.length === 0 ? (
          <p className="zion-rainbow-sub p-4 text-sm text-gray-500 md:col-span-2" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            {tx5(copy.empty, lang)}
          </p>
        ) : (
          rounds.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => void openRound(r)}
              className={`zion-rainbow-sub p-5 text-left transition-colors hover:bg-white/5 ${selected?.id === r.id ? 'ring-1 ring-zion-gold/50' : ''}`}
              style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-white">{r.title}</h4>
                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold border ${ROUND_STATUS_CLS[r.status]}`}>
                  {copy.status[r.status][cs ? 'cs' : 'en']}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>
                  {r.credits_per_voter.toLocaleString(cs ? 'cs-CZ' : t5('en-US', lang))} {tx5(copy.credits, lang)}
                </span>
                <span>
                  {formatZion(r.matching_pool_zion, cs)} ZION {tx5(copy.pool, lang)}
                </span>
                <span>
                  {r.ballot_count} {tx5(copy.ballots, lang)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedLoading && (
        <p className="text-sm text-gray-500 animate-pulse">{tx5(copy.loadingRound, lang)}</p>
      )}

      {/* ── Selected round ── */}
      {selected && (
        <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
          <div className="flex items-center gap-2 mb-4">
            <Vote className="h-5 w-5 text-zion-gold" />
            <h4 className="font-semibold text-white">{selected.title}</h4>
          </div>

          {!selected.grants || selected.grants.length === 0 ? (
            <p className="text-sm text-gray-500">{tx5(copy.noGrants, lang)}</p>
          ) : selected.status === 'open' ? (
            <>
              {/* Ballot editor */}
              <div className="space-y-2">
                {selected.grants.map((g) => {
                  const v = votes[g.id] ?? 0;
                  return (
                    <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{g.title}</p>
                        <p className="text-xs text-gray-500">
                          {g.category} · {formatZion(g.amount_zion, cs)} ZION {tx5(copy.requested, lang)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="-"
                          onClick={() => setGrantVotes(g.id, v - 1)}
                          disabled={v === 0}
                          className="h-8 w-8 rounded-lg border border-white/15 bg-white/5 text-white disabled:opacity-30 hover:bg-white/10 transition-colors"
                        >
                          <Minus className="h-4 w-4 mx-auto" />
                        </button>
                        <span className="w-8 text-center font-mono font-bold text-zion-gold">{v}</span>
                        <button
                          type="button"
                          aria-label="+"
                          onClick={() => setGrantVotes(g.id, v + 1)}
                          disabled={spentCredits + (2 * v + 1) > credits}
                          className="h-8 w-8 rounded-lg border border-white/15 bg-white/5 text-white disabled:opacity-30 hover:bg-white/10 transition-colors"
                        >
                          <Plus className="h-4 w-4 mx-auto" />
                        </button>
                        <span className="text-xs text-gray-500 w-20 text-right">
                          {tx5(copy.cost, lang)}: {v * v}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Credit meter */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>
                    {tx5(copy.spent, lang)}: {spentCredits} / {credits} {tx5(copy.credits, lang)}
                  </span>
                  <span>
                    {tx5(copy.remaining, lang)}: {remaining}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${remaining < 0 ? 'bg-red-400' : 'bg-gradient-to-r from-zion-gold to-emerald-400'}`}
                    style={{ width: `${Math.min(100, (spentCredits / Math.max(1, credits)) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {authenticated ? (
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={submitState === 'sending' || spentCredits === 0 || spentCredits > credits}
                    className="zion-button-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-40"
                  >
                    <Vote className="h-4 w-4" />
                    {submitState === 'sending' ? tx5(copy.submitting, lang) : tx5(copy.submit, lang)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowLogin(true)}
                    disabled={authLoading}
                    className="zion-button-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                  >
                    <LogIn className="h-4 w-4" />
                    {tx5(copy.signIn, lang)}
                  </button>
                )}
                {authenticated && user && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <ZisAvatar
                      seed={user.id}
                      src={user.avatar}
                      size={18}
                      className="rounded"
                      initial={(user.displayName ?? 'Z')[0]}
                    />
                    {user.displayName ?? user.primaryAddress.slice(0, 18) + '…'}
                  </span>
                )}
                {submitState === 'ok' && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> {submitMsg}
                  </span>
                )}
                {submitState === 'error' && submitMsg && (
                  <span className="text-sm text-red-300">{submitMsg}</span>
                )}
              </div>
            </>
          ) : selected.status === 'tallying' ? (
            <p className="text-sm text-gray-400">{tx5(copy.tallyingNote, lang)}</p>
          ) : selected.status === 'closed' && results ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                <span>
                  {tx5(copy.results, lang)}: {results.ballots} {tx5(copy.ballots, lang)} · {results.total_votes} {tx5(copy.votes, lang)}
                </span>
                <span>
                  {tx5(copy.allocated, lang)}: {formatZion(results.allocated_zion, cs)} ZION · {tx5(copy.unallocated, lang)}: {formatZion(results.unallocated_zion, cs)} ZION
                </span>
              </div>
              {results.grants.map((g) => {
                const maxAlloc = Math.max(...results.grants.map((x) => x.allocated_zion), 1);
                const pct = (g.allocated_zion / maxAlloc) * 100;
                const title = selected.grants?.find((x) => x.id === g.grant_id)?.title ?? g.grant_id;
                return (
                  <div key={g.grant_id}>
                    <div className="flex items-center justify-between gap-2 text-sm mb-1">
                      <span className="text-white truncate">{title}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {g.votes} {tx5(copy.votes, lang)} · {g.voters} {tx5(copy.voters, lang)} ·{' '}
                        {formatZion(g.allocated_zion, cs)} ZION
                        {g.capped ? ` (${tx5(copy.capped, lang)})` : ''}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-zion-purple to-zion-gold" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {selected.status === 'draft'
                ? tx5(copy.status.draft, lang)
                : copy.status[selected.status][cs ? 'cs' : 'en']}
            </p>
          )}
        </div>
      )}

      {showLogin && <LoginModal open onClose={() => setShowLogin(false)} />}
    </div>
  );
}
