'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

/*
 * Nirvana preview window on the landing page.
 *
 * The scene itself lives in NirvanaUniverseCanvas.tsx and is pulled in with a
 * dynamic import, so three.js + react-three-fiber (~950 KB) never enters the
 * initial bundle. Desktop visitors who scroll it into view get it
 * automatically; phones, data-saver connections and everyone else get the
 * poster plus a "play" button. Failures (no WebGL, context loss, chunk error)
 * leave the poster in place instead of an empty box.
 */

const UniverseLazy = dynamic(() => import('./NirvanaUniverseCanvas'), {
  ssr: false,
  loading: () => null,
});

const NIRVANA_URL = 'https://nirvana.zionterranova.com';

type Lang = 'cs' | 'en' | 'es' | 'pt' | 'fr';

function useIntroLang(): Lang {
  const [lang, setLang] = useState<Lang>('cs');
  useEffect(() => {
    const read = () => {
      const code = document.documentElement.lang;
      setLang(code === 'en' || code === 'es' || code === 'pt' || code === 'fr' ? code : 'cs');
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => mo.disconnect();
  }, []);
  return lang;
}

/** Should this device load the live scene without being asked? */
function canAutoLoad() {
  try {
    if (!window.matchMedia('(min-width: 900px)').matches) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (window.matchMedia('(prefers-reduced-data: reduce)').matches) return false;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData) return false;
    if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return false;
    if ((navigator.hardwareConcurrency ?? 8) <= 2) return false;
    return true;
  } catch {
    return false;
  }
}

export default function NirvanaUniverseEmbed() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [auto, setAuto] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lang = useIntroLang();
  const cs = lang === 'cs';

  // portal target: the placeholder <div id="nirvana-embed"> inside the markup
  useEffect(() => {
    const el = document.getElementById('nirvana-embed');
    if (el) {
      el.innerHTML = ''; // replace the server-rendered poster with the React window
      setTarget(el);
    }
  }, []);

  useEffect(() => {
    setAuto(canAutoLoad());
  }, []);

  // Pause the render loop when the window scrolls out of view; only auto-mount
  // once it approaches the viewport (auto mode). The mount is deferred ~1.2 s so
  // the three.js chunk never competes with the LCP (hero text + poster).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      if (auto) setMounted(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting && auto && !timer) {
          timer = setTimeout(() => setMounted(true), 1200);
        }
      },
      { rootMargin: '150px' }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [auto]);

  const loadNow = () => {
    setMounted(true);
    setFailed(false);
  };

  if (!target) return null;

  const showPlay = !mounted && !failed;

  return createPortal(
    <div ref={wrapRef} className="nirvana-embed-shell">
      <div className="nirvana-embed-frame" aria-hidden={ready || undefined}>
        <img
          className="nirvana-poster"
          src="/images/nirvana-preview.webp"
          alt="Nirvana — vesmír prvního světa OASIS"
          width={1100}
          height={480}
          loading="lazy"
          decoding="async"
        />
        <div className="nirvana-poster-shade" />
        {showPlay && (
          <button type="button" className="nirvana-embed-play" onClick={loadNow}>
            <span className="nirvana-embed-play-icon" aria-hidden="true">▶</span>
            {cs ? 'Spustit živou scénu' : 'Play the live scene'}
          </button>
        )}
      </div>

      {mounted && !failed && (
        <div className={`nirvana-embed-canvas${ready ? ' is-ready' : ''}`} aria-hidden={!ready}>
          <UniverseLazy
            active={visible}
            onReady={() => setReady(true)}
            onUnavailable={() => setFailed(true)}
          />
        </div>
      )}

      {!ready && (
        <div className="nirvana-embed-caption">
          <span>{cs ? 'Náhled OASIS' : 'OASIS preview'}</span>
          <a href={NIRVANA_URL} target="_blank" rel="noopener noreferrer">
            {cs ? 'Otevřít Nirvanu' : 'Open Nirvana'} →
          </a>
        </div>
      )}
    </div>,
    target
  );
}
