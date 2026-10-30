'use client';

import { Clover } from 'lucide-react';
import { fmtAgo, fmtInt } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import type { BlockRow, CoinStats } from '@/lib/types';

/** Compact interval label — seconds-granularity sibling of fmtDuration
 *  (block cadence here is typically seconds-to-minutes). */
function fmtInterval(s: number): string {
  const v = Math.round(s);
  if (v >= 86_400) return `${Math.floor(v / 86_400)}d ${Math.floor((v % 86_400) / 3_600)}h`;
  if (v >= 3_600) return `${Math.floor(v / 3_600)}h ${Math.floor((v % 3_600) / 60)}m`;
  if (v >= 60) return `${Math.floor(v / 60)}m ${v % 60}s`;
  return `${v}s`;
}

/** Expected share count for a block — same model the backend uses for
 *  luck_pct: expected = network_difficulty / share_difficulty. Taken from
 *  the most recent block row, with served-difficulty fallback. */
function expectedShares(blocks: BlockRow[], stats: CoinStats | null): number | null {
  const b = blocks.find((x) => x.network_difficulty != null && x.share_difficulty != null);
  if (b?.network_difficulty != null && b.share_difficulty != null && b.share_difficulty > 0)
    return b.network_difficulty / b.share_difficulty;
  if (stats?.network_difficulty != null && b?.share_difficulty != null && b.share_difficulty > 0)
    return stats.network_difficulty / b.share_difficulty;
  return null;
}

function effortTone(effort: number): { text: string; bar: string; hint: { cs: string; en: string } } {
  if (effort >= 200)
    return {
      text: 'text-rasta-red',
      bar: 'from-rasta-red/70 to-rasta-red',
      hint: { cs: 'těžká smůla — dlouhá série', en: 'heavy dry streak' },
    };
  if (effort >= 100)
    return {
      text: 'text-rasta-gold',
      bar: 'from-rasta-gold/70 to-rasta-gold',
      hint: { cs: 'nad očekáváním — smůla', en: 'over expectation — unlucky' },
    };
  return {
    text: 'text-rasta-green',
    bar: 'from-rasta-green/60 to-rasta-green',
    hint: { cs: 'pod očekáváním — ve formě', en: 'under expectation — on pace' },
  };
}

function luckTone(luck: number): string {
  return luck >= 100 ? 'text-rasta-green' : 'text-rasta-gold';
}

/**
 * Pool luck & current-effort strip — HeroMiners-class block-luck telemetry.
 * Effort = shares submitted since the last block / statistically expected
 * shares for one block. >100 % means the round is overdue (unlucky streak).
 */
export default function LuckEffortCard({
  stats,
  blocks,
  maxBars = 30,
  showStrip = true,
}: {
  stats: CoinStats | null;
  blocks: BlockRow[];
  maxBars?: number;
  /** /blocks has its own full-width luck trend — strip is redundant there. */
  showStrip?: boolean;
}) {
  const { t, lang } = useLang();
  const exp = expectedShares(blocks, stats);
  const sinceLast = stats?.shares_since_last_block ?? null;
  const effort = exp != null && exp > 0 && sinceLast != null ? (sinceLast / exp) * 100 : null;
  const et = effort != null ? effortTone(effort) : null;

  // Avg luck — rolling backend aggregates win; 20-block client avg is the fallback.
  const withLuck = blocks.filter((b) => b.luck_pct != null).slice(0, 20);
  const clientAvg = withLuck.length
    ? withLuck.reduce((a, b) => a + (b.luck_pct ?? 0), 0) / withLuck.length
    : null;
  const avgLuck = stats?.luck_100 ?? clientAvg;
  const avgLuckLabel =
    stats?.luck_100 != null ? t('prům. luck · 100 bloků', 'avg luck · 100 blocks') : t('prům. luck · 20 bloků', 'avg luck · 20 blocks');

  // Average block cadence over the recent window.
  const timed = blocks.slice(0, 20).map((b) => b.ts).filter((x) => x > 0);
  const cadence =
    timed.length >= 2 ? (timed[0] - timed[timed.length - 1]) / (timed.length - 1) : null;

  const strip = blocks.filter((b) => b.luck_pct != null).slice(0, maxBars);
  const stripMax = Math.max(...strip.map((b) => b.luck_pct ?? 0), 200);

  if (effort == null && avgLuck == null && strip.length === 0) return null;

  return (
    <div className="pool-card card-glow mt-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/70">
          <Clover size={14} className="text-rasta-green" />
          {t('Pool luck & aktuální úsilí', 'Pool luck & current effort')}
        </h3>
        <span className="text-[0.62rem] text-white/35">
          {t('effort >100 % = smůla · luck >100 % = štěstí', 'effort >100% = unlucky · luck >100% = lucky')}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
        {/* Current effort gauge */}
        <div>
          <p className="kicker">{t('aktuální úsilí (effort)', 'current effort')}</p>
          <p className={`stat-value mt-1 text-2xl font-black ${et?.text ?? 'text-white/40'}`}>
            {effort != null ? `${effort.toFixed(1)}%` : '—'}
          </p>
          {effort != null && (
            <>
              <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full bg-gradient-to-r transition-all ${et!.bar}`}
                  style={{ width: `${Math.min(100, effort / 2)}%` }}
                />
                {/* 100% = expected mark (rendered at 50% of the 0–200% gauge) */}
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
              </div>
              <p className="mt-1.5 text-[0.65rem] text-white/40">
                {fmtInt(sinceLast!)} {t('shares od posledního bloku', 'shares since last block')}
                {exp != null && ` · ${t('očekáváno', 'expected')} ≈ ${fmtInt(Math.round(exp))}`}
                {' · '}
                <span className={et!.text}>{t(et!.hint.cs, et!.hint.en)}</span>
              </p>
            </>
          )}
        </div>

        {/* Rolling averages */}
        <div>
          <p className="kicker">{avgLuckLabel}</p>
          <p className={`stat-value mt-1 text-2xl font-black ${avgLuck != null ? luckTone(avgLuck) : 'text-white/40'}`}>
            {avgLuck != null ? `${avgLuck.toFixed(0)}%` : '—'}
          </p>
          {stats?.luck_500 != null && (
            <p className="mt-1.5 text-[0.65rem] text-white/40">
              {t('dlouhodobý · 500', 'long-term · 500')}{' '}
              <span className={luckTone(stats.luck_500)}>{stats.luck_500.toFixed(0)}%</span>
            </p>
          )}
        </div>

        {/* Cadence */}
        <div>
          <p className="kicker">{t('kadence bloků', 'block cadence')}</p>
          <p className="stat-value mt-1 text-2xl font-black text-white">
            {cadence != null ? `~${fmtInterval(cadence)}` : '—'}
          </p>
          <p className="mt-1.5 text-[0.65rem] text-white/40">
            {t('průměrný interval · posledních', 'avg interval · last')} {Math.min(timed.length, 20)} {t('bloků', 'blocks')}
          </p>
        </div>

        {/* Blocks found */}
        <div>
          <p className="kicker">{t('celkem nalezeno', 'total found')}</p>
          <p className="stat-value mt-1 text-2xl font-black text-white">
            {stats?.blocks_found != null ? fmtInt(stats.blocks_found) : fmtInt(blocks.length)}
          </p>
          <p className="mt-1.5 text-[0.65rem] text-white/40">
            {t('bloků v historii poolu', 'blocks in pool history')}
          </p>
        </div>
      </div>

      {/* Recent-luck strip */}
      {showStrip && strip.length >= 3 && (
        <div className="mt-5">
          <p className="kicker mb-2">
            {t('luck posledních bloků', 'recent block luck')} · {strip.length}
          </p>
          <div className="relative flex h-12 items-end gap-[2px]">
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/20"
              style={{ bottom: `${(100 / stripMax) * 100}%` }}
            />
            {[...strip].reverse().map((b, i) => {
              const l = b.luck_pct ?? 0;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t-[2px] transition-opacity hover:opacity-80 ${
                    l >= 100
                      ? 'bg-gradient-to-t from-rasta-green/30 to-rasta-green/80'
                      : 'bg-gradient-to-t from-rasta-red/25 to-rasta-red/70'
                  }`}
                  style={{ height: `${Math.max(4, (l / stripMax) * 100)}%` }}
                  title={`#${fmtInt(b.height)}: ${Math.round(l)}% — ${fmtAgo(b.ts, lang)}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
