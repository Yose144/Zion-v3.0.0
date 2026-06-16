document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('videoOverlay');
  const skipBtn = document.getElementById('skipBtn');
  // vždy skrytý při startu
  if (overlay) { overlay.style.display = 'none'; overlay.style.pointerEvents = 'auto'; }
  if (skipBtn) skipBtn.style.display = 'none';
  // reset pending navigace
  window.pendingHref = null;
});

document.addEventListener('DOMContentLoaded', () => {
  // mapování id obrázku -> video soubor
  const videoMap = {
    'nirvana': './video/Nirvana.mp4',
    'kundun': './video/Kundun.mp4',
    'hloupa': './video/Hloupa.mp4',
    'heart': './video/HeartSutra.mp4',
    'intro': './video/w9g.mp4',
    'kalacakra': './video/Start.mp4',

    // přidej další položky podle potřeby
  };

  document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('promoVideo');
    const overlay = document.getElementById('videoOverlay');
    const playBtn = document.getElementById('playBtn');
    const rewBtn = document.getElementById('rewBtn');
    const fwdBtn = document.getElementById('fwdBtn');
    const progress = document.getElementById('progress');
    const timeDisplay = document.getElementById('timeDisplay');
    const skipBtn = document.getElementById('skipBtn');

    function formatTime(s){
      if (!isFinite(s)) return '00:00';
      const m = Math.floor(s/60).toString().padStart(2,'0');
      const sec = Math.floor(s%60).toString().padStart(2,'0');
      return `${m}:${sec}`;
    }

    // nastaví posuvník podle délky videa
    video.addEventListener('loadedmetadata', () => {
      progress.max = 100;
      timeDisplay.textContent = `${formatTime(0)} / ${formatTime(video.duration)}`;
    });

    // aktualizace při přehrávání
    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        const pct = (video.currentTime / video.duration) * 100;
        progress.value = pct;
        timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
      }
    });

    // posun pomocí posuvníku (seek)
    let seeking = false;
    progress.addEventListener('input', (e) => {
      seeking = true;
      const pct = parseFloat(e.target.value);
      if (video.duration) {
        timeDisplay.textContent = `${formatTime((pct/100)*video.duration)} / ${formatTime(video.duration)}`;
      }
    });
    progress.addEventListener('change', (e) => {
      if (video.duration) {
        video.currentTime = (parseFloat(e.target.value)/100) * video.duration;
      }
      seeking = false;
    });

    // play/pause
    playBtn.addEventListener('click', () => {
      if (video.paused) {
        video.play().catch(()=>{/* autoplay blocked */});
      } else {
        video.pause();
      }
      playBtn.textContent = video.paused ? 'Play' : 'Pause';
    });
    video.addEventListener('play', () => playBtn.textContent = 'Pause');
    video.addEventListener('pause', () => playBtn.textContent = 'Play');

    // rewind / forward 10s
    rewBtn.addEventListener('click', () => {
      video.currentTime = Math.max(0, video.currentTime - 10);
    });
    fwdBtn.addEventListener('click', () => {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
    });

    // stop overlay + navigace (přeskočit)
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      video.pause();
      overlay.style.display = 'none';
      // pokud máš pendingHref, naviguj zde (zůstatkové chování z existujícího skriptu)
      if (window.pendingHref) window.location.assign(window.pendingHref);
    });

    // pokud klikneš mimo video, zavřít a navigovat
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        video.pause();
        overlay.style.display = 'none';
        if (window.pendingHref) window.location.assign(window.pendingHref);
      }
    });

    // ESC zavře
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.style.display === 'flex') {
        video.pause();
        overlay.style.display = 'none';
        if (window.pendingHref) window.location.assign(window.pendingHref);
      }
    });
  });
const overlay = document.getElementById('videoOverlay');
  const video = document.getElementById('promoVideo');
  const skipBtn = document.getElementById('skipBtn');
  const source = video ? video.querySelector('source') : null;
  let pendingHref = null;

  function resolveHref(anchor) {
    if (!anchor) return null;
    const attr = anchor.getAttribute('href');
    try {
      // vytvoří absolutní URL i z relativní cesty
      return new URL(attr || anchor.href, document.baseURI).href;
    } catch (e) {
      console.warn('resolveHref error', e, attr, anchor.href);
      return anchor.href || attr || null;
    }
  }

  // najdi obrázky podle mapy a přidej obsluhu
  Object.keys(videoMap).forEach(id => {
    const img = document.getElementById(id);
    if (!img) return;
    const anchor = img.closest('a');

    // zabráníme, aby <a> navigovalo okamžitě při kliknutí na obrázek
    if (anchor) anchor.addEventListener('click', e => e.preventDefault());

    img.style.cursor = 'pointer';
    img.addEventListener('click', (e) => {
      e.preventDefault();
      pendingHref = resolveHref(anchor);
      console.log('click', id, 'pendingHref=', pendingHref, 'video=', videoMap[id]);
      const src = videoMap[id];
      if (!src || !video || !source) {
        if (pendingHref) {
          console.log('No video -> direct navigate to', pendingHref);
          window.location.assign(pendingHref);
        }
        return;
      }
      source.src = src;
      video.load();
      overlay.style.display = 'flex';
      if (skipBtn) skipBtn.style.display = 'block';
      video.currentTime = 0;
      video.muted = false;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(()=>{ console.warn('Autoplay blocked'); });
      });
    });
  });

  function navigateToPending() {
    if (!pendingHref) {
      console.log('navigateToPending: no pendingHref');
      pendingHref = null;
      return;
    }
    const href = pendingHref;
    pendingHref = null;
    console.log('Navigating to', href);
    // malé zpoždění, aby se overlay skryl a video pauznulo
    setTimeout(() => { window.location.assign(href); }, 60);
  }

  if (video) {
    video.addEventListener('ended', () => {
      if (overlay) overlay.style.display = 'none';
      if (skipBtn) skipBtn.style.display = 'none';
      navigateToPending();
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (video) video.pause();
      if (overlay) overlay.style.display = 'none';
      if (skipBtn) skipBtn.style.display = 'none';
      navigateToPending();
    });
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (video) video.pause();
        if (overlay) overlay.style.display = 'none';
        if (skipBtn) skipBtn.style.display = 'none';
        navigateToPending();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') {
      if (video) video.pause();
      if (overlay) overlay.style.display = 'none';
      if (skipBtn) skipBtn.style.display = 'none';
      navigateToPending();
    }
  });

  console.log('videoMap keys', Object.keys(videoMap));
});

(function initVideoControls(){
  const video = document.getElementById('promoVideo');
  if (!video) {
    console.warn('video.js: #promoVideo not found — kontrola main.html overlayu.');
    return;
  }
  const overlay = document.getElementById('videoOverlay');
  const playBtn = document.getElementById('playBtn');
  const rewBtn = document.getElementById('rewBtn');
  const fwdBtn = document.getElementById('fwdBtn');
  const progress = document.getElementById('progress');
  const timeDisplay = document.getElementById('timeDisplay');
  const skipBtn = document.getElementById('skipBtn');

  // bezpečnostní fallback — některé elementy mohou chybět
  function $(el){ return document.getElementById(el); }

  function formatTime(s){
    if (!isFinite(s)) return '00:00';
    const m = Math.floor(s/60).toString().padStart(2,'0');
    const sec = Math.floor(s%60).toString().padStart(2,'0');
    return `${m}:${sec}`;
  }

  // inicializace UI po načtení metadat
  video.addEventListener('loadedmetadata', () => {
    if (timeDisplay) timeDisplay.textContent = `${formatTime(0)} / ${formatTime(video.duration)}`;
    if (progress) progress.value = 0;
  });

  // aktualizace progressu při přehrávání
  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    if (progress && !progress.dragging) progress.value = pct;
    if (timeDisplay) timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  });

  // seek: zobrazit pozici při posunu a provést seek při uvolnění
  if (progress) {
    progress.addEventListener('input', (e) => {
      progress.dragging = true;
      const pct = parseFloat(e.target.value || 0);
      if (video.duration && timeDisplay) {
        timeDisplay.textContent = `${formatTime((pct/100)*video.duration)} / ${formatTime(video.duration)}`;
      }
    });
    progress.addEventListener('change', (e) => {
      progress.dragging = false;
      if (!video.duration) return;
      const pct = parseFloat(e.target.value || 0);
      video.currentTime = (pct / 100) * video.duration;
    });
  }

  // play/pause tlačítko
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (video.paused) video.play().catch(()=>{});
      else video.pause();
    });
    video.addEventListener('play', () => { if (playBtn) playBtn.textContent = 'Pause'; });
    video.addEventListener('pause', () => { if (playBtn) playBtn.textContent = 'Play'; });
  }

  // rewind / forward
  if (rewBtn) rewBtn.addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 10); });
  if (fwdBtn) fwdBtn.addEventListener('click', () => { video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10); });

  // dokončení videa -> navigace (pokud window.pendingHref nastaveno)
  video.addEventListener('ended', () => {
    if (overlay) overlay.style.display = 'none';
    if (skipBtn) skipBtn.style.display = 'none';
    const h = window.pendingHref || null;
    window.pendingHref = null;
    if (h) window.location.assign(h);
  });

  // skip tlačítko
  if (skipBtn) {
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      video.pause();
      if (overlay) overlay.style.display = 'none';
      skipBtn.style.display = 'none';
      const h = window.pendingHref || null;
      window.pendingHref = null;
      if (h) window.location.assign(h);
    });
  }

  // klik mimo video zavře a naviguje
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        video.pause();
        if (overlay) overlay.style.display = 'none';
        if (skipBtn) skipBtn.style.display = 'none';
        const h = window.pendingHref || null;
        window.pendingHref = null;
        if (h) window.location.assign(h);
      }
    });
  }

  // Esc zavře
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') {
      video.pause();
      if (overlay) overlay.style.display = 'none';
      if (skipBtn) skipBtn.style.display = 'none';
      const h = window.pendingHref || null;
      window.pendingHref = null;
      if (h) window.location.assign(h);
    }
  });

  // veřejná funkce pro spuštění videa (použij z jiného skriptu)
  window.openVideoWithControls = function(src, href){
    const s = video.querySelector('source');
    if (s) s.src = src;
    video.load();
    window.pendingHref = href || null;
    if (overlay) overlay.style.display = 'flex';
    if (skipBtn) skipBtn.style.display = 'inline-block';
    video.currentTime = 0;
    video.muted = false;
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(()=>{ console.warn('Autoplay blocked'); });
    });
  };

  console.log('video.js: controls initialized');
})();