'use client';

import { useEffect, useRef, useState } from 'react';

import { useI18n } from '@/core/i18n';

/**
 * Where the scene track is expected. Drop a file at this path and the player
 * activates itself — no code change needed.
 */
export const MATRIX_TRACK = '/audio/matrix.mp3';

type Status = 'checking' | 'missing' | 'ready';

/**
 * Scene soundtrack player, prepared ahead of the track itself.
 *
 * Browsers require a user gesture before audio may start, so nothing plays on
 * load. The button is inert until a file exists at `src`; once it does, the
 * track loops with a short fade in and out.
 */
export function SceneSoundToggle({ src = MATRIX_TRACK }: { src?: string }) {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const audio = useRef<HTMLAudioElement | null>(null);
  const fade = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>('checking');
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: 'HEAD', cache: 'no-store' })
      .then((response) => { if (!cancelled) setStatus(response.ok ? 'ready' : 'missing'); })
      .catch(() => { if (!cancelled) setStatus('missing'); });
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => () => {
    if (fade.current) window.clearInterval(fade.current);
    audio.current?.pause();
    audio.current = null;
  }, []);

  const ensureAudio = () => {
    if (audio.current) return audio.current;
    const element = new Audio(src);
    element.loop = true;
    element.preload = 'auto';
    element.volume = 0;
    audio.current = element;
    return element;
  };

  const ramp = (element: HTMLAudioElement, target: number, done?: () => void) => {
    if (fade.current) window.clearInterval(fade.current);
    fade.current = window.setInterval(() => {
      const next = element.volume + (target > element.volume ? 0.06 : -0.06);
      element.volume = Math.max(0, Math.min(1, next));
      if (Math.abs(element.volume - target) < 0.07) {
        if (fade.current) window.clearInterval(fade.current);
        fade.current = null;
        element.volume = target;
        done?.();
      }
    }, 60);
  };

  const toggle = async () => {
    if (status !== 'ready') return;
    const element = ensureAudio();
    if (playing) {
      ramp(element, 0, () => { element.pause(); setPlaying(false); });
      return;
    }
    try {
      await element.play();
      ramp(element, 0.55);
      setPlaying(true);
    } catch {
      setStatus('missing');
    }
  };

  const label = status === 'missing'
    ? (cs ? 'zvuk se připravuje' : 'sound pending')
    : playing
      ? (cs ? 'vypnout zvuk' : 'sound off')
      : (cs ? 'zvuk' : 'sound');

  return (
    <button
      type="button"
      className="present-link"
      style={{ font: 'inherit', cursor: status === 'ready' ? 'pointer' : 'default', opacity: status === 'ready' ? 1 : 0.55 }}
      onClick={toggle}
      aria-pressed={playing}
      aria-disabled={status !== 'ready'}
      title={status === 'missing'
        ? (cs ? `Podklad se doplní do ${src}` : `Track will be added at ${src}`)
        : (cs ? 'Přehrát hudbu scény' : 'Play scene soundtrack')}
    >
      ♪ {label}
    </button>
  );
}
