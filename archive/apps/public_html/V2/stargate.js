document.addEventListener("DOMContentLoaded", function() {
  const images = document.querySelectorAll('img[src="./2.png"]');
  const centerImage = document.querySelector('img.rotate1');
  
  console.log("Images found:", images.length);

  // overlay/video ze stránky (pokud existují)
  const overlay = document.getElementById('videoOverlay');
  const video = document.getElementById('promoVideo');
  const skipBtn = document.getElementById('skipBtn');
  let pendingHref = null;

  function ensureVideoSource(src = './w9g.mp4') {
    if (!video) return;
    const s = video.querySelector('source');
    if (!s) {
      const source = document.createElement('source');
      source.src = src;
      source.type = 'video/mp4';
      video.appendChild(source);
      video.load();
    } else if (!s.src) {
      s.src = src;
      video.load();
    }
  }

  function openOverlayAndPlay(href) {
    if (!overlay || !video) {
      // fallback: pokud overlay/video nejsou na stránce, rovnou jít
      window.location.href = href;
      return;
    }
    pendingHref = href;
    ensureVideoSource();
    overlay.style.display = 'flex';
    if (skipBtn) skipBtn.style.display = 'block';
    video.currentTime = 0;
    video.play().catch(() => {
      // pokud prohlížeč zablokuje autoplay se zvukem, zkusíme bez zvuku
      try {
        video.muted = true;
        video.play().catch(()=>{ /* nic */ });
      } catch(e) {}
    });
  }

  images.forEach(image => {
    image.addEventListener("click", function(e) {
      console.log("Image clicked:", image);
      // místo okamžité navigace ukážeme video (pokud existuje)
      e.preventDefault();
      openOverlayAndPlay('./donate.html');
    });
  });

  if (centerImage) {
    centerImage.addEventListener("click", function(e) {
      console.log("Center image clicked:", centerImage);
      e.preventDefault();
      openOverlayAndPlay('./donate.html');
    });
  }

  if (video) {
    video.addEventListener('ended', () => {
      const h = pendingHref || './donate.html';
      pendingHref = null;
      if (overlay) overlay.style.display = 'none';
      window.location.href = h;
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (video) video.pause();
      const h = pendingHref || './donate.html';
      pendingHref = null;
      if (overlay) overlay.style.display = 'none';
      window.location.href = h;
    });
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (video) video.pause();
        const h = pendingHref || './donate.html';
        pendingHref = null;
        overlay.style.display = 'none';
        window.location.href = h;
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') {
      if (video) video.pause();
      const h = pendingHref || './donate.html';
      pendingHref = null;
      overlay.style.display = 'none';
      window.location.href = h;
    }
  });
});