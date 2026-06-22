import React, {useEffect, memo} from 'react';
import {View, StyleSheet, Platform} from 'react-native';

/**
 * GalacticBackground — Warp Starfield + Nebula Bubbles + HUD Grid
 * 
 * Synchronizováno s:
 *   - website-v2.9/StarfieldBackground (galactic-core mode)
 *   - desktop-agent/WarpStarfield.js
 * 
 * Přístup: Přímá DOM injekce do document.body (z-index záporný)
 *          + CSS force-transparent na VŠECHNY RNW vrstvy
 */

const STAR_COLOR = [200, 118, 255]; // galactic-core purple
const STAR_COUNT = 220;
const SPEED = 2.8;
const TRAIL_OPACITY = 0.05;

const NEBULA_BUBBLES = [
  {size: 320, x: 0.08, y: 0.18, color: 'rgba(249,217,118,0.12)', dur: 28000},
  {size: 260, x: 0.72, y: 0.24, color: 'rgba(50,230,255,0.10)', dur: 32000},
  {size: 220, x: 0.45, y: 0.74, color: 'rgba(155,92,255,0.14)', dur: 26000},
  {size: 160, x: 0.12, y: 0.70, color: 'rgba(255,128,229,0.08)', dur: 30000},
];

const WarpCanvas = memo(() => {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // ═══════════════════════════════════════════════════════
    // 1. FORCE ALL RNW LAYERS TRANSPARENT via global CSS
    // ═══════════════════════════════════════════════════════
    const styleEl = document.createElement('style');
    styleEl.id = 'zion-galactic-styles';
    styleEl.textContent = `
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background-color: #04020c !important;
        overflow: hidden !important;
      }
      #root,
      #root > div,
      #root > div > div,
      #root > div > div > div,
      #root > div > div > div > div,
      #root > div > div > div > div > div,
      #root > div > div > div > div > div > div,
      #root > div > div > div > div > div > div > div,
      #root > div > div > div > div > div > div > div > div {
        background-color: transparent !important;
        background: transparent !important;
      }
      /* Navigation header */
      [data-testid="header-back"],
      header,
      [style*="background-color: rgba(10"] {
        background-color: rgba(10, 12, 28, 0.6) !important;
      }
      /* Warp canvas */
      #zion-warp-canvas {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 0 !important;
        pointer-events: none !important;
      }
      /* HUD grid */
      #zion-hud-grid {
        position: fixed !important;
        top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none !important;
        z-index: 1 !important;
        background-image:
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(0deg, rgba(255,255,255,0.02) 1px, transparent 1px) !important;
        background-size: 80px 80px !important;
        opacity: 0.5;
      }
      /* App content above canvas */
      #root {
        position: relative !important;
        z-index: 2 !important;
      }
      /* Nebula bubbles */
      .zion-nebula {
        position: fixed !important;
        border-radius: 50%;
        pointer-events: none !important;
        z-index: 1 !important;
        mix-blend-mode: screen;
      }
      @keyframes zion-bubble-drift {
        0%   { transform: translate(-50%,-50%) translate3d(0,0,0) scale(0.95); }
        50%  { transform: translate(-50%,-50%) translate3d(12px,-18px,0) scale(1.05); }
        100% { transform: translate(-50%,-50%) translate3d(-10px,22px,0) scale(1); }
      }
    `;
    document.head.appendChild(styleEl);

    // ═══════════════════════════════════════════════════════
    // 2. WARP STARFIELD CANVAS
    // ═══════════════════════════════════════════════════════
    const canvas = document.createElement('canvas');
    canvas.id = 'zion-warp-canvas';
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const w = () => canvas.width / dpr;
    const h = () => canvas.height / dpr;

    const stars = Array.from({length: STAR_COUNT}, () => ({
      x: (Math.random() - 0.5) * w() * 2,
      y: (Math.random() - 0.5) * h() * 2,
      z: Math.random() * w(),
      size: Math.random() * 1.8 + 0.5,
    }));

    let gradient = null;
    const buildGradient = () => {
      gradient = ctx.createRadialGradient(
        w() * 0.4, h() * 0.6, 0,
        w() * 0.4, h() * 0.6, Math.max(w(), h()),
      );
      gradient.addColorStop(0, 'rgba(22, 8, 32, 0.90)');
      gradient.addColorStop(1, 'rgba(4, 2, 12, 0.98)');
    };
    buildGradient();

    // Fill initial background black
    ctx.fillStyle = '#04020c';
    ctx.fillRect(0, 0, w(), h());

    let lastTime = 0;
    const interval = 1000 / 24;
    let raf;

    const animate = (time) => {
      raf = requestAnimationFrame(animate);
      if (time - lastTime < interval) return;
      lastTime = time;

      const cw = w();
      const ch = h();
      const cx = cw / 2;
      const cy = ch / 2;

      ctx.fillStyle = `rgba(0,0,0,${TRAIL_OPACITY})`;
      ctx.fillRect(0, 0, cw, ch);

      ctx.globalAlpha = 0.22;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, cw, ch);
      ctx.globalAlpha = 1;

      ctx.lineCap = 'round';

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const pz = s.z;
        s.z -= SPEED;

        if (s.z <= 0) {
          s.x = (Math.random() - 0.5) * cw * 2;
          s.y = (Math.random() - 0.5) * ch * 2;
          s.z = cw;
          continue;
        }

        const x = (s.x / s.z) * cw + cx;
        const y = (s.y / s.z) * ch + cy;
        const px = (s.x / pz) * cw + cx;
        const py = (s.y / pz) * ch + cy;
        const sz = (1 - s.z / cw) * s.size * 2;
        const a = Math.min(1, 0.15 + (1 - s.z / cw) * 0.85);

        if (x < -20 || x > cw + 20 || y < -20 || y > ch + 20) continue;

        // Warp trail
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${STAR_COLOR[0]},${STAR_COLOR[1]},${STAR_COLOR[2]},${(a * 0.7).toFixed(2)})`;
        ctx.lineWidth = Math.max(0.5, sz * 0.5);
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();

        // Star dot
        ctx.beginPath();
        ctx.fillStyle = `rgba(${STAR_COLOR[0]},${STAR_COLOR[1]},${STAR_COLOR[2]},${Math.min(1, a + 0.15).toFixed(2)})`;
        ctx.arc(x, y, Math.max(sz * 0.65, 0.55), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(animate);

    // ═══════════════════════════════════════════════════════
    // 3. HUD GRID
    // ═══════════════════════════════════════════════════════
    const grid = document.createElement('div');
    grid.id = 'zion-hud-grid';
    document.body.appendChild(grid);

    // ═══════════════════════════════════════════════════════
    // 4. NEBULA BUBBLES
    // ═══════════════════════════════════════════════════════
    const bubbles = NEBULA_BUBBLES.map((b) => {
      const el = document.createElement('div');
      el.className = 'zion-nebula';
      el.style.cssText = `
        width:${b.size}px; height:${b.size}px;
        left:${b.x * 100}%; top:${b.y * 100}%;
        transform:translate(-50%,-50%);
        background:radial-gradient(circle at 30% 30%, ${b.color}, transparent 70%);
        filter:blur(${Math.round(b.size * 0.22)}px);
        opacity:0.6;
        animation:zion-bubble-drift ${b.dur}ms ease-in-out infinite alternate;
      `;
      document.body.appendChild(el);
      return el;
    });

    // ═══════════════════════════════════════════════════════
    // 5. RESIZE
    // ═══════════════════════════════════════════════════════
    const onResize = () => { resize(); buildGradient(); };
    window.addEventListener('resize', onResize);

    console.log('🌌 ZION Galactic Warp Background initialized');

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.remove();
      grid.remove();
      styleEl.remove();
      bubbles.forEach(el => el.remove());
    };
  }, []);

  return null;
});

/** Main wrapper */
const GalacticBackground = ({children, style}) => {
  return (
    <View style={[styles.container, style]}>
      <WarpCanvas />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default memo(GalacticBackground);
