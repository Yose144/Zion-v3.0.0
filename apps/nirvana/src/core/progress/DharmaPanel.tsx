'use client';

/**
 * CESTA — XP a dharma na jednom místě.
 *
 * Otevírá se klikem na ★ v herní liště. Proč samostatné okno a ne další
 * číslo v liště: hráč má vidět **jak roste** (XP k dalšímu levelu) a **proč**
 * (pět pilířů posledního běhu). Kdyby to byla jen ikona, zůstalo by
 * z progrese číslo bez vysvětlení.
 */

import { useEffect } from 'react';
import { useI18n, tx } from '@/core/i18n';
import type { ParkProfile } from '@/core/park/profile';
import { DHARMA_PILLARS } from './dharma';
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
  const progress = xpProgress(xp);
  const seals = profile?.dharma.seals ?? 0;
  const validations = profile?.dharma.validations ?? 0;
  const last = profile?.dharma.last ?? null;

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
            <span>{cs ? 'zkušenosti a dharma' : 'experience and dharma'}</span>
          </div>
          <div className="boards-actions">
            <button type="button" className="boards-close" onClick={onClose} aria-label={cs ? 'Zavřít' : 'Close'}>
              ×
            </button>
          </div>
        </header>

        <section className="path-level">
          <div className="path-level-badge">
            <em aria-hidden>★</em>
            <strong>{progress.level}</strong>
            <span>{cs ? 'level' : 'level'}</span>
          </div>
          <div className="path-level-body">
            <div className="path-bar" aria-hidden>
              <i style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
            </div>
            <p>
              <strong>{xp}</strong> XP
              <span>
                {' · '}
                {cs
                  ? `do dalšího ${progress.remaining}`
                  : `${progress.remaining} to next`}
              </span>
            </p>
            <p className="path-level-note">
              {cs
                ? 'XP roste z výkonu (skóre proti cíli světa), z dokončení, z rekordu a z dharma pečeti.'
                : 'XP grows from performance (score against the world target), completion, records and the dharma seal.'}
            </p>
          </div>
        </section>

        <section className="path-dharma">
          <header>
            <strong>{cs ? 'Dharma validátor' : 'Dharma validator'}</strong>
            <span>
              {seals} {cs ? 'pečetí' : 'seals'} · {validations} {cs ? 'validací' : 'validations'}
            </span>
          </header>

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
      </div>
    </div>
  );
}
