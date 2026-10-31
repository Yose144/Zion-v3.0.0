'use client';

import { useEffect, useRef, useState } from 'react';

import { useI18n } from '@/core/i18n';
import { createAmbience, type Ambience, type AmbienceProfile } from './ambience';

/**
 * Where the scene track is expected. Drop a file at this path and the player
 * activates itself — no code change needed.
 */
export const MATRIX_TRACK = '/audio/matrix.mp3';

type Status = 'checking' | 'track' | 'ambient';

/**
 * Scene sound: a track when one exists, otherwise a synthesised ambience.
 *
 * The button is inert until it knows what it can play. If `/audio/<slug>.mp3` is missing
 * (the current state for every scene), it falls back to a quiet procedural bed matched to
 * the scene, so the control is never dead. Nothing autoplays — browsers require a gesture.
 */
export function SceneSoundToggle({ src = MATRIX_TRACK, profile = 'wind' }: { src?: string; profile?: AmbienceProfile }) {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const audio = useRef<HTMLAudioElement | null>(null);
  const ambience = useRef<Ambience | null>(null);
  const fade = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>('ambient');
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: 'HEAD', cache: 'no-store' })
      .then((response) => {
        if (!cancelled) setStatus(response.ok ? 'track' : 'ambient');
      })
      .catch(() => {
        if (!cancelled) setStatus('ambient');
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

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

    if (status === 'track') {
      const element = ensureAudio();
      try {
        await element.play();
        ramp(element, 0.55);
        setPlaying(true);
      } catch {
        setStatus('ambient');
      }
      return;
    }

    if (!ambience.current) ambience.current = createAmbience(profile);
    try {
      await ambience.current.start();
      setPlaying(true);
    } catch {
      // A blocked audio context leaves the button off rather than throwing.
    }
  };

  const label = playing
    ? (cs ? 'vypnout zvuk' : 'sound off')
    : status === 'checking'
      ? (cs ? 'zvuk se připravuje' : 'sound pending')
      : (cs ? 'zvuk' : 'sound');

  return (
    <button
      type="button"
      className="present-link present-sound"
      style={{ font: 'inherit', cursor: status === 'checking' ? 'default' : 'pointer', opacity: status === 'checking' ? 0.55 : 1 }}
      onClick={toggle}
      aria-pressed={playing}
      aria-disabled={status === 'checking'}
      title={
        status === 'track'
          ? (cs ? 'Přehrát hudbu scény' : 'Play scene soundtrack')
          : (cs ? 'Přehrát ambientní zvuk scény' : 'Play scene ambience')
      }
    >
      ♪ <span className="present-sound-label">{label}</span>
    </button>
  );
}
