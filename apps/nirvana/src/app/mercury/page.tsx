'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { useI18n } from '@/core/i18n';
import { MercurySolo, type DuelStats } from '@/core/fight/MercurySolo';
import { MercuryDuel, type DuelMpStats } from '@/core/fight/MercuryDuel';
import { MAX_HP, type BotDifficulty } from '@/core/fight/duel';
import { awardRun, grantTokens, loadProfile, saveProfile } from '@/core/park/profile';
import { CHALLENGE_REWARD, claimChallenge } from '@/core/park/challenge';
import { unlock } from '@/core/audio/engine';
import { useNet } from '@/core/net/useNet';

/**
 * MERKUR — souboj bok po boku. Sólo cvičení proti botovi i online duel
 * (best of 3). Skóre z online zápasu jde do stejné tabule jako aréna/závod.
 */

type Phase = 'idle' | 'playing';
type Mode = 'solo' | 'online';

const EMPTY_SOLO: DuelStats = {
  round: 1,
  phase: 'countdown',
  timer: 60,
  countdown: 3,
  selfHp: MAX_HP,
  foeHp: MAX_HP,
  selfWins: 0,
  foeWins: 0,
  winner: null,
};

const EMPTY_MP: DuelMpStats = {
  connected: false,
  ping: null,
  round: 1,
  state: null,
  countdown: 0,
  secondsLeft: 0,
  selfId: '',
  selfName: '…',
  foeName: '…',
  selfHp: MAX_HP,
  foeHp: MAX_HP,
  selfWins: 0,
  foeWins: 0,
  foeIsBot: true,
  matchWinner: null,
  lastRoundReason: null,
};

/** Body za výhru: 2:0 = 200, 2:1 = 170; prohra počítá body taky (100×vyhraná_kola − 30×soupeřova). */
function duelScore(selfWins: number, foeWins: number): number {
  return selfWins * 100 - foeWins * 30;
}

function TouchButton({
  code,
  label,
  ariaLabel = label,
}: {
  code: string;
  label: string;
  ariaLabel?: string;
}) {
  // syntetické klávesové události → `useFightKeys` má jeden vstupní tok
  const send = useCallback(
    (down: boolean) => {
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
    },
    [code],
  );
  return (
    <button
      type="button"
      className="duel-touch-btn"
      onPointerDown={(event) => {
        event.preventDefault();
        send(true);
      }}
      onPointerUp={() => send(false)}
      onPointerLeave={() => send(false)}
      onPointerCancel={() => send(false)}
      onLostPointerCapture={() => send(false)}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {label}
    </button>
  );
}

export default function MercuryPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const { you } = useNet();
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('solo');
  const [difficulty, setDifficulty] = useState<BotDifficulty>('standard');
  const [soloStats, setSoloStats] = useState<DuelStats>(EMPTY_SOLO);
  const [mpStats, setMpStats] = useState<DuelMpStats>(EMPTY_MP);
  const [notice, setNotice] = useState<string | null>(null);
  const recorded = useRef(false);
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    setCoarse(query.matches);
    const onChange = () => setCoarse(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // během duelu na mobilu schovej navigaci a chat (celá obrazovka pro hru)
  useEffect(() => {
    if (!coarse) return;
    document.body.dataset.playing = phase === 'playing' ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [coarse, phase]);

  // výsledek online duelu — zapíše se NA JEDNOU po `duel_end`, příští zápas resetuje guard
  useEffect(() => {
    if (mode !== 'online' || phase !== 'playing') return;
    if (mpStats.matchWinner === null) {
      recorded.current = false;
      return;
    }
    if (recorded.current) return;
    recorded.current = true;

    const won = mpStats.matchWinner === mpStats.selfId;
    const score = duelScore(mpStats.selfWins, mpStats.foeWins);
    if (score <= 0 || mpStats.foeIsBot) {
      setNotice(
        mpStats.foeIsBot
          ? cs ? 'soupeř byl bot — zápas se nepočítá do tabule' : 'opponent was a bot — not ranked'
          : cs ? 'duel skončil bez bodů' : 'duel ended without points',
      );
      return;
    }

    const nickname = (() => {
      try {
        return window.localStorage.getItem('nirvana.park.name') ?? (you?.name || 'hrac');
      } catch {
        return you?.name || 'hrac';
      }
    })();
    const profile = loadProfile();
    const awarded = awardRun(profile, 'fight', score);
    const withBonus = won ? grantTokens(awarded.profile, 2) : awarded.profile;
    const challenge = claimChallenge(withBonus, 'fight', score);
    saveProfile(challenge.profile);

    const bits: string[] = [`+${awarded.tokensGained} ${cs ? 'žeton' : 'token'}`];
    if (won) bits.push(cs ? '+2 výhra' : '+2 win');
    if (challenge.claimed) bits.push(cs ? `výzva +${CHALLENGE_REWARD}` : `daily +${CHALLENGE_REWARD}`);
    setNotice(bits.join(' · '));

    void fetch('/api/park/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'fight', score, name: nickname }),
    }).catch(() => undefined);
  }, [mode, phase, mpStats, cs, you?.name]);

  const top = mode === 'online' ? mpStats : soloStats;
  const selfHp = mode === 'online' ? mpStats.selfHp : soloStats.selfHp;
  const foeHp = mode === 'online' ? mpStats.foeHp : soloStats.foeHp;
  const selfName = mode === 'online' ? mpStats.selfName : cs ? 'Ty' : 'You';
  const foeName = mode === 'online' ? mpStats.foeName : cs ? 'Cvičný stín' : 'Practice shadow';
  const round = mode === 'online' ? mpStats.round : soloStats.round;
  const countdown = mode === 'online' ? mpStats.countdown : soloStats.countdown;
  const secondsLeft = mode === 'online' ? mpStats.secondsLeft : soloStats.timer;
  const state = mode === 'online' ? mpStats.state : soloStats.phase;
  const selfWins = mode === 'online' ? mpStats.selfWins : soloStats.selfWins;
  const foeWins = mode === 'online' ? mpStats.foeWins : soloStats.foeWins;

  return (
    <main className="arena is-mercury">
      <div className="arena-stage">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 2, 12], fov: 50, near: 0.05, far: 200 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          {phase === 'playing' && mode === 'online' ? (
            <MercuryDuel running onStats={setMpStats} />
          ) : (
            <MercurySolo
              key={phase}
              running={phase === 'playing'}
              selfAvatarId={you?.avatarId ?? null}
              foeAvatarId={mode === 'solo' ? 42 : null}
              botDifficulty={difficulty}
              onStats={setSoloStats}
            />
          )}
        </Canvas>
      </div>

      {phase === 'playing' && (
        <>
          <button
            type="button"
            className="duel-exit"
            aria-label={cs ? 'Ukončit souboj a vrátit se do menu' : 'Leave duel and return to menu'}
            onClick={() => {
              setPhase('idle');
              setMpStats(EMPTY_MP);
              setNotice(null);
            }}
          >
            {cs ? 'Menu' : 'Menu'}
          </button>

          {!(mode === 'online' && (!mpStats.connected || mpStats.state === null)) && <div className="duel-top" aria-hidden>
            <div className="duel-fighter is-self">
              <div className="duel-name">{selfName}</div>
              <div className="duel-bar">
                <i style={{ width: `${(selfHp / MAX_HP) * 100}%` }} className={selfHp <= 30 ? 'is-low' : undefined} />
              </div>
              <div className="duel-pips">
                {Array.from({ length: 2 }, (_, index) => (
                  <span key={index} className={index < selfWins ? 'is-on' : undefined} />
                ))}
              </div>
            </div>
            <div className="duel-clock">
              <div>{cs ? 'kolo' : 'round'} {round}</div>
              <strong>{state === 'countdown' ? `…${countdown}` : `${secondsLeft}s`}</strong>
              <div className="duel-clock-sub">
                {mode === 'online'
                  ? mpStats.foeIsBot
                    ? cs ? 'čeká se na soupeře' : 'waiting for opponent'
                    : mpStats.connected
                      ? `${mpStats.ping ?? 0} ms`
                      : cs ? 'offline' : 'offline'
                  : cs ? 'cvičení' : 'practice'}
              </div>
            </div>
            <div className="duel-fighter is-foe">
              <div className="duel-name">{foeName}</div>
              <div className="duel-bar">
                <i style={{ width: `${(foeHp / MAX_HP) * 100}%` }} className={foeHp <= 30 ? 'is-low' : undefined} />
              </div>
              <div className="duel-pips">
                {Array.from({ length: 2 }, (_, index) => (
                  <span key={index} className={index < foeWins ? 'is-on' : undefined} />
                ))}
              </div>
            </div>
          </div>}

          {mode === 'online' && (!mpStats.connected || mpStats.state === null) && (
            <div className="duel-status" role="status" aria-live="polite">
              <strong>{cs ? 'Připojuji duel…' : 'Connecting to duel…'}</strong>
              <span>{mpStats.connected ? (cs ? 'Hledám volnou klec na Merkuru.' : 'Finding an open Mercury ring.') : (cs ? 'Obnovuji spojení s herním serverem.' : 'Reconnecting to the game server.')}</span>
            </div>
          )}

          {state === 'countdown' && <div className="duel-flash is-count">{countdown > 0 ? countdown : '…'}</div>}
          {top && state === 'roundEnd' && (
            <div className="duel-flash is-round">
              {mode === 'online' && mpStats.lastRoundReason === 'ko' ? 'K.O.' : cs ? 'kolo' : 'round'}
            </div>
          )}
          {mode === 'online' && mpStats.matchWinner !== null && (
            <div className="arena-respawn">
              {duelScore(mpStats.selfWins, mpStats.foeWins) > 0 && mpStats.matchWinner === mpStats.selfId
                ? cs ? 'vyhrál jsi — nový duel začne za chvíli' : 'you won — new duel starts shortly'
                : cs ? 'prohra — odplata začne za chvíli' : 'defeat — rematch incoming'}
              {notice ? ` · ${notice}` : ''}
            </div>
          )}
          {mode === 'solo' && soloStats.phase === 'matchEnd' && (
            <div className="duel-result" role="status" aria-live="polite">
              <strong>{soloStats.winner === 'self' ? (cs ? 'VÍTĚZSTVÍ' : 'VICTORY') : (cs ? 'PROHRA' : 'DEFEAT')}</strong>
              <span>{cs ? 'Cvičný souboj se za chvíli obnoví.' : 'Practice match resets shortly.'}</span>
            </div>
          )}

          <div className="arena-tip">
            {cs
              ? 'A/D pohyb · W skok · J pěst · K kop · S blok'
              : 'A/D move · W jump · J punch · K kick · S block'}
          </div>

          <div className="duel-touch" aria-label="ovládání">
            <div className="duel-touch-row">
              <TouchButton code="KeyA" label="←" ariaLabel={cs ? 'Doleva' : 'Move left'} />
              <TouchButton code="KeyD" label="→" ariaLabel={cs ? 'Doprava' : 'Move right'} />
            </div>
            <div className="duel-touch-row">
              <TouchButton code="KeyJ" label="J" ariaLabel={cs ? 'Pěst' : 'Punch'} />
              <TouchButton code="KeyK" label="K" ariaLabel={cs ? 'Kop' : 'Kick'} />
              <TouchButton code="KeyS" label={cs ? 'blok' : 'block'} ariaLabel={cs ? 'Blokovat' : 'Block'} />
              <TouchButton code="Space" label={cs ? 'skok' : 'jump'} ariaLabel={cs ? 'Skočit' : 'Jump'} />
            </div>
          </div>
        </>
      )}

      {phase === 'idle' && (
        <section className="arena-panel" aria-label="Merkur">
          <header>
            <strong>{cs ? 'Merkur — souboj' : 'Mercury — duel'}</strong>
            <span>best of 3 · 60 s</span>
          </header>
          <p>
            {cs
              ? 'Klec na Merkuru, dva bojovníci, pěst a kop. Cvič proti stínu, nebo připoj online duel — server rozhoduje každý zásah.'
              : 'A cage on Mercury, two fighters, fists and kicks. Practice against the shadow, or join an online duel — the server rules every hit.'}
          </p>
          <div className="arena-keys">
            <kbd>A/D</kbd> {cs ? 'pohyb' : 'move'} · <kbd>W</kbd> {cs ? 'skok' : 'jump'} · <kbd>J</kbd>{' '}
            {cs ? 'pěst' : 'punch'} · <kbd>K</kbd> {cs ? 'kop' : 'kick'} · <kbd>S</kbd> {cs ? 'blok' : 'block'}
          </div>
          <section className="duel-difficulty" aria-label={cs ? 'Obtížnost soupeře' : 'Opponent difficulty'}>
            <strong>{cs ? 'Síla cvičného stínu' : 'Practice shadow skill'}</strong>
            <div className="duel-difficulty-options">
              {([
                { id: 'gentle' as const, cs: 'Klidný', en: 'Gentle', noteCs: 'pomalejší reakce', noteEn: 'slower reactions' },
                { id: 'standard' as const, cs: 'Vyrovnaný', en: 'Balanced', noteCs: 'doporučeno', noteEn: 'recommended' },
                { id: 'champion' as const, cs: 'Mistr', en: 'Champion', noteCs: 'rychlý blok a kop', noteEn: 'quick guards & kicks' },
              ]).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="duel-difficulty-option"
                  aria-pressed={difficulty === option.id}
                  onClick={() => setDifficulty(option.id)}
                >
                  <strong>{cs ? option.cs : option.en}</strong>
                  <span>{cs ? option.noteCs : option.noteEn}</span>
                </button>
              ))}
            </div>
          </section>
          <p className="duel-coach-tip">
            {cs
              ? 'Nejdřív dojdi do dosahu. Pěst je rychlá, kop zasáhne dál a blok výrazně tlumí poškození.'
              : 'Close the distance first. Punches are quick, kicks reach farther, and blocking cuts damage.'}
          </p>
          <div className="arena-actions">
            <button
              type="button"
              className="park-btn"
              onClick={() => {
                unlock();
                setMode('solo');
                setNotice(null);
                setPhase('playing');
              }}
            >
              {cs ? 'Cvičit proti botovi' : 'Practice vs bot'}
            </button>
            <button
              type="button"
              className="park-btn park-btn-mp"
              onClick={() => {
                unlock();
                setMode('online');
                setMpStats(EMPTY_MP);
                setNotice(null);
                setPhase('playing');
              }}
            >
              {cs ? 'Online duel — proti lidem' : 'Online duel — against people'}
            </button>
          </div>
          {notice && <div className="arena-result">{notice}</div>}
          <Link href="/mars" className="arena-link arena-small">
            {cs ? '← Mars aréna' : '← Mars arena'}
          </Link>
          <Link href="/venus" className="arena-link arena-small">
            {cs ? 'Venuše závod →' : 'Venus race →'}
          </Link>
        </section>
      )}
    </main>
  );
}
