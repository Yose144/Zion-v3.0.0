/* ════════════════════════════════════════════════════════════════
   ZION FREE WORLD — site.js
   i18n (CS/EN), reveal animations, planetary map (Leaflet + Esri),
   live L5 data via same-origin /api/free-world proxy, QV ballots.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── i18n ─────────────────────────────────────────────────── */
  var I18N = {
    cs: {
      'nav.projects': 'Projekty', 'nav.map': 'Mapa', 'nav.fund': 'Fond', 'nav.qv': 'Hlasování',
      'nav.docs': 'Dokumentace',
      'nav.app': 'Otevřít app',
      'hero.kicker': 'L5 · Free World · Terra Nova',
      'hero.title': 'Svět, kde se blockchain <em>setkává s půdou</em>',
      'hero.tagline': 'Sedm financovaných bodů, vize Uluru a Boa Esperança, plující uzel María del Camino — a Ekam, chrám v Indii, který už stojí jako předloha všem ostatním. 5 % z každého bloku do humanitárního fondu. Reálná místa na reálné planetě — od Algarve po Mys dobré naděje.',
      'hero.badge1': '10 bodů', 'hero.badge2': '5 % každého bloku', 'hero.badge3': 'L5 Free World',
      'ticker.label': 'Nasbíráno do fondu', 'ticker.block': 'blok', 'ticker.offline': 'tracker offline',
      'projects.kicker': 'Zakládající komunity',
      'projects.title': 'Deset bodů sítě',
      'projects.lead': 'Každá komunita je skutečný pozemek, reálný tým a veřejný rozpočet z L5 fondu. Vyber projekt pro plný masterplan, fáze rozvoje a governance model.',
      'projects.more': 'Otevřít projekt →',
      'status.development': 'Aktivní rozvoj', 'status.preparation': 'V přípravě', 'status.vision': 'Plánováno', 'status.built': 'Postaveno',
      'status.allprep': 'Financované komunity — příprava do 2028 · stavba od 2029 · flotila ve výzkumné fázi',
      'map.kicker': 'Planetární mapa',
      'map.title': 'Od Algarve po otevřený oceán',
      'map.lead': 'Devět geografických uzlů napříč kontinenty — Evropa, Afrika, Amerika, Polynésie, Asie, Austrálie — a flotila Tres Marias — tři lodě nesoucí tři zjevení kolem tří oceánů.',
      'map.loading': 'Načítám mapu…', 'map.legend': 'Stav komunit',
      'fund.kicker': 'Živá pokladna',
      'fund.title': '5 % z každého bloku → L5 fond',
      'fund.lead': 'Každý vytěžený blok ZION posílá 5 % odměny do humanitárního fondu L5. Tracker čte data přímo z chain scanneru — žádné projekce, jen skutečné tok.',
      'fund.acc': 'Nasbíráno', 'fund.disb': 'Vyplaceno', 'fund.block': 'Poslední blok', 'fund.updated': 'Aktualizováno',
      'registry.kicker': 'Registr',
      'registry.title': 'Projekty & granty',
      'registry.lead': 'Živý registr projektů a žádostí o financování z L5 fondu — rozpočty, stavy a řízení.',
      'registry.project': 'Projekt', 'registry.budget': 'Rozpočet', 'registry.status': 'Stav',
      'registry.grant': 'Grant', 'registry.amount': 'Částka', 'registry.applicant': 'Žadatel',
      'registry.empty': 'Registr se naplňuje…', 'registry.offline': 'Registr je momentálně nedostupný.',
      'qv.kicker': 'Kvadratické hlasování',
      'qv.title': 'Komunita radí, DAO rozhoduje',
      'qv.lead': 'QV je poradní hlasování o alokaci L5 fondu — každý hlas stojí hlasy² kreditů, takže široká shoda poráží jeden silný zájem. Výsledek doporučuje DAO; výplata zůstává pod DAO návrhem, timelockem a guardian multisig.',
      'qv.credits': 'kreditů', 'qv.pool': 'matching pool', 'qv.ballots': 'hlasů',
      'qv.cost': 'cena', 'qv.spent': 'Využito', 'qv.remaining': 'Zbývá',
      'qv.submit': 'Odeslat hlasování', 'qv.submitting': 'Odesílám…',
      'qv.signin': 'Pro hlasování se přihlas přes ZIS',
      'qv.success': 'Hlasování přijato — děkujeme za účast.',
      'qv.err': 'Hlasování se nepodařilo odeslat.',
      'qv.budget': 'Překročen rozpočet kreditů.',
      'qv.empty': 'Zatím žádné otevřené kolo.',
      'qv.offline': 'Hlasování je momentálně nedostupné.',
      'qv.requested': 'požadováno', 'qv.open': 'Otevřené',
      'cta.title': 'Země potřebuje ruce. Síť potřebuje strážce.',
      'cta.lead': 'Od glampingu v Genesis Garden po guardian nody — každý uzel začíná lidmi, kteří přijedou a pomohou.',
      'cta.app': 'Otevřít ZION app', 'cta.intro': 'zpět na zionterranova.com',
      'footer.brand': 'ZION Free World',
      'footer.explore': 'Prozkoumat', 'footer.network': 'Síť', 'footer.docs': 'Dokumenty',
      'footer.note': '© ZION Terra Nova · L5 Free World · Data z live chain scanneru. QV je poradní — výplaty řídí DAO.',
      'footer.portal': 'Aplikační portál', 'footer.intro': 'Intro', 'footer.dao': 'DAO', 'footer.explorer': 'Explorer',
      'doc.title': 'Dokumentace projektu', 'doc.note': 'Kompletní plán — koncept, infrastruktura, fáze a governance.',
      'docs.kicker': 'Znalostní báze L5',
      'docs.title': 'Dokumentace Free World',
      'docs.lead': 'Kompletní veřejná dokumentace L5 — architektura fyzických komunit, governance, protokoly péče a technická specifikace uzlů.',
      'docs.back': '← Dokumentace',
      'docs.enonly': 'Dokumentace je vedená v angličtině; česká verze projektových plánů je na stránkách jednotlivých komunit.',
      'board.title': 'Masterplan board', 'board.note': 'Klikni pro zvětšení.',
      'meta.status': 'Stav', 'meta.location': 'Lokace', 'meta.grant': 'Zakládající grant', 'meta.budget': 'Rozpočet projektu',
      'meta.timeline': 'Časový plán',
      'nav.back': '← Všechny projekty', 'nav.prev': '← Předchozí', 'nav.next': 'Další →',
    },
    en: {
      'nav.projects': 'Projects', 'nav.map': 'Map', 'nav.fund': 'Fund', 'nav.qv': 'Voting',
      'nav.docs': 'Docs',
      'nav.app': 'Open app',
      'hero.kicker': 'L5 · Free World · Terra Nova',
      'hero.title': 'A world where blockchain <em>meets the soil</em>',
      'hero.tagline': 'Seven funded sites, the Uluru and Boa Esperança visions, the María del Camino sailing node — and Ekam, the temple in India that already stands as the template for all of them. 5% of every block into the humanitarian fund. Real places on a real planet — from the Algarve to the Cape of Good Hope.',
      'hero.badge1': '10 nodes', 'hero.badge2': '5% of every block', 'hero.badge3': 'L5 Free World',
      'ticker.label': 'Accumulated in the fund', 'ticker.block': 'block', 'ticker.offline': 'tracker offline',
      'projects.kicker': 'Founding communities',
      'projects.title': 'Ten points of the network',
      'projects.lead': 'Every community is real land, a real team and a public budget from the L5 fund. Pick a project for the full masterplan, development phases and governance model.',
      'projects.more': 'Open project →',
      'status.development': 'Active development', 'status.preparation': 'In preparation', 'status.vision': 'Planned', 'status.built': 'Built',
      'status.allprep': 'Funded communities — preparation until 2028 · construction from 2029 · fleet in research phase',
      'map.kicker': 'Planetary map',
      'map.title': 'From the Algarve to the open ocean',
      'map.lead': 'Nine geographic nodes across continents — Europe, Africa, the Americas, Polynesia, Asia, Australia — and the Tres Marias fleet — three ships carrying three apparitions across three oceans.',
      'map.loading': 'Loading map…', 'map.legend': 'Community status',
      'fund.kicker': 'Live treasury',
      'fund.title': '5% of every block → the L5 fund',
      'fund.lead': 'Every mined ZION block sends 5% of the reward into the L5 humanitarian fund. The tracker reads data straight from the chain scanner — no projections, only real flow.',
      'fund.acc': 'Accumulated', 'fund.disb': 'Disbursed', 'fund.block': 'Last block', 'fund.updated': 'Updated',
      'registry.kicker': 'Registry',
      'registry.title': 'Projects & grants',
      'registry.lead': 'The live registry of projects and funding requests from the L5 fund — budgets, states and review.',
      'registry.project': 'Project', 'registry.budget': 'Budget', 'registry.status': 'Status',
      'registry.grant': 'Grant', 'registry.amount': 'Amount', 'registry.applicant': 'Applicant',
      'registry.empty': 'The registry is being populated…', 'registry.offline': 'The registry is temporarily unavailable.',
      'qv.kicker': 'Quadratic voting',
      'qv.title': 'The community advises, the DAO decides',
      'qv.lead': 'QV is the advisory vote on L5 fund allocation — each vote costs votes² credits, so broad consensus beats a single strong interest. The outcome advises the DAO; disbursement stays gated by a DAO proposal, timelock and guardian multisig.',
      'qv.credits': 'credits', 'qv.pool': 'matching pool', 'qv.ballots': 'ballots',
      'qv.cost': 'cost', 'qv.spent': 'Spent', 'qv.remaining': 'Remaining',
      'qv.submit': 'Cast ballot', 'qv.submitting': 'Submitting…',
      'qv.signin': 'Sign in with ZIS to vote',
      'qv.success': 'Ballot accepted — thank you for participating.',
      'qv.err': 'The ballot could not be submitted.',
      'qv.budget': 'Credit budget exceeded.',
      'qv.empty': 'No open round yet.',
      'qv.offline': 'Voting is temporarily unavailable.',
      'qv.requested': 'requested', 'qv.open': 'Open',
      'cta.title': 'The land needs hands. The network needs guardians.',
      'cta.lead': 'From glamping at Genesis Garden to guardian nodes — every node begins with people who show up and help.',
      'cta.app': 'Open the ZION app', 'cta.intro': 'back to zionterranova.com',
      'footer.brand': 'ZION Free World',
      'footer.explore': 'Explore', 'footer.network': 'Network', 'footer.docs': 'Docs',
      'footer.note': '© ZION Terra Nova · L5 Free World · Data from the live chain scanner. QV is advisory — disbursement is governed by the DAO.',
      'footer.portal': 'App portal', 'footer.intro': 'Intro', 'footer.dao': 'DAO', 'footer.explorer': 'Explorer',
      'doc.title': 'Project documentation', 'doc.note': 'The complete plan — concept, infrastructure, phases and governance.',
      'docs.kicker': 'L5 knowledge base',
      'docs.title': 'Free World Documentation',
      'docs.lead': 'The complete public L5 documentation — physical community architecture, governance, stewardship protocols and node technical specs.',
      'docs.back': '← Documentation',
      'docs.enonly': '',
      'board.title': 'Masterplan board', 'board.note': 'Click to zoom.',
      'meta.status': 'Status', 'meta.location': 'Location', 'meta.grant': 'Founding grant', 'meta.budget': 'Project budget',
      'meta.timeline': 'Timeline',
      'nav.back': '← All projects', 'nav.prev': '← Previous', 'nav.next': 'Next →',
    },
  };

  var lang = (function () {
    var m = location.search.match(/[?&]lang=(cs|en)/);
    if (m) return m[1];
    try { return localStorage.getItem('fw-lang') || 'cs'; } catch (e) { return 'cs'; }
  })();

  function t(key) { return (I18N[lang] && I18N[lang][key]) || key; }
  window.FW_T = t;
  window.FW_LANG = lang;

  function applyI18n() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      var v = t(k);
      if (v !== k) el.innerHTML = v;
    });
    document.querySelectorAll('[data-lang-show]').forEach(function (el) {
      el.classList.toggle('fw-hidden', el.getAttribute('data-lang-show') !== lang);
    });
    document.querySelectorAll('.fw-lang button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.lang === lang);
    });
  }
  window.FW_SETLANG = function (l) {
    lang = l;
    try { localStorage.setItem('fw-lang', l); } catch (e) {}
    window.FW_LANG = l;
    applyI18n();
  };

  /* ── Reveal on scroll ─────────────────────────────────────── */
  function initReveal() {
    var els = document.querySelectorAll('.fw-reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -40px' });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ── Formatting ───────────────────────────────────────────── */
  function fmtZion(flowers) {
    var z = (Number(flowers) || 0) / 1e6;
    return z.toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US', { maximumFractionDigits: 0 });
  }
  window.FW_FMT = fmtZion;

  /* ── Live fund ────────────────────────────────────────────── */
  function pollFund() {
    fetch('/api/free-world/fund/balance', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (env) {
        if (!env || !env.success) throw new Error('bad');
        var d = env.data;
        document.querySelectorAll('[data-fund-acc]').forEach(function (el) { el.textContent = fmtZion(d.total_accumulated); });
        document.querySelectorAll('[data-fund-disb]').forEach(function (el) { el.textContent = fmtZion(d.total_disbursed); });
        document.querySelectorAll('[data-fund-block]').forEach(function (el) { el.textContent = Number(d.last_block_height).toLocaleString(); });
        document.querySelectorAll('[data-fund-updated]').forEach(function (el) {
          el.textContent = new Date(d.updated_at).toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US');
        });
        document.querySelectorAll('[data-fund-dot]').forEach(function (el) { el.classList.remove('off'); });
      })
      .catch(function () {
        document.querySelectorAll('[data-fund-dot]').forEach(function (el) { el.classList.add('off'); });
      });
  }

  /* ── Registry ─────────────────────────────────────────────── */
  function pollRegistry() {
    var pj = document.querySelector('[data-registry-projects]');
    var gr = document.querySelector('[data-registry-grants]');
    if (!pj && !gr) return;
    Promise.all([
      fetch('/api/free-world/projects', { cache: 'no-store' }).then(function (r) { return r.json(); }),
      fetch('/api/free-world/grants', { cache: 'no-store' }).then(function (r) { return r.json(); }),
    ]).then(function (rs) {
      if (pj && rs[0].success) {
        var rows = rs[0].data.map(function (p) {
          return '<tr><td><strong>' + esc(p.name) + '</strong><br><span class="fw-muted" style="font-size:.74rem">' + esc(p.location || '') + '</span></td>' +
            '<td>' + fmtZion(p.budget_zion) + ' ZION</td>' +
            '<td><span class="fw-badge ' + esc(p.status) + '">' + esc(p.status) + '</span></td></tr>';
        }).join('');
        pj.innerHTML = rows || '<tr><td colspan="3" class="fw-muted">' + t('registry.empty') + '</td></tr>';
      }
      if (gr && rs[1].success) {
        var rows2 = rs[1].data.map(function (g) {
          return '<tr><td><strong>' + esc(g.title) + '</strong><br><span class="fw-muted" style="font-size:.74rem">' + esc(g.applicant_name || g.category || '') + '</span></td>' +
            '<td>' + fmtZion(g.amount_zion) + ' ZION</td>' +
            '<td><span class="fw-badge ' + esc(g.status) + '">' + esc(g.status) + '</span></td></tr>';
        }).join('');
        gr.innerHTML = rows2 || '<tr><td colspan="3" class="fw-muted">' + t('registry.empty') + '</td></tr>';
      }
    }).catch(function () {
      if (pj) pj.innerHTML = '<tr><td colspan="3" class="fw-muted">' + t('registry.offline') + '</td></tr>';
      if (gr) gr.innerHTML = '<tr><td colspan="3" class="fw-muted">' + t('registry.offline') + '</td></tr>';
    });
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ── Map (Leaflet, visibility-gated, Esri dark canvas) ────── */
  function initMap() {
    var el = document.getElementById('fw-map');
    if (!el) return;
    var sites = window.FW_SITES || [];
    var started = false;
    var io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; }) || started) return;
      started = true; io.disconnect();
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
      s.onload = function () { buildMap(el, sites); };
      s.onerror = function () { el.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#9aa0a8;font-size:.85rem">map unavailable</div>'; };
      document.head.appendChild(s);
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }, { rootMargin: '240px' });
    io.observe(el);
  }

  function buildMap(el, sites) {
    var map = L.map(el, { scrollWheelZoom: false, minZoom: 2, maxZoom: 8, worldCopyJump: true });
    map.setView([22, -15], 2);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 12, attribution: 'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ',
    }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 12,
    }).addTo(map);
    var bounds = [];
    sites.forEach(function (s) {
      bounds.push([s.lat, s.lon]);
      var icon = L.divIcon({
        className: 'fw-map-marker',
        html: '<span class="fw-dot" style="--dot:' + s.accent + '"></span>',
        iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -12],
      });
      L.marker([s.lat, s.lon], { icon: icon, title: s.name }).addTo(map).bindPopup(
        '<div class="fw-popup"><strong>' + esc(s.name) + '</strong>' +
        '<span style="color:#9aa0a8;font-size:.74rem">' + esc(s.location[lang] || s.location.cs) + '</span>' +
        '<a href="/p/' + s.slug + '/">' + t('projects.more') + '</a></div>',
        { closeButton: false }
      );
    });
    if (bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.35));
    requestAnimationFrame(function () { map.invalidateSize(); });
    setTimeout(function () { map.invalidateSize(); }, 400);
  }

  /* ── QV ballots ───────────────────────────────────────────── */
  function initQV() {
    var box = document.getElementById('fw-qv');
    if (!box) return;
    fetch('/api/free-world/rounds', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (env) {
        if (!env || !env.success) throw new Error('bad');
        var open = (env.data || []).filter(function (r) { return r.status === 'open'; });
        if (!open.length) { box.innerHTML = '<p class="fw-muted">' + t('qv.empty') + '</p>'; return; }
        var round = open[0];
        return fetch('/api/free-world/rounds/' + round.id, { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (env2) {
            if (!env2 || !env2.success) throw new Error('bad');
            renderQV(box, env2.data);
          });
      })
      .catch(function () { box.innerHTML = '<p class="fw-muted">' + t('qv.offline') + '</p>'; });
  }

  function renderQV(box, round) {
    var votes = {};
    var grants = round.grants || [];
    var credits = round.credits_per_voter || 0;
    function spent() { return Object.keys(votes).reduce(function (s, k) { return s + votes[k] * votes[k]; }, 0); }

    var html = '<div class="fw-qv-round">' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:.6rem;align-items:baseline">' +
      '<h3 style="font-family:var(--serif);color:#fff;font-size:1.25rem">' + esc(round.title) + '</h3>' +
      '<span class="fw-badge open">' + t('qv.open') + '</span></div>' +
      '<p class="fw-muted" style="font-size:.78rem;margin-top:.3rem">' + credits + ' ' + t('qv.credits') + ' · ' + fmtZion(round.matching_pool_zion) + ' ZION ' + t('qv.pool') + ' · ' + (round.ballot_count || 0) + ' ' + t('qv.ballots') + '</p>' +
      '<div class="fw-qv-grants">';
    grants.forEach(function (g) {
      html += '<div class="fw-qv-grant"><div class="name">' + esc(g.title) +
        '<small>' + esc(g.category || '') + ' · ' + fmtZion(g.amount_zion) + ' ZION ' + t('qv.requested') + '</small></div>' +
        '<div class="fw-qv-stepper"><button data-d="-1" data-g="' + g.id + '" aria-label="-">−</button>' +
        '<span class="v" data-v="' + g.id + '">0</span>' +
        '<button data-d="1" data-g="' + g.id + '" aria-label="+">+</button></div>' +
        '<div class="fw-qv-cost"><span data-c="' + g.id + '">0</span> ' + t('qv.cost') + '</div></div>';
    });
    html += '</div>' +
      '<div class="fw-meter"><div data-meter style="width:0%"></div></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:.72rem;color:#9aa0a8;margin-top:.35rem">' +
      '<span>' + t('qv.spent') + ': <b data-spent>0</b> / ' + credits + ' ' + t('qv.credits') + '</span>' +
      '<span>' + t('qv.remaining') + ': <b data-left>' + credits + '</b></span></div>' +
      '<div class="fw-qv-actions"><button class="fw-btn fw-btn-gold" data-submit disabled>' + t('qv.submit') + '</button>' +
      '<a class="fw-btn fw-btn-ghost" href="https://app.zionterranova.com/login?next=' + encodeURIComponent('https://freeworld.zionterranova.com/#qv') + '" data-signin>' + t('qv.signin') + '</a>' +
      '<span class="fw-qv-msg" data-msg></span></div></div>';

    box.innerHTML = html;

    var btn = box.querySelector('[data-submit]');
    var msg = box.querySelector('[data-msg]');
    var signin = box.querySelector('[data-signin]');

    // Resolve auth state: authenticated users see the submit button only.
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (u) { if (u && u.id) { signin.classList.add('fw-hidden'); } else { btn.classList.add('fw-hidden'); } })
      .catch(function () { btn.classList.add('fw-hidden'); });

    function refresh() {
      var s = spent();
      box.querySelector('[data-spent]').textContent = s;
      box.querySelector('[data-left]').textContent = credits - s;
      box.querySelector('[data-meter]').style.width = Math.min(100, (s / Math.max(1, credits)) * 100) + '%';
      btn.disabled = s === 0 || s > credits;
      box.querySelectorAll('[data-g]').forEach(function (b) {
        var g = b.dataset.g, d = +b.dataset.d, v = votes[g] || 0;
        b.disabled = d < 0 ? v === 0 : s + 2 * v + 1 > credits;
      });
    }

    box.querySelectorAll('[data-g]').forEach(function (b) {
      b.addEventListener('click', function () {
        var g = b.dataset.g, d = +b.dataset.d;
        var v = Math.max(0, (votes[g] || 0) + d);
        if (d > 0 && spent() - (votes[g] || 0) * (votes[g] || 0) + v * v > credits) return;
        votes[g] = v;
        box.querySelector('[data-v="' + g + '"]').textContent = v;
        box.querySelector('[data-c="' + g + '"]').textContent = v * v;
        refresh();
      });
    });

    btn.addEventListener('click', function () {
      var entries = Object.keys(votes).filter(function (g) { return votes[g] > 0; })
        .map(function (g) { return { grant_id: g, votes: votes[g] }; });
      if (!entries.length) return;
      btn.disabled = true; btn.textContent = t('qv.submitting'); msg.textContent = ''; msg.className = 'fw-qv-msg';
      fetch('/api/free-world/rounds/' + round.id + '/ballots', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ votes: entries }),
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, env: j }; }); })
        .then(function (res) {
          btn.textContent = t('qv.submit');
          if (res.ok && res.env.success) {
            msg.textContent = t('qv.success'); msg.classList.add('ok');
            votes = {}; box.querySelectorAll('[data-v],[data-c]').forEach(function (e) { e.textContent = '0'; });
            refresh();
          } else if (res.status === 401) {
            signin.classList.remove('fw-hidden'); btn.classList.add('fw-hidden');
          } else {
            msg.textContent = res.status === 400 ? t('qv.budget') : t('qv.err'); msg.classList.add('err');
            btn.disabled = false;
          }
        })
        .catch(function () { btn.textContent = t('qv.submit'); btn.disabled = false; msg.textContent = t('qv.err'); msg.classList.add('err'); });
    });
  }

  /* ── Board lightbox ───────────────────────────────────────── */
  function initLightbox() {
    document.querySelectorAll('[data-zoom]').forEach(function (img) {
      img.addEventListener('click', function () {
        var lb = document.createElement('div');
        lb.className = 'fw-lightbox open';
        lb.innerHTML = '<img src="' + (img.getAttribute('data-zoom-src') || img.src) + '" alt="">';
        lb.addEventListener('click', function () { lb.remove(); });
        document.body.appendChild(lb);
      });
    });
  }

  /* ── Nav — hamburger + slide-in drawer ────────────────────── */
  function initNav() {
    var burger = document.querySelector('.fw-burger');
    var drawer = document.querySelector('.fw-nav-mobile');
    if (!burger || !drawer) return;
    function setOpen(open) {
      burger.classList.toggle('active', open);
      drawer.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('fw-menu-open', open);
    }
    burger.addEventListener('click', function () {
      setOpen(!drawer.classList.contains('open'));
    });
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  /* ── boot ─────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    applyI18n();
    initNav();
    initReveal();
    initMap();
    initQV();
    initLightbox();
    pollFund(); setInterval(pollFund, 30000);
    pollRegistry(); setInterval(pollRegistry, 60000);
    document.querySelectorAll('.fw-lang button').forEach(function (b) {
      b.addEventListener('click', function () { window.FW_SETLANG(b.dataset.lang); });
    });
  });
})();
