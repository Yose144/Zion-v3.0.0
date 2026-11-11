'use client';

/**
 * CESTA — XP, Consciousness Level, NCL kurikulum a dharma na jednom místě.
 *
 * Otevírá se klikem na ★ v herní liště. Pořadí bloků je záměrné: **kde jsi**
 * (CL), **co jsi prošel** (NCL úlohy), **jak hraješ** (dharma pilíře)
 * a **co je připravené** (questy pro OASIS). Kdyby to byla jen ikona,
 * zůstalo by z progrese číslo bez vysvětlení.
 */

import { useEffect } from 'react';
import { useI18n, tx } from '@/core/i18n';
import type { ParkProfile } from '@/core/park/profile';
import { dailyDharmaGoal } from '@/core/park/challenge';
import { GAME_TITLES } from './boards';
import { DHARMA_PILLARS } from './dharma';
import { clProgress } from './consciousness';
import { nclState } from './ncl';
import { preparedQuests } from './quests';
import { xpProgress } from './xp';

const GRADE_LABEL: Record<string, { cs: string; en: string; es: string }> = {
  seal: { cs: 'pečeť', en: 'seal', es: 'sello' },
  pass: { cs: 'prošlo', en: 'passed', es: 'aprobado' },
  partial: { cs: 'částečné', en: 'partial', es: 'parcial' },
  thin: { cs: 'neúplné', en: 'incomplete', es: 'incompleto' },
};

export function DharmaPanel({ profile, onClose }: { profile: ParkProfile | null; onClose: () => void }) {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const xp = profile?.xp ?? 0;
  const level = xpProgress(xp);
  const cl = clProgress(xp);
  const seals = profile?.dharma.seals ?? 0;
  const validations = profile?.dharma.validations ?? 0;
  const last = profile?.dharma.last ?? null;
  const goal = dailyDharmaGoal();
  const goalDone = profile?.dharmaGoalDay === goal.day;
  const goalGame = tx(GAME_TITLES[goal.game], lang);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // NCL potřebuje profil; prázdný profil znamená „nic splněno"
  const ncl = nclState(profile ?? EMPTY_PROFILE);

  return (
    <div
      className="boards-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={cs ? 'Cesta' : 'The Path'}
      onClick={onClose}
    >
      <div className="boards-panel path-panel" onClick={(event) => event.stopPropagation()}>
        <header className="boards-head">
          <div>
            <strong>{cs ? 'Cesta' : 'The Path'}</strong>
            <span>{cs ? 'zkušenosti · vědomí · dharma' : 'experience · consciousness · dharma'}</span>
          </div>
          <div className="boards-actions">
            <button type="button" className="boards-close" onClick={onClose} aria-label={cs ? 'Zavřít' : 'Close'}>
              ×
            </button>
          </div>
        </header>

        {/* ── CL: kanonická škála z consciousness.rs ─────────────────── */}
        <section className="path-level">
          <div className="path-level-badge">
            <em aria-hidden>◎</em>
            <strong>L{cl.level}</strong>
            <span>{cl.name}</span>
          </div>
          <div className="path-level-body">
            <p className="path-cl-note">{tx(cl.note, lang)}</p>
            <div className="path-bar" aria-hidden>
              <i style={{ width: `${Math.round(cl.ratio * 100)}%` }} />
            </div>
            <p>
              <strong>{xp}</strong> XP
              <span>
                {' · '}
                {cl.level >= 6
                  ? cs
                    ? 'nejvyšší stupeň'
                    : 'the highest level'
                  : cs
                    ? `do dalšího stupně ${cl.remaining}`
                    : `${cl.remaining} to the next level`}
              </span>
            </p>
            <p className="path-level-note">
              {cs
                ? `Stupně vědomí L0–L6 jsou z kódu (ConsciousnessLevel). Každý stupeň násobí XP o ${Math.round(
                    cl.bonus * 100,
                  )} % · úroveň ${level.level}.`
                : `Consciousness levels L0–L6 come from the code (ConsciousnessLevel). Each level multiplies XP by ${Math.round(
                    cl.bonus * 100,
                  )} % · level ${level.level}.`}
            </p>
          </div>
        </section>

        {/* ── NCL kurikulum ─────────────────────────────────────────── */}
        <section className="path-ncl">
          <header>
            <strong>{cs ? 'NCL úlohy' : 'NCL tasks'}</strong>
            <span>
              {ncl.done.length}/{ncl.tasks.length} · {cs ? 'skóre' : 'score'} {ncl.score}
            </span>
          </header>
          <ol className="path-ncl-list">
            {ncl.tasks.map((entry) => (
              <li
                key={entry.task.id}
                className={entry.done ? 'is-done' : entry.task.id === ncl.next?.id ? 'is-next' : 'is-open'}
              >
                <em aria-hidden>{entry.done ? '✓' : entry.task.type === 'custom' ? '◇' : '◈'}</em>
                <div>
                  <strong>{tx(entry.task.title, lang)}</strong>
                  <span>{tx(entry.task.detail, lang)}</span>
                  {!entry.done && entry.progress > 0 && (
                    <i className="path-ncl-bar" aria-hidden>
                      <b style={{ width: `${Math.round(entry.progress * 100)}%` }} />
                    </i>
                  )}
                </div>
                <small>
                  {entry.done ? `+${entry.task.xp} XP` : `${Math.min(entry.current, entry.target)}/${entry.target}`}
                </small>
              </li>
            ))}
          </ol>
          <p className="path-note">
            {cs
              ? 'Typy úloh (llm_inference, embeddings, code_analysis…) jsou taxonomie NCL z kódu; tady je to kurikulum, ne výpočet.'
              : 'Task types (llm_inference, embeddings, code_analysis…) are the NCL taxonomy from the code; here it is a curriculum, not compute.'}
          </p>
        </section>

        {/* ── dharma ────────────────────────────────────────────────── */}
        <section className="path-dharma">
          <header>
            <strong>{cs ? 'Dharma validátor' : 'Dharma validator'}</strong>
            <span>
              {seals} {cs ? 'pečetí' : 'seals'} · {validations} {cs ? 'validací' : 'validations'}
            </span>
          </header>

          <p className={`path-goal${goalDone ? ' is-done' : ''}`}>
            <span aria-hidden>{goalDone ? '✓' : '☸'}</span>
            {goalDone
              ? cs
                ? `Dnešní dharma cíl splněn — pečeť v ${goalGame}.`
                : `Today's dharma goal is done — a seal in ${goalGame}.`
              : cs
                ? `Dnešní cíl: pečeť v ${goalGame} (+${goal.reward} žetony).`
                : `Today's goal: a seal in ${goalGame} (+${goal.reward} tokens).`}
          </p>

          {last ? (
            <p className={`path-verdict is-${last.grade}`}>
              <span>{tx(GRADE_LABEL[last.grade], lang)}</span>
              <em>{last.score}/100</em>
            </p>
          ) : (
            <p className="path-verdict is-none">
              {cs
                ? 'Zatím žádná validace — dohraj hru a Cesta se naplní.'
                : 'No validation yet — finish a run and the Path fills in.'}
            </p>
          )}

          <ol className="path-pillars">
            {DHARMA_PILLARS.map((pillar) => {
              const result = last?.pillars.find((item) => item.id === pillar.id) ?? null;
              return (
                <li
                  key={pillar.id}
                  className={result ? (result.passed ? 'is-pass' : 'is-fail') : 'is-unknown'}
                >
                  <span className="path-pillar-dot" aria-hidden />
                  <div>
                    <strong>{tx(pillar.name, lang)}</strong>
                    <span>{tx(pillar.question, lang)}</span>
                  </div>
                  <em aria-hidden>{result ? (result.passed ? '✓' : '·') : '–'}</em>
                </li>
              );
            })}
          </ol>

          <p className="path-note">
            {cs
              ? 'Pilíře nic neodečítají — jen násobí XP (0–50 %) a dávají pečeť. Skóre ani žetony se nemění.'
              : 'The pillars never subtract — they only multiply XP (0–50 %) and grant a seal. Score and tokens stay untouched.'}
          </p>
        </section>

        {/* ── questy: připravené pro OASIS ──────────────────────────── */}
        <section className="path-quests">
          <header>
            <strong>{cs ? 'Questy' : 'Quests'}</strong>
            <span>{cs ? 'připraveno pro OASIS' : 'prepared for OASIS'}</span>
          </header>
          <ul>
            {preparedQuests().map((quest) => (
              <li key={quest.id} className={cl.level >= quest.cl ? 'is-open' : 'is-locked'}>
                <span aria-hidden>{cl.level >= quest.cl ? '◇' : '🔒'}</span>
                <div>
                  <strong>{tx(quest.title, lang)}</strong>
                  <span>{tx(quest.note, lang)}</span>
                </div>
                <small>L{quest.cl}</small>
              </li>
            ))}
          </ul>
          <p className="path-note">
            {cs
              ? 'Kroky questů jsou stejná data jako NCL úlohy — až se OASIS otevře, nemusí se nic přepisovat.'
              : 'Quest steps are the same data as NCL tasks — when OASIS opens, nothing has to be rewritten.'}
          </p>
        </section>
      </div>
    </div>
  );
}

/** Prázdný profil pro výpočet NCL, když se ještě nic nenačetlo. */
const EMPTY_PROFILE = {
  tokens: 0,
  best: {},
  runs: 0,
  day: null,
  tickets: 0,
  challengeDay: null,
  rideDay: null,
  xp: 0,
  dharma: { seals: 0, validations: 0, last: null },
  plays: {},
  completions: 0,
  gifts: 0,
  nclDone: [],
  dharmaGoalDay: null,
} as unknown as ParkProfile;
