/* ═══════════════════════════════════════════════════════════
   ZionOS Warp Starfield — 3D perspective star tunnel
   Ported from website-v2.9 StarfieldBackground.tsx
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const canvas = document.getElementById('warp-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Respect reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ── Config ──
  const DENSITY    = 260;
  const SPEED      = 1.8;
  const TRAIL      = 0.08;   // lower = longer trails
  const COLOR      = [255, 215, 0]; // gold

  // Secondary color for depth variation
  const COLOR2     = [147, 51, 234]; // purple
  const COLOR3     = [6, 182, 212];  // cyan

  const stars = [];
  let W, H, animId;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function seed() {
    stars.length = 0;
    for (let i = 0; i < DENSITY; i++) {
      stars.push({
        x: Math.random() * W - W / 2,
        y: Math.random() * H - H / 2,
        z: Math.random() * W,
        size: Math.random() * 2 + 0.5,
        // Each star gets a random color blend
        colorMix: Math.random(),
      });
    }
  }

  function pickColor(mix, alpha) {
    let r, g, b;
    if (mix < 0.6) {
      // Gold (majority)
      r = COLOR[0]; g = COLOR[1]; b = COLOR[2];
    } else if (mix < 0.85) {
      // Purple
      r = COLOR2[0]; g = COLOR2[1]; b = COLOR2[2];
    } else {
      // Cyan
      r = COLOR3[0]; g = COLOR3[1]; b = COLOR3[2];
    }
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function animate() {
    // Motion blur: semi-transparent black overlay
    ctx.fillStyle = `rgba(6, 8, 18, ${TRAIL})`;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];

      // Move star toward viewer
      s.z -= SPEED;

      // Reset when it passes the viewer
      if (s.z <= 0) {
        s.z = W;
        s.x = Math.random() * W - W / 2;
        s.y = Math.random() * H - H / 2;
        s.colorMix = Math.random();
      }

      // 3D → 2D perspective projection
      const sx = (s.x / s.z) * W + W / 2;
      const sy = (s.y / s.z) * H + H / 2;

      // Skip if off-screen
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;

      const depth = 1 - s.z / W;
      const size = depth * s.size * 2.5;
      const alpha = Math.min(1, 0.1 + depth * 0.9);

      // Draw streak/trail for fast stars close to camera
      if (depth > 0.5 && SPEED > 1) {
        const prevZ = s.z + SPEED * 3;
        const px = (s.x / prevZ) * W + W / 2;
        const py = (s.y / prevZ) * H + H / 2;

        ctx.strokeStyle = pickColor(s.colorMix, alpha * 0.4);
        ctx.lineWidth = Math.max(size * 0.5, 0.3);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }

      // Draw star point
      ctx.fillStyle = pickColor(s.colorMix, alpha);
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(size, 0.3), 0, Math.PI * 2);
      ctx.fill();

      // Glow for bright nearby stars
      if (depth > 0.7) {
        ctx.fillStyle = pickColor(s.colorMix, alpha * 0.15);
        ctx.beginPath();
        ctx.arc(sx, sy, size * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    animId = requestAnimationFrame(animate);
  }

  // ── Init ──
  resize();
  seed();
  animate();

  window.addEventListener('resize', () => { resize(); seed(); });

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    if (animId) cancelAnimationFrame(animId);
  });

  // Expose speed control for theme changes
  window.warpSetSpeed = function (newSpeed) {
    // dynamically adjust — not used yet but ready for theme switching
  };
})();
