/* ZION Intro starfield background — port of website-v2.9 BackgroundOrchestrator/StarfieldBackground.
   Renders a moving starfield on a fixed full-viewport canvas for each Observatory mode. */
(function () {
  'use strict';

  var canvas = document.getElementById('zion-starfield');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'zion-starfield';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
  }

  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '0';
  canvas.style.pointerEvents = 'none';

  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  var PRESETS = {
    maintenance: {
      starColor: [[252, 209, 22], [228, 30, 43], [7, 137, 48]],
      density: 250,
      speed: 2,
      trailOpacity: 0.08,
      backgroundGradient:
        'radial-gradient(circle at 30% 20%, rgba(228,30,43,0.08) 0%, transparent 40%), ' +
        'radial-gradient(circle at 70% 80%, rgba(7,137,48,0.06) 0%, transparent 40%), ' +
        'radial-gradient(ellipse at bottom, #0a0a0a 0%, #000 100%)',
      lineTrails: true,
      fpsLimit: 24,
      canvasGradient: { x: 0.5, y: 0.7, inner: 'rgba(15, 10, 10, 1)', outer: 'rgba(2, 2, 2, 1)' },
      canvasGradientAlpha: 0.22,
      flowDirection: 'outward'
    },
    'planet-orbit': {
      starColor: [7, 137, 48],
      density: 220,
      speed: 2.4,
      trailOpacity: 0.07,
      backgroundGradient: 'radial-gradient(circle at 60% 10%, rgba(4,30,28,0.92), rgba(2,12,11,0.98))',
      lineTrails: true,
      fpsLimit: 24
    },
    'desktop-agent': {
      starColor: [228, 30, 43],
      density: 180,
      speed: 2.6,
      trailOpacity: 0.06,
      backgroundGradient:
        'radial-gradient(circle at 50% 20%, rgba(10,12,28,0.45), rgba(0,0,0,0.85)), ' +
        'radial-gradient(ellipse at 20% 30%, rgba(228,30,43,0.12), transparent 50%), ' +
        'radial-gradient(ellipse at 80% 70%, rgba(7,137,48,0.08), transparent 50%), ' +
        'rgb(0,0,0)',
      lineTrails: true,
      fpsLimit: 24
    },
    'warp-speed': {
      starColor: [7, 137, 48],
      density: 300,
      speed: 12,
      trailOpacity: 0.05,
      backgroundGradient: 'radial-gradient(ellipse at center, #0a2e2a 0%, #020a0a 100%)',
      lineTrails: true,
      fpsLimit: 30
    },
    'galaxy-core': {
      starColor: [232, 240, 255],
      density: 260,
      speed: 2.8,
      trailOpacity: 0.05,
      backgroundGradient:
        'radial-gradient(circle at 50% 50%, rgba(220,230,255,0.22) 0%, ' +
        'rgba(150,180,240,0.14) 6%, rgba(60,90,160,0.18) 18%, ' +
        'rgba(20,30,70,0.45) 38%, rgba(5,8,24,0.82) 65%, ' +
        'rgba(0,0,0,0.98) 100%)',
      flowDirection: 'inward',
      lineTrails: true,
      fpsLimit: 24
    }
  };

  var state = {
    config: null,
    stars: [],
    animationId: null,
    cachedGradient: null,
    lastFrameTime: 0,
    colorList: [],
    pickColor: null
  };

  function toColorList(starColor) {
    if (!Array.isArray(starColor)) return [[255, 255, 255]];
    if (Array.isArray(starColor[0])) return starColor;
    return [starColor];
  }

  function rebuildGradient() {
    state.cachedGradient = null;
    var cg = state.config && state.config.canvasGradient;
    if (!cg) return;
    var g = ctx.createRadialGradient(
      cg.x * canvas.width, cg.y * canvas.height, 0,
      cg.x * canvas.width, cg.y * canvas.height, Math.max(canvas.width, canvas.height)
    );
    g.addColorStop(0, cg.inner);
    g.addColorStop(1, cg.outer);
    state.cachedGradient = g;
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    rebuildGradient();
  }

  function seedStars() {
    state.stars = [];
    if (!state.config || !canvas) return;
    state.colorList = toColorList(state.config.starColor);
    state.pickColor = function () {
      return state.colorList[Math.floor(Math.random() * state.colorList.length)];
    };
    var hw = canvas.width / 2;
    var hh = canvas.height / 2;
    var area = canvas.width * canvas.height;
    var refArea = 1920 * 1080;
    var density = Math.max(80, Math.round(state.config.density * Math.min(1.25, area / refArea)));
    if (canvas.width < 768) density = Math.round(density * 0.55);
    for (var i = 0; i < density; i++) {
      state.stars.push({
        x: Math.random() * canvas.width - hw,
        y: Math.random() * canvas.height - hh,
        z: Math.random() * canvas.width,
        size: Math.random() * 2 + 0.5,
        px: 0,
        py: 0,
        color: state.pickColor()
      });
    }
  }

  function applyCanvasBackground() {
    if (!state.config || !canvas) return;
    canvas.style.background = state.config.backgroundGradient || 'transparent';
  }

  function drawGradientOverlay() {
    if (!state.cachedGradient || !state.config) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = state.cachedGradient;
    ctx.globalAlpha = state.config.canvasGradientAlpha || 0.22;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  function animate(timestamp) {
    if (!canvas || !ctx || !state.config) return;
    state.animationId = requestAnimationFrame(animate);

    var frameInterval = state.config.fpsLimit > 0 ? 1000 / state.config.fpsLimit : 0;
    if (frameInterval > 0) {
      var delta = timestamp - state.lastFrameTime;
      if (delta < frameInterval) return;
      state.lastFrameTime = timestamp - (delta % frameInterval);
    }

    var trail = state.config.trailOpacity || 0.08;
    ctx.fillStyle = 'rgba(0, 0, 0, ' + Math.min(Math.max(trail * 0.5, 0.01), 0.15) + ')';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGradientOverlay();

    var hw = canvas.width / 2;
    var hh = canvas.height / 2;
    var w = canvas.width;
    var h = canvas.height;
    var speed = state.config.speed || 2;
    var lineTrails = !!state.config.lineTrails;
    var flowDirection = state.config.flowDirection || 'outward';

    for (var i = 0; i < state.stars.length; i++) {
      var star = state.stars[i];
      var prevX = (star.x / star.z) * w + hw;
      var prevY = (star.y / star.z) * h + hh;

      if (flowDirection === 'inward') {
        star.z += speed;
        if (star.z >= w) {
          star.z = Math.random() * 18 + 2;
          star.x = Math.random() * w - hw;
          star.y = Math.random() * h - hh;
          star.px = prevX;
          star.py = prevY;
          star.color = state.pickColor();
          continue;
        }
      } else {
        star.z -= speed;
        if (star.z <= 0) {
          star.z = w;
          star.x = Math.random() * w - hw;
          star.y = Math.random() * h - hh;
          star.px = prevX;
          star.py = prevY;
          star.color = state.pickColor();
          continue;
        }
      }

      var x = (star.x / star.z) * w + hw;
      var y = (star.y / star.z) * h + hh;
      var size = (1 - star.z / w) * star.size * (lineTrails ? 2 : 4);
      var brightness = 1 - star.z / w;
      var alpha = Math.min(1, lineTrails ? 0.08 + brightness * 0.92 : 0.55 + brightness * 0.45);

      var r = star.color[0];
      var g = star.color[1];
      var b = star.color[2];

      if (lineTrails) {
        ctx.strokeStyle = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
        ctx.lineWidth = Math.max(0.5, size * 0.5);
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + Math.min(1, alpha + 0.15) + ')';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(size * 0.65, 0.55), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(size, 1.0), 0, Math.PI * 2);
        ctx.fill();
      }

      star.px = x;
      star.py = y;
    }
  }

  function onResize() {
    resize();
    seedStars();
  }

  function setMode(mode) {
    if (!PRESETS[mode]) mode = 'maintenance';
    state.config = PRESETS[mode];

    if (state.animationId) cancelAnimationFrame(state.animationId);

    applyCanvasBackground();
    resize();
    seedStars();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.lastFrameTime = 0;
    state.animationId = requestAnimationFrame(animate);
  }

  window.addEventListener('resize', onResize);
  window.setStarfieldMode = setMode;

  var savedMode = null;
  try { savedMode = window.localStorage.getItem('zion_bg'); } catch (e) {}
  setMode(savedMode || 'maintenance');
})();
