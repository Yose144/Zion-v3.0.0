'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { XR, createXRStore } from '@react-three/xr';
import * as THREE from 'three';
import { useI18n, tx } from '@/core/i18n';
import { GAME_LINKS } from '@/core/games/links';
import { play, unlock, type SoundName } from '@/core/audio/engine';
import { PARK_CAMERA, ParkScene } from '@/core/scene/park/ParkScene';
import { PARK_GAMES, gameById, type CanvasGameId, type ParkGameHandle, type ParkGameId } from '@/core/park/games';
import { GAME_H, GAME_W, PARK_PALETTE } from '@/core/park/games/types';
import {
  WHEEL_COST,
  claimRideBonus,
  loadProfile,
  spendTokens,
  type ParkProfile,
} from '@/core/park/profile';
import { dailyChallenge, type DailyChallenge } from '@/core/park/challenge';
import { describeRun, recordRun as recordGameRun } from '@/core/progress/run';
import { emptyScores, type ParkScores } from '@/core/park/scores';
import { GALLERY_SECONDS } from '@/core/scene/park/ShootingGallery';
import { TouchButton } from '@/core/games/TouchPad';
import { canvasDpr } from '@/core/design/dpr';

/**
 * Jupiter Station — pouť.
 *
 * Co je kde:
 *  - plátno (celá obrazovka) .......... svět
 *  - ukotvený panel ................... hra, tabule, žetony, jízda
 *  - canvas hry ....................... jeden element, který je zároveň texturou na skříni
 *
 * Hra neběží „v panelu" a „ve scéně" zvlášť — je to jeden canvas, který se
 * zobrazuje na dvou místech. Proto ji vidí i hráč ve VR.
 */

/** Názvy všech her, které mají skóre — canvas, 3D i hry mimo park. */
const TITLES: { id: ParkGameId; title: { cs: string; en: string } }[] = [
  ...PARK_GAMES.map((game) => ({ id: game.id as ParkGameId, title: game.title })),
  { id: 'gallery', title: { cs: 'Střelnice', en: 'Gallery' } },
  { id: 'arena', title: { cs: 'Mars aréna', en: 'Mars arena' } },
  { id: 'race', title: { cs: 'Venuše okruh', en: 'Venus circuit' } },
  { id: 'fight', title: { cs: 'Merkur souboj', en: 'Mercury duel' } },
  { id: 'moba', title: { cs: 'První svět', en: 'First World' } },
  { id: 'tanks', title: { cs: 'Saturn tanky', en: 'Saturn tanks' } },
  { id: 'lumi', title: { cs: 'Lumi', en: 'Lumi' } },
];

const BOARD = TITLES;

function titleOf(id: ParkGameId, cs: boolean): string {
  return TITLES.find((entry) => entry.id === id)?.title[cs ? 'cs' : 'en'] ?? id;
}

const RIDE_SECONDS = 25; // jedna otočka kola při jízdě

/**
 * Zvuk skórování podle skříně. Nemá smysl, aby všechny hry pípaly stejně —
 * Pong je tupý úder pálky, Breakout křupnutí cihly, Had polknutí, Tetris
 * zaplnění linky a Asteroidy výstřel.
 */
const SCORE_SOUND: Record<CanvasGameId, SoundName> = {
  pong: 'paddle',
  breakout: 'brick',
  snake: 'eat',
  tetris: 'lock',
  asteroids: 'shoot',
  tower: 'lock',
};


export default function ParkPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  const [profile, setProfile] = useState<ParkProfile | null>(null);
  const [scores, setScores] = useState<ParkScores>(emptyScores());
  const [active, setActive] = useState<CanvasGameId | null>(null);
  const [gallery, setGallery] = useState(false);
  const [galleryScore, setGalleryScore] = useState(0);
  const [galleryTime, setGalleryTime] = useState(GALLERY_SECONDS);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [riding, setRiding] = useState(false);
  const [xr, setXr] = useState(false);
  const [nick, setNick] = useState('hrac');
  const [notice, setNotice] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const handleRef = useRef<ParkGameHandle | null>(null);
  const pointerRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const activeRef = useRef<CanvasGameId | null>(null);
  const startedAt = useRef(0);
  const finishedRef = useRef(false);
  const [xrStore] = useState(() => createXRStore({ foveation: 0.5 }));

  const readScores = useCallback(async () => {
    try {
      const res = await fetch('/api/park/scores', { cache: 'no-store' });
      const body = (await res.json()) as { scores?: ParkScores };
      if (body?.scores) setScores(body.scores);
    } catch {
      // tabule je dekorace, když spadne — hra jede dál
    }
  }, []);

  useEffect(() => {
    setProfile(loadProfile());
    void readScores();
    try {
      const saved = window.localStorage.getItem('nirvana.park.name');
      if (saved) setNick(saved);
      else {
        const generated = `hrac-${Math.random().toString(36).slice(2, 5)}`;
        window.localStorage.setItem('nirvana.park.name', generated);
        setNick(generated);
      }
    } catch {
      // bez úložiště zůstane „hrac"
    }
  }, [readScores]);

  // během hry na mobilu schovej navigaci a chat (celá obrazovka pro hru)
  useEffect(() => {
    document.body.dataset.playing = active ? '1' : '';
    return () => {
      document.body.dataset.playing = '';
    };
  }, [active]);

  // ── canvas + textura ─────────────────────────────────────────────
  /** Dotyk/myš na plátně = pozice pálky/kormidla (0..1). */
  const onCanvasPointer = useCallback((event: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(1, rect.width);
    pointerRef.current = Math.max(0, Math.min(1, x));
    // klepnutí = okamžik, ne poloha (Věž podle něj pokládá kvádr)
    if (event.type === 'pointerdown') handleRef.current?.tap?.();
  }, []);

  const attachCanvas = useCallback((element: HTMLCanvasElement | null) => {
    const previous = canvasRef.current;
    if (previous && previous !== element) {
      previous.removeEventListener('pointermove', onCanvasPointer);
      previous.removeEventListener('pointerdown', onCanvasPointer);
    }
    canvasRef.current = element;
    if (!element) return;
    element.addEventListener('pointermove', onCanvasPointer);
    element.addEventListener('pointerdown', onCanvasPointer);
    element.width = GAME_W;
    element.height = GAME_H;
    const map = new THREE.CanvasTexture(element);
    map.colorSpace = THREE.SRGBColorSpace;
    map.minFilter = THREE.LinearFilter;
    map.magFilter = THREE.LinearFilter;
    setTexture(map);
  }, []);

  useEffect(() => () => texture?.dispose(), [texture]);

  // ── herní smyčka: kreslí do canvasu a tím i na skříň ─────────────
  useEffect(() => {
    let last = performance.now();
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (handleRef.current) {
        handleRef.current.pointer(pointerRef.current);
        handleRef.current.frame(dt);
      } else {
        // attract screen, když se nehraje
        const t = now / 1000;
        ctx.fillStyle = PARK_PALETTE.bg;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.textAlign = 'center';
        ctx.fillStyle = PARK_PALETTE.gold;
        ctx.font = 'bold 34px ui-monospace, monospace';
        ctx.fillText('JUPITER STATION', GAME_W / 2, GAME_H / 2 - 26);
        ctx.fillStyle = 'rgba(244, 234, 210, 0.7)';
        ctx.font = '16px ui-monospace, monospace';
        ctx.fillText(cs ? 'vyber si skříň' : 'pick a cabinet', GAME_W / 2, GAME_H / 2 + 4);
        ctx.fillStyle = `rgba(255, 209, 102, ${0.35 + Math.sin(t * 2) * 0.25})`;
        ctx.font = 'bold 20px ui-monospace, monospace';
        ctx.fillText('◉', GAME_W / 2, GAME_H / 2 + 46);
      }
      if (texture) texture.needsUpdate = true;
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [texture, cs]);

  // ── záznam dohrané hry: žetony, rekord, výzva, level, tabule ──────
  const recordRun = useCallback(
    (game: ParkGameId, value: number) => {
      const outcome = recordGameRun({ game, score: value, nickname: nick });
      setProfile(outcome.profile);
      setNotice(describeRun(outcome, cs));
      void outcome.posted?.then(() => readScores());
    },
    [cs, nick, readScores],
  );

  // ── start / konec hry ────────────────────────────────────────────
  const startGame = useCallback(
    (id: CanvasGameId) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      unlock();
      handleRef.current?.stop();
      finishedRef.current = false;
      setActive(id);
      activeRef.current = id;
      setScore(0);
      setFinished(false);
      startedAt.current = Date.now();
      play('open');
      /** Poslední skóre — zvuk patří jen skutečnému přírůstku, ne každému callbacku. */
      let lastScore = 0;
      handleRef.current = gameById(id).create(canvas, {
        onScore: (value) => {
          // Tetris skóruje po řádcích: velký skok = vyčištěná linka, malý = dopad
          if (value > lastScore) play(value - lastScore >= 100 ? 'clear' : SCORE_SOUND[id]);
          lastScore = value;
          setScore(value);
        },
        onEnd: (value) => {
          if (finishedRef.current) return;
          finishedRef.current = true;
          setScore(value);
          setFinished(true);
          play(value > 0 ? 'ticket' : 'over');
          recordRun(id, value);
        },
      });
    },
    [recordRun],
  );

  const stopGame = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    activeRef.current = null;
    finishedRef.current = false;
    setFinished(false);
    setActive(null);
    setScore(0);
    pointerRef.current = null;
  }, []);

  // ── klávesy (šipky/WASD) ────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const codes = new Set([
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'Space',
    ]);
    const pressed = new Set<string>();
    const down = (event: KeyboardEvent) => {
      if (!codes.has(event.code)) return;
      event.preventDefault();
      pressed.add(event.code);
      handleRef.current?.key(event.code, true);
    };
    const up = (event: KeyboardEvent) => {
      if (!codes.has(event.code)) return;
      pressed.delete(event.code);
      handleRef.current?.key(event.code, false);
    };
    // při ztrátě fokusu klávesy pustit — jinak Had jede dál po přepnutí tabu
    const release = () => {
      for (const code of pressed) handleRef.current?.key(code, false);
      pressed.clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
      release();
    };
  }, [active]);

  const startGallery = useCallback(() => {
    unlock();
    stopGame();
    setRiding(false);
    setGalleryScore(0);
    setGalleryTime(GALLERY_SECONDS);
    setGallery(true);
    play('open');
    setNotice(cs ? 'Střelnice · 25 sekund' : 'Gallery · 25 seconds');
  }, [cs, stopGame]);

  const endGallery = useCallback(
    (value: number) => {
      setGallery(false);
      recordRun('gallery', value);
    },
    [recordRun],
  );

  const ride = useCallback(() => {
    const current = profile ?? loadProfile();
    if (current.tokens < WHEEL_COST) {
      setNotice(cs ? 'Chybí žeton — dohraj hru' : 'No token left — finish a game');
      return;
    }
    const next = spendTokens(current, WHEEL_COST);
    if (!next) return;
    setProfile(next);
    stopGame();
    setRiding(true);
    setNotice(cs ? 'Jízda začíná' : 'Ride starts');
  }, [cs, profile, stopGame]);

  /**
   * Konec jízdy. Dokončená otočka (časovač) vrátí vstupné první jízdu dne;
   * sesednutí předčasně je jen konec — vstupné se nevrací, ať je slovo
   * „dokončená" pravdivé.
   */
  const endRide = useCallback(
    (completed: boolean) => {
      setRiding(false);
      if (!completed) {
        setNotice(cs ? 'Jízda ukončena' : 'Ride ended');
        return;
      }
      const bonus = claimRideBonus(profile ?? loadProfile());
      setProfile(bonus.profile);
      setNotice(
        bonus.granted
          ? cs
            ? 'Jízda dokončena · první dnes zdarma, +1 žeton'
            : 'Ride complete · first one today is free, +1 token'
          : cs
            ? 'Jízda dokončena'
            : 'Ride complete',
      );
    },
    [cs, profile],
  );

  // kolo dokončí otočku samo — jinak jízda trvá do konce světa
  useEffect(() => {
    if (!riding) return;
    const timer = setTimeout(() => endRide(true), RIDE_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [riding, endRide]);

  const nickChange = useCallback((value: string) => {
    const clean = value.replace(/[\u0000-\u001f<>]/g, '').slice(0, 12);
    setNick(clean);
    try {
      window.localStorage.setItem('nirvana.park.name', clean || 'hrac');
    } catch {
      // nic — jméno zůstane jen v paměti
    }
  }, []);

  const game = active ? gameById(active) : null;
  const tokens = profile?.tokens ?? 0;
  /**
   * Výzva se počítá z **lokálního** data, ale server renderuje v UTC — kolem
   * půlnoci se den rozešel a React hlásil hydration mismatch (#418).
   * Počítá se proto až po mountu (stejná strategie jako u profilu).
   */
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  useEffect(() => {
    setChallenge(dailyChallenge());
  }, []);
  const challengeDone = Boolean(challenge) && profile?.challengeDay === challenge!.day;

  const canvasNode = useMemo(
    () => <canvas ref={attachCanvas} className="park-screen" aria-label="herní obrazovka" />,
    [attachCanvas],
  );

  return (
    <main className="park">
      <div className="park-stage">
        <Canvas
          dpr={canvasDpr(1.6)}
          shadows
          camera={{ ...PARK_CAMERA }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          {xr ? (
            <XR store={xrStore}>
              <ParkScene
                lang={cs ? 'cs' : 'en'}
                activeGame={active}
                screenTexture={texture}
                scores={scores}
                riding={riding}
                gallery={gallery}
                onSelectGame={startGame}
                onRide={ride}
                onGalleryScore={setGalleryScore}
                onGalleryTime={setGalleryTime}
                onGalleryEnd={endGallery}
              />
            </XR>
          ) : (
            <>
              <ParkScene
                lang={cs ? 'cs' : 'en'}
                activeGame={active}
                screenTexture={texture}
                scores={scores}
                riding={riding}
                gallery={gallery}
                onSelectGame={startGame}
                onRide={ride}
                onGalleryScore={setGalleryScore}
                onGalleryTime={setGalleryTime}
                onGalleryEnd={endGallery}
              />
              {!riding && !gallery && (
                <OrbitControls
                  makeDefault
                  autoRotate={!active}
                  autoRotateSpeed={0.16}
                  enableDamping
                  dampingFactor={0.08}
                  enablePan={false}
                  minDistance={12}
                  maxDistance={48}
                  minPolarAngle={0.5}
                  maxPolarAngle={1.42}
                  target={[0, 6, -2]}
                />
              )}
            </>
          )}
        </Canvas>
      </div>

      <header className="park-chrome">
        <Link href="/" className="present-back">
          ← Nirvana
        </Link>
        <div className="park-title">
          <strong>Jupiter Station</strong>
          <span>{cs ? 'pouť · hry · ruské kolo' : 'fair · games · ferris wheel'}</span>
        </div>
        <div className="park-hud">
          <span className="park-tokens" title={cs ? 'Žetony' : 'Tokens'}>
            ◉ {tokens}
          </span>
          {!xr && (
            <button type="button" className="park-btn" onClick={() => setXr(true)}>
              VR
            </button>
          )}
          {riding && (
            <button type="button" className="park-btn" onClick={() => endRide(false)}>
              {cs ? 'Sesednout' : 'Get off'}
            </button>
          )}
        </div>
      </header>

      {gallery && (
        <section className="park-gallery-hud" aria-live="polite">
          <strong>{cs ? 'STŘELNICE' : 'GALLERY'}</strong>
          <span>
            {galleryScore} {cs ? 'b.' : 'pts'}
          </span>
          <span className={galleryTime <= 5 ? 'is-low' : ''}>
            {galleryTime} {cs ? 's' : 's'}
          </span>
          <button type="button" className="park-btn" onClick={() => setGallery(false)}>
            {cs ? 'Ukončit' : 'Quit'}
          </button>
        </section>
      )}

      {/* herní obrazovka — jeden canvas, dva pohledy */}
      <div className={`park-dock${active ? ' is-open' : ''}`} aria-hidden={!active}>
        {canvasNode}
        <div className="park-touch">
          <div className="park-touch-row">
            <TouchButton code="ArrowLeft" className="is-left">
              ←
            </TouchButton>
            <TouchButton code="ArrowRight" className="is-right">
              →
            </TouchButton>
          </div>
          <div className="park-touch-row">
            <TouchButton code="ArrowUp" className="is-small">
              ↑
            </TouchButton>
            <TouchButton code="Space" className="is-small">
              {cs ? 'AKCE' : 'ACTION'}
            </TouchButton>
            <TouchButton code="ArrowDown" className="is-small">
              ↓
            </TouchButton>
          </div>
        </div>
        {game && (
          <div className="park-dock-copy">
            <strong>{game.title[cs ? 'cs' : 'en']}</strong>
            <span>
              {cs ? 'skóre' : 'score'} {score}
            </span>
            <small>{game.hint[cs ? 'cs' : 'en']}</small>
            {finished ? (
              <button type="button" className="park-btn" onClick={() => active && startGame(active)}>
                {cs ? 'Hrát znovu' : 'Play again'}
              </button>
            ) : null}
            <button type="button" className="park-btn" onClick={stopGame}>
              {cs ? 'Ukončit hru' : 'Quit game'}
            </button>
          </div>
        )}
      </div>

      {!active && !gallery && (
        <section className="park-panel">
          <header>
            <strong>{cs ? 'VYBER SI SKŘÍŇ' : 'PICK A CABINET'}</strong>
          </header>
          <div className="park-games">
            {PARK_GAMES.map((entry) => {
              const best = profile?.best[entry.id];
              return (
                <button key={entry.id} type="button" onClick={() => startGame(entry.id)}>
                  <strong>{entry.title[cs ? 'cs' : 'en']}</strong>
                  <small>{entry.hint[cs ? 'cs' : 'en']}</small>
                  {best ? <em className="park-best">{cs ? 'rekord' : 'best'} {best}</em> : null}
                </button>
              );
            })}
          </div>
          <button type="button" className="park-btn park-ride-btn" onClick={startGallery}>
            {cs ? 'Střelnice · 25 s · 3D terče' : 'Shooting gallery · 25 s · 3D targets'}
          </button>
          <button type="button" className="park-btn park-ride-btn" onClick={ride} disabled={riding}>
            {cs
              ? `Ruské kolo · ${WHEEL_COST} žeton · první jízda dne zdarma`
              : `Ferris wheel · ${WHEEL_COST} token · first ride of the day is free`}
          </button>
          <div className="park-games">
            {GAME_LINKS.filter((game) => game.id !== 'park').map((game) => (
              <Link
                key={game.id}
                href={game.href}
                className="park-game-card"
                style={{ ['--game-tone' as string]: game.tone }}
              >
                <span className="park-game-glyph" aria-hidden>
                  {game.glyph}
                </span>
                <span className="park-game-text">
                  <strong>{tx(game.title, lang)}</strong>
                  <em>{tx(game.note, lang)}</em>
                </span>
                <span className="park-game-go" aria-hidden>
                  →
                </span>
              </Link>
            ))}
          </div>

          {challenge && (
            <div className={`park-challenge${challengeDone ? ' is-done' : ''}`}>
              <strong>{cs ? 'DENNÍ VÝZVA' : 'DAILY CHALLENGE'}</strong>
              <span>
                {titleOf(challenge.game, cs)}
                {' · '}
                {cs ? 'cíl' : 'target'} {challenge.target}
              </span>
              {(profile?.best[challenge.game] ?? 0) > 0 && (
                <em className="park-best">
                  {cs ? 'rekord' : 'best'} {profile!.best[challenge.game]} / {cs ? 'cíl' : 'target'}{' '}
                  {challenge.target}
                </em>
              )}
              <small>
                {challengeDone
                  ? cs
                    ? 'splněno · zlatá vstupenka je tvoje'
                    : 'done · golden ticket is yours'
                  : cs
                    ? `+${challenge.reward} žetonů · jednou denně`
                    : `+${challenge.reward} tokens · once a day`}
              </small>
            </div>
          )}

          <header className="park-board-head">
            <strong>{cs ? 'TABULE' : 'BOARD'}</strong>
            <input
              value={nick}
              onChange={(event) => nickChange(event.target.value)}
              aria-label={cs ? 'Přezdívka' : 'Nickname'}
              maxLength={12}
              spellCheck={false}
            />
          </header>
          <div className="park-board-list">
            {BOARD.map((entry) => (
              <div key={entry.id} className="park-board-col">
                <em>{entry.title[cs ? 'cs' : 'en']}</em>
                {(scores[entry.id] ?? []).slice(0, 5).map((row, index) => (
                  <span key={`${row.at}-${index}`}>
                    {index + 1}. {row.name} · {row.score}
                  </span>
                ))}
                {(scores[entry.id] ?? []).length === 0 && <span className="park-empty">—</span>}
              </div>
            ))}
          </div>
          {notice && <p className="park-notice">{notice}</p>}
          <p className="park-note">
            {cs
              ? 'Žetony jsou jen v prohlížeči a nic se za ně nekupuje. Park nehraje o peníze.'
              : 'Tokens live in your browser only and buy nothing of value. The fair does not play for money.'}
          </p>
        </section>
      )}
    </main>
  );
}
