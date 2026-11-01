'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { XR, createXRStore } from '@react-three/xr';
import * as THREE from 'three';
import { useI18n } from '@/core/i18n';
import { PARK_CAMERA, ParkScene } from '@/core/scene/park/ParkScene';
import { PARK_GAMES, gameById, type ParkGameHandle, type ParkGameId } from '@/core/park/games';
import { GAME_H, GAME_W, PARK_PALETTE } from '@/core/park/games/types';
import {
  WHEEL_COST,
  awardRun,
  loadProfile,
  spendTokens,
  type ParkProfile,
} from '@/core/park/profile';
import { emptyScores, type ParkScores } from '@/core/park/scores';

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

export default function ParkPage() {
  const { lang } = useI18n();
  const cs = lang === 'cs';

  const [profile, setProfile] = useState<ParkProfile | null>(null);
  const [scores, setScores] = useState<ParkScores>(emptyScores());
  const [active, setActive] = useState<ParkGameId | null>(null);
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
  const activeRef = useRef<ParkGameId | null>(null);
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

  // ── canvas + textura ─────────────────────────────────────────────
  const attachCanvas = useCallback((element: HTMLCanvasElement | null) => {
    canvasRef.current = element;
    if (!element) return;
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

  // ── start / konec hry ────────────────────────────────────────────
  const startGame = useCallback(
    (id: ParkGameId) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      handleRef.current?.stop();
      finishedRef.current = false;
      setActive(id);
      activeRef.current = id;
      setScore(0);
      setFinished(false);
      startedAt.current = Date.now();
      handleRef.current = gameById(id).create(canvas, {
        onScore: (value) => setScore(value),
        onEnd: (value) => {
          if (finishedRef.current) return;
          finishedRef.current = true;
          setScore(value);
          setFinished(true);
          const current = loadProfile();
          const result = awardRun(current, id, value);
          setProfile(result.profile);
          setNotice(
            result.personalBest
              ? cs
                ? `Nový rekord · +${result.tokensGained} žetony`
                : `New record · +${result.tokensGained} tokens`
              : cs
                ? `+${result.tokensGained} žeton`
                : `+${result.tokensGained} token`,
          );
          void fetch('/api/park/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game: id, score: value, name: nick }),
          })
            .then(() => readScores())
            .catch(() => undefined);
        },
      });
    },
    [cs, nick, readScores],
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
    const down = (event: KeyboardEvent) => {
      if (!codes.has(event.code)) return;
      event.preventDefault();
      handleRef.current?.key(event.code, true);
    };
    const up = (event: KeyboardEvent) => {
      if (!codes.has(event.code)) return;
      handleRef.current?.key(event.code, false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [active]);

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

  const canvasNode = useMemo(
    () => <canvas ref={attachCanvas} className="park-screen" aria-label="herní obrazovka" />,
    [attachCanvas],
  );

  return (
    <main className="park">
      <div className="park-stage">
        <Canvas
          dpr={[1, 1.6]}
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
                onSelectGame={startGame}
                onRide={ride}
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
                onSelectGame={startGame}
                onRide={ride}
              />
              {!riding && (
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
            <button type="button" className="park-btn" onClick={() => setRiding(false)}>
              {cs ? 'Sesednout' : 'Get off'}
            </button>
          )}
        </div>
      </header>

      {/* herní obrazovka — jeden canvas, dva pohledy */}
      <div className={`park-dock${active ? ' is-open' : ''}`} aria-hidden={!active}>
        {canvasNode}
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

      {!active && (
        <section className="park-panel">
          <header>
            <strong>{cs ? 'VYBER SI SKŘÍŇ' : 'PICK A CABINET'}</strong>
          </header>
          <div className="park-games">
            {PARK_GAMES.map((entry) => (
              <button key={entry.id} type="button" onClick={() => startGame(entry.id)}>
                <strong>{entry.title[cs ? 'cs' : 'en']}</strong>
                <small>{entry.hint[cs ? 'cs' : 'en']}</small>
              </button>
            ))}
          </div>
          <button type="button" className="park-btn park-ride-btn" onClick={ride} disabled={riding}>
            {cs ? `Ruské kolo · ${WHEEL_COST} žeton` : `Ferris wheel · ${WHEEL_COST} token`}
          </button>

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
            {PARK_GAMES.map((entry) => (
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
