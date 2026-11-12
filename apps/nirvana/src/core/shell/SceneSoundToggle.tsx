'use client';

import { useEffect, useRef, useState } from 'react';

import { useI18n } from '@/core/i18n';
import { createAmbience, type Ambience, type AmbienceProfile } from './ambience';

/**
 * Where the scene track is expected. Drop a file at this path and the player
 * activates itself — no code change needed.
 */
export const MATRIX_TRACK = '/audio/matrix.mp3';

type Status = 'ready' | 'track' | 'ambient';

/**
 * Scene sound: a track when one exists, otherwise a synthesised ambience.
 *
 * Zvuk se **sondáže až při prvním kliknutí**, ne při mountu. Dřív se na každé
 * scéně posílal `HEAD /audio/<slug>.mp3`; soubory neexistují, takže každá
 * prezentace vyrobila 404 v konzoli a jeden zbytečný request (13 scén).
 * Teď se zkusí přehrát track a když spadne (404 / nepodporovaný formát),
 * přepne se na syntetizovanou ambienci. „Přilož soubor a hraje" pořád platí.
 *
 * Nothing autoplays — browsers require a gesture.
 */
export function SceneSoundToggle({ src = MATRIX_TRACK, profile = 'wind' }: { src?: string; profile?: AmbienceProfile }) {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const audio = useRef<HTMLAudioElement | null>(null);
  const ambience = useRef<Ambience | null>(null);
  const fade = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>('ready');
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => {
    if (fade.current) window.clearInterval(fade.current);
    audio.current?.pause();
    ambience.current?.dispose();
  }, []);

  const ensureAudio = (): HTMLAudioElement => {
    if (!audio.current) {
      const element = new Audio(src);
      element.loop = true;
      element.volume = 0;
      element.preload = 'none';
      audio.current = element;
    }
    return audio.current;
  };

  const ramp = (element: HTMLAudioElement, target: number, done?: () => void) => {
    if (fade.current) window.clearInterval(fade.current);
    fade.current = window.setInterval(() => {
      const step = target > element.volume ? 0.05 : -0.05;
      const next = Math.max(0, Math.min(1, element.volume + step));
      element.volume = next;
      if (Math.abs(next - target) < 0.051) {
        if (fade.current) window.clearInterval(fade.current);
        fade.current = null;
        element.volume = target;
        done?.();
      }
    }, 60);
  };

  const startAmbience = async (): Promise<boolean> => {
    if (!ambience.current) ambience.current = createAmbience(profile);
    try {
      await ambience.current.start();
      return true;
    } catch {
      // Blokovaný audio kontext nechá tlačítko vypnuté, ale nic neshodí.
      return false;
    }
  };

  const toggle = async () => {
    if (playing) {
      if (status === 'track') {
        const element = ensureAudio();
        ramp(element, 0, () => element.pause());
      } else {
        ambience.current?.stop();
      }
      setPlaying(false);
      return;
    }

    // První klik = jediná sonda, jestli track existuje.
    if (status !== 'ambient') {
      const element = ensureAudio();
      try {
        await element.play();
        ramp(element, 0.55);
        setStatus('track');
        setPlaying(true);
        return;
      } catch {
        element.pause();
        audio.current = null;
        setStatus('ambient');
      }
    }

    if (await startAmbience()) setPlaying(true);
  };

  const label = playing ? (cs ? 'vypnout zvuk' : 'sound off') : cs ? 'zvuk' : 'sound';

  return (
    <button
      type="button"
      className="present-link present-sound"
      style={{ font: 'inherit', cursor: 'pointer' }}
      onClick={toggle}
      aria-pressed={playing}
      title={
        status === 'track'
          ? cs
            ? 'Přehrát hudbu scény'
            : 'Play scene soundtrack'
          : cs
            ? 'Přehrát zvuk scény'
            : 'Play scene sound'
      }
    >
      ♪ <span className="present-sound-label">{label}</span>
    </button>
  );
}
