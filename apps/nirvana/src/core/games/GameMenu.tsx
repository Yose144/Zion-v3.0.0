'use client';

/**
 * HAMBURGER MENU — jedno nastavení pro všechny hry (2026-11-10).
 *
 * Do 10. 11. 2026 měla každá hra vlastní „Menu" tlačítko, zvuk šel přepnout
 * jen v liště (která se během hry schová) a citlivost pohledu byla schovaná
 * v panelu arény. Tenhle komponent to sjednocuje:
 *
 *  - **je vždy po ruce** (i během hry, kdy je `.game-hud` schovaná),
 *  - **pauzuje hru** přes `core/games/pause` — v sólu opravdu, v multiplayeru
 *    to UI řekne nahlas (server běží dál),
 *  - **drží volby na jednom místě**: zvuk + hlasitost, jazyk, citlivost
 *    pohledu (jen u FPS) a nápověda k ovládání pro aktuální povrch.
 *
 * Texty jsou v tomhle souboru (5 jazyků), protože jde o chrome, ne o obsah
 * světa — stejný vzor jako `GameHud`.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LANG_NAMES, LANGS, langLabel, useI18n, type Lang } from '@/core/i18n';
import { LOOK_MAX, LOOK_MIN, getLookSensitivity, setLookSensitivity } from '@/core/arena/settings';
import {
  getVolume,
  isMuted,
  setVolume,
  subscribeMuted,
  subscribeVolume,
  toggleMuted,
  unlock,
} from '@/core/audio/engine';
import { GAME_LINKS } from './links';
import { CONTROLS, SURFACES } from './surfaces';
import { setGamePaused } from './pause';

type Text = { cs: string; en: string; es?: string; pt?: string; fr?: string };

const T = {
  open: {
    cs: 'Menu a nastavení',
    en: 'Menu & settings',
    es: 'Menú y ajustes',
    pt: 'Menu e ajustes',
    fr: 'Menu et réglages',
  },
  title: { cs: 'Nastavení', en: 'Settings', es: 'Ajustes', pt: 'Ajustes', fr: 'Réglages' },
  resume: { cs: 'Zpět do hry', en: 'Back to the game', es: 'Volver al juego', pt: 'Voltar ao jogo', fr: 'Retour au jeu' },
  close: { cs: 'Zavřít', en: 'Close', es: 'Cerrar', pt: 'Fechar', fr: 'Fermer' },
  sound: { cs: 'Zvuk', en: 'Sound', es: 'Sonido', pt: 'Som', fr: 'Son' },
  soundOn: { cs: 'Zapnout zvuk', en: 'Turn sound on', es: 'Activar el sonido', pt: 'Ligar o som', fr: 'Activer le son' },
  soundOff: { cs: 'Ztlumit', en: 'Mute', es: 'Silenciar', pt: 'Silenciar', fr: 'Couper' },
  volume: { cs: 'Hlasitost', en: 'Volume', es: 'Volumen', pt: 'Volume', fr: 'Volume' },
  volumeNote: {
    cs: 'Platí pro všechny hry a přežije obnovení stránky.',
    en: 'Applies to every game and survives a reload.',
    es: 'Se aplica a todos los juegos y sobrevive a la recarga.',
    pt: 'Aplica-se a todos os jogos e sobrevive ao recarregamento.',
    fr: 'S’applique à tous les jeux et survit au rechargement.',
  },
  language: { cs: 'Jazyk', en: 'Language', es: 'Idioma', pt: 'Idioma', fr: 'Langue' },
  look: {
    cs: 'Citlivost pohledu',
    en: 'Look sensitivity',
    es: 'Sensibilidad de vista',
    pt: 'Sensibilidade da vista',
    fr: 'Sensibilité de la visée',
  },
  lookNote: {
    cs: 'Jen pro hry z pohledu první osoby (Mars).',
    en: 'Only for first-person games (Mars).',
    es: 'Solo para juegos en primera persona (Marte).',
    pt: 'Apenas para jogos em primeira pessoa (Marte).',
    fr: 'Uniquement pour les jeux à la première personne (Mars).',
  },
  controls: { cs: 'Ovládání', en: 'Controls', es: 'Controles', pt: 'Controlos', fr: 'Commandes' },
  games: { cs: 'Kam dál', en: 'Go to', es: 'Ir a', pt: 'Ir para', fr: 'Aller à' },
  home: { cs: 'Nirvana · vesmír', en: 'Nirvana · the universe', es: 'Nirvana · el universo', pt: 'Nirvana · o universo', fr: 'Nirvana · l’univers' },
  pauseNote: {
    cs: 'V sólu se hra pozastaví; v online režimu svět běží dál.',
    en: 'In solo the game pauses; in online mode the world keeps running.',
    es: 'En solitario el juego se pausa; en línea el mundo sigue.',
    pt: 'Em solo o jogo pausa; online o mundo continua.',
    fr: 'En solo le jeu se met en pause ; en ligne le monde continue.',
  },
} satisfies Record<string, Text>;

function pick(text: Text | undefined, lang: Lang): string {
  if (!text) return '';
  return text[lang] ?? text.en;
}

/** Na kterých površích menu vůbec dává smysl (vesmír má vlastní konzoli). */
function hasMenu(pathname: string): boolean {
  return pathname !== '/' && SURFACES.includes(pathname);
}

export function GameMenu() {
  const pathname = usePathname() ?? '/';
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [muted, setMutedState] = useState<boolean | null>(null);
  const [volume, setVolumeState] = useState(1);
  const [look, setLookState] = useState(1);
  const button = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Stav voleb se čte až po mountu (localStorage na serveru není).
  useEffect(() => {
    setMutedState(isMuted());
    setVolumeState(getVolume());
    setLookState(getLookSensitivity());
    const unMute = subscribeMuted(setMutedState);
    const unVolume = subscribeVolume(setVolumeState);
    return () => {
      unMute();
      unVolume();
    };
  }, []);

  // Otevření = pauza. Zavření (i odchod ze stránky) ji musí sundat.
  useEffect(() => {
    setGamePaused(open);
    return () => setGamePaused(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Menu je modal: klávesy nesmí utéct do hry (jinak se postava hýbe).
    const stop = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      // Formulářové prvky v panelu musí klávesy dostat (posuvníky, tlačítka)
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, button, a, textarea, select, [contenteditable]')) return;
      if (event.key === ' ' || event.key.startsWith('Arrow')) event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', stop, true);
    window.addEventListener('keyup', stop, true);
    // Esc v aréně uvolní pointer lock sám; tady jen pro jistotu.
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      void document.exitPointerLock();
    }
    closeButton.current?.focus();
    return () => {
      window.removeEventListener('keydown', stop, true);
      window.removeEventListener('keyup', stop, true);
    };
  }, [open]);

  // Po zavření vrátit fokus na tlačítko, odkud se otevřelo. `wasOpen` brání
  // tomu, aby se hamburger autofokusoval při každém načtení stránky.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      button.current?.focus({ preventScroll: true });
    }
  }, [open]);

  const onVolume = useCallback((value: number) => {
    unlock();
    setVolumeState(setVolume(value / 100));
  }, []);

  const onLook = useCallback((value: number) => {
    setLookState(setLookSensitivity(value));
  }, []);

  if (!hasMenu(pathname)) return null;

  const controls = CONTROLS[pathname];
  const isFps = pathname === '/mars';
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`game-menu-open${open ? ' is-on' : ''}`}
        aria-label={pick(T.open, lang)}
        aria-expanded={open}
        aria-controls="nirvana-game-menu"
        title={pick(T.open, lang)}
        onClick={() => {
          unlock();
          setOpen((value) => !value);
        }}
      >
        <span aria-hidden>☰</span>
      </button>

      {open && (
        <div className="game-menu-backdrop" onPointerDown={() => setOpen(false)}>
          <section
            id="nirvana-game-menu"
            className="game-menu"
            role="dialog"
            aria-modal="true"
            aria-label={pick(T.title, lang)}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <strong>{pick(T.title, lang)}</strong>
                <span>{pick(T.pauseNote, lang)}</span>
              </div>
              <button
                ref={closeButton}
                type="button"
                className="game-menu-close"
                aria-label={pick(T.close, lang)}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="game-menu-section">
              <h3>{pick(T.sound, lang)}</h3>
              <div className="game-menu-row">
                <button
                  type="button"
                  className={`game-menu-toggle${muted ? ' is-off' : ''}`}
                  aria-pressed={muted !== true}
                  onClick={() => {
                    unlock();
                    toggleMuted();
                  }}
                  title={muted ? pick(T.soundOn, lang) : pick(T.soundOff, lang)}
                >
                  <span aria-hidden>{muted ? '🔇' : '🔊'}</span>
                  {/* Tlačítko říká, co udělá teď: když hraje, nabídne ztlumení. */}
                  {muted ? pick(T.soundOn, lang) : pick(T.soundOff, lang)}
                </button>
              </div>
              <label className="game-menu-slider">
                <span>
                  {pick(T.volume, lang)} <b>{Math.round(volume * 100)}%</b>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(volume * 100)}
                  onChange={(event) => onVolume(Number(event.target.value))}
                />
              </label>
              <p className="game-menu-note">{pick(T.volumeNote, lang)}</p>
            </div>

            <div className="game-menu-section">
              <h3>{pick(T.language, lang)}</h3>
              <div className="game-menu-langs" role="group" aria-label={pick(T.language, lang)}>
                {LANGS.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`game-menu-lang${lang === code ? ' is-active' : ''}`}
                    aria-pressed={lang === code}
                    title={LANG_NAMES[code]}
                    onClick={() => setLang(code)}
                  >
                    {langLabel(code)}
                  </button>
                ))}
              </div>
            </div>

            {isFps && (
              <div className="game-menu-section">
                <h3>{pick(T.look, lang)}</h3>
                <label className="game-menu-slider">
                  <span>
                    {pick(T.look, lang)} <b>×{look.toFixed(1)}</b>
                  </span>
                  <input
                    type="range"
                    min={LOOK_MIN}
                    max={LOOK_MAX}
                    step={0.1}
                    value={look}
                    onChange={(event) => onLook(Number(event.target.value))}
                  />
                </label>
                <p className="game-menu-note">{pick(T.lookNote, lang)}</p>
              </div>
            )}

            {controls && (
              <div className="game-menu-section">
                <h3>{pick(T.controls, lang)}</h3>
                <p className="game-menu-controls">{controls[lang] ?? controls.en}</p>
              </div>
            )}

            <div className="game-menu-section">
              <h3>{pick(T.games, lang)}</h3>
              <div className="game-menu-games">
                <Link href="/" className="game-menu-game is-home">
                  <span aria-hidden>◈</span>
                  {pick(T.home, lang)}
                </Link>
                {GAME_LINKS.map((game) => (
                  <Link
                    key={game.id}
                    href={game.href}
                    className={`game-menu-game${pathname === game.href ? ' is-active' : ''}`}
                    style={{ ['--game-tone' as string]: game.tone }}
                    aria-current={pathname === game.href ? 'page' : undefined}
                  >
                    <span aria-hidden>{game.glyph}</span>
                    {lang === 'cs' ? game.title.cs : game.title.en}
                  </Link>
                ))}
              </div>
            </div>

            <footer>
              <button type="button" className="park-btn game-menu-resume" onClick={() => setOpen(false)}>
                {pick(T.resume, lang)}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
