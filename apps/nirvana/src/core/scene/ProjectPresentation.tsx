'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, useProgress } from '@react-three/drei';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { ProjectLanguageButton } from '@/core/shell/ProjectLanguageButton';
import { SceneSoundToggle } from '@/core/shell/SceneSoundToggle';
import type { AmbienceProfile } from '@/core/shell/ambience';
import { useI18n } from '@/core/i18n';
import { MISSION_ORIGIN } from '@/lib/freeworld-sites';
import { quality } from '../../../../shared/scenes/kit/quality';

type Lang = 'cs' | 'en';

export interface ProjectPresentationProps {
  title: string;
  subtitle: { cs: string; en: string };
  /** Community page on app.zionterranova.com, e.g. `/terranova/amenti`. */
  missionPath: string;
  camera: { position: [number, number, number]; fov: number; far?: number };
  controls: Record<string, unknown>;
  /** Track name under `/audio/`; falls back to a synthesised ambience when missing. */
  sound?: string;
  /** Ambience character used when no track file exists. */
  ambience?: AmbienceProfile;
  /** DOM overlay above the canvas — chat, gate list, anything that is not 3D. */
  overlay?: ReactNode;
  children: (lang: Lang) => ReactNode;
}

/** Fades the veil once the scene's textures and geometry have loaded. */
function LoadingVeil() {
  const { active, progress } = useProgress();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (active) {
      setVisible(true);
      return;
    }
    const timer = window.setTimeout(() => setVisible(false), 260);
    return () => window.clearTimeout(timer);
  }, [active]);
  if (!visible) return null;
  return (
    <div className="present-veil" aria-hidden>
      <span className="present-veil-label">ZION · TerraNova</span>
      <span className="present-veil-track">
        <span className="present-veil-bar" style={{ width: `${Math.max(6, Math.round(progress))}%` }} />
      </span>
    </div>
  );
}

/**
 * One wrapper for every L5 project presentation: chrome, canvas, quality tier,
 * controls, soundtrack and the loading veil. Scenes own the 3D content only.
 */
export function ProjectPresentation({ title, subtitle, missionPath, camera, controls, sound, ambience = 'wind', overlay, children }: ProjectPresentationProps) {
  const { lang } = useI18n();
  const cs = lang === 'cs';
  const settings = quality();

  return (
    <main className={`present${overlay ? ' has-overlay' : ''}`}>
      <header className="present-chrome">
        <Link href="/" className="present-back">
          ← Nirvana
        </Link>
        <div className="present-title">
          <strong>{title}</strong>
          <span className="present-sub">{cs ? subtitle.cs : subtitle.en}</span>
        </div>
        <ProjectLanguageButton />
        {sound ? <SceneSoundToggle src={`/audio/${sound}.mp3`} profile={ambience} /> : null}
        <a className="present-link" href={`${MISSION_ORIGIN}${missionPath}`} target="_blank" rel="noopener noreferrer">
          {cs ? 'komunita ↗' : 'community ↗'}
        </a>
      </header>

      <Canvas
        dpr={[1, settings.dpr]}
        shadows
        camera={camera}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        {children(lang)}
        <OrbitControls makeDefault {...controls} />
      </Canvas>

      <LoadingVeil />

      {overlay}

      <div className="present-hint">
        {cs ? 'Táhni pro otočení · kolečko pro přiblížení' : 'Drag to rotate · scroll to zoom'}
      </div>
    </main>
  );
}
