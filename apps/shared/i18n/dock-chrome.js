/* Chrome for the Electron HTML clients (desktop, miner, agent).
   Same cookie as apps/shared/i18n/persist.ts: zion_locale + localStorage zion-lang.
   Loaded from the ui folder (CSP script-src 'self'). Missing keys fall back to English. */
(function () {
  var LANGS = ['cs', 'en', 'es', 'pt', 'fr'];
  var SHORT = { cs: 'CZ', en: 'EN', es: 'ES', pt: 'PT', fr: 'FR' };
  var COPY = {
    'nav.home': { cs: 'Domů', en: 'Home', es: 'Inicio', pt: 'Início', fr: 'Accueil' },
    'nav.wallet': { cs: 'Peněženka', en: 'Wallet', es: 'Cartera', pt: 'Carteira', fr: 'Portefeuille' },
    'nav.multichain': { cs: 'Multichain', en: 'Multichain', es: 'Multichain', pt: 'Multichain', fr: 'Multichain' },
    'nav.market': { cs: 'Trh', en: 'Market', es: 'Mercado', pt: 'Mercado', fr: 'Marché' },
    'nav.oasis': { cs: 'Oasis', en: 'Oasis', es: 'Oasis', pt: 'Oasis', fr: 'Oasis' },
    'nav.cli': { cs: 'CLI', en: 'CLI', es: 'CLI', pt: 'CLI', fr: 'CLI' },
    'nav.settings': { cs: 'Nastavení', en: 'Settings', es: 'Ajustes', pt: 'Definições', fr: 'Réglages' },
    'nav.logs': { cs: 'Záznamy', en: 'Logs', es: 'Registros', pt: 'Registos', fr: 'Journaux' },
    'nav.about': { cs: 'O projektu', en: 'About', es: 'Acerca', pt: 'Sobre', fr: 'À propos' },
    'nav.account': { cs: 'Účet', en: 'Account', es: 'Cuenta', pt: 'Conta', fr: 'Compte' },
    'title.dashboard': { cs: 'Přehled', en: 'Dashboard', es: 'Panel', pt: 'Painel', fr: 'Tableau' },
    'kicker.mining': { cs: 'Těžba', en: 'Mining', es: 'Minería', pt: 'Mineração', fr: 'Minage' },
    'kicker.crosschain': { cs: 'Mezi řetězci', en: 'Cross-chain', es: 'Entre cadenas', pt: 'Entre cadeias', fr: 'Inter-chaînes' },
    'kicker.l2': { cs: 'Vrstva 2', en: 'Layer 2', es: 'Capa 2', pt: 'Camada 2', fr: 'Couche 2' },
    'kicker.l2gov': { cs: 'Vrstva 2 · Správa', en: 'Layer 2 · Governance', es: 'Capa 2 · Gobernanza', pt: 'Camada 2 · Governança', fr: 'Couche 2 · Gouvernance' },
    'kicker.security': { cs: 'Zabezpečení', en: 'Security', es: 'Seguridad', pt: 'Segurança', fr: 'Sécurité' },
    'kicker.config': { cs: 'Konfigurace', en: 'Configuration', es: 'Configuración', pt: 'Configuração', fr: 'Configuration' },
    'kicker.infra': { cs: 'Infrastruktura', en: 'Infrastructure', es: 'Infraestructura', pt: 'Infraestrutura', fr: 'Infrastructure' },
    'kicker.l1': { cs: 'Vrstva 1', en: 'Layer 1', es: 'Capa 1', pt: 'Camada 1', fr: 'Couche 1' },
    'kicker.console': { cs: 'Konzole těžby', en: 'Mining Console', es: 'Consola de minería', pt: 'Consola de mineração', fr: 'Console de minage' },
    'kicker.project': { cs: 'Projekt', en: 'Project', es: 'Proyecto', pt: 'Projeto', fr: 'Projet' },
    'kicker.cli': { cs: 'v3.1 Unified CLI', en: 'v3.1 Unified CLI', es: 'v3.1 Unified CLI', pt: 'v3.1 Unified CLI', fr: 'v3.1 Unified CLI' },
    'gpu.detecting': { cs: 'Hledám GPU…', en: 'Detecting GPU...', es: 'Detectando GPU...', pt: 'A detetar GPU...', fr: 'Détection du GPU...' },
    'status.stopped': { cs: 'ZASTAVENO', en: 'STOPPED', es: 'DETENIDO', pt: 'PARADO', fr: 'ARRÊTÉ' },
    'status.starting': { cs: 'STARTUJI', en: 'STARTING', es: 'INICIANDO', pt: 'A INICIAR', fr: 'DÉMARRAGE' },
    'status.mining': { cs: 'TĚŽÍM', en: 'MINING', es: 'MINANDO', pt: 'A MINERAR', fr: 'MINAGE' },
    'btn.start': { cs: 'Spustit těžbu', en: 'Start Mining', es: 'Empezar a minar', pt: 'Começar a minerar', fr: 'Lancer le minage' },
    'btn.stop': { cs: 'Stop', en: 'Stop', es: 'Parar', pt: 'Parar', fr: 'Arrêter' },
    'market.subtitle': {
      cs: 'Trh se otevře v zabezpečeném okně níže.',
      en: 'MarketPlace opens in the secure desktop frame below.',
      es: 'El mercado se abre en el marco seguro de abajo.',
      pt: 'O mercado abre na moldura segura abaixo.',
      fr: 'Le marché s’ouvre dans le cadre sécurisé ci-dessous.',
    },
    'oasis.subtitle': {
      cs: 'OASIS se otevře v zabezpečeném okně níže.',
      en: 'OASIS opens in the secure desktop frame below.',
      es: 'OASIS se abre en el marco seguro de abajo.',
      pt: 'OASIS abre na moldura segura abaixo.',
      fr: 'OASIS s’ouvre dans le cadre sécurisé ci-dessous.',
    },
    'empty.units': {
      cs: 'zatím žádné jednotky',
      en: 'no units yet',
      es: 'aún no hay unidades',
      pt: 'ainda sem unidades',
      fr: 'pas encore d’unités',
    },
  };

  function isLang(value) {
    return LANGS.indexOf(value) !== -1;
  }

  function readLang() {
    var cookie = document.cookie.match(/(?:^|; )zion_locale=([^;]+)/);
    var fromCookie = cookie ? decodeURIComponent(cookie[1]) : '';
    if (isLang(fromCookie)) return fromCookie;
    try {
      var stored = localStorage.getItem('zion-lang') || localStorage.getItem('zion_lang');
      if (isLang(stored)) return stored;
    } catch (e) { /* private mode */ }
    return 'cs';
  }

  function writeLang(lang) {
    try { localStorage.setItem('zion-lang', lang); } catch (e) { /* private mode */ }
    var host = location.hostname || '';
    var domain = host === 'zionterranova.com' || host.slice(-18) === '.zionterranova.com'
      ? '; domain=.zionterranova.com'
      : '';
    document.cookie = 'zion_locale=' + lang + '; path=/; max-age=31536000; samesite=lax' + domain;
    try { window.dispatchEvent(new CustomEvent('zion-lang', { detail: lang })); } catch (e) { /* old webview */ }
  }

  var lang = readLang();

  function t(key) {
    var row = COPY[key];
    if (!row) return '';
    if (lang === 'cs') return row.cs;
    return row[lang] || row.en || row.cs;
  }

  function apply() {
    document.documentElement.lang = lang;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      var text = t(key);
      if (text) nodes[i].textContent = text;
    }
    var badge = document.getElementById('status-badge');
    if (badge && badge.getAttribute('data-code')) {
      var status = t('status.' + badge.getAttribute('data-code'));
      if (status) badge.textContent = status;
    }
    var buttons = document.querySelectorAll('#dock-lang [data-lang]');
    for (var j = 0; j < buttons.length; j++) {
      var code = buttons[j].getAttribute('data-lang');
      buttons[j].setAttribute('aria-pressed', code === lang ? 'true' : 'false');
      buttons[j].className = 'dock-lang-btn' + (code === lang ? ' is-on' : '');
    }
  }

  function mount() {
    if (document.getElementById('dock-lang')) {
      apply();
      return;
    }
    var bar = document.getElementById('dock-bar');
    if (!bar) return;
    var style = document.createElement('style');
    style.textContent = '#dock-lang{display:flex;gap:2px;margin-left:8px;flex-shrink:0}'
      + '.dock-lang-btn{border:0;background:transparent;color:rgba(255,255,255,.55);font:700 10px/1 system-ui,sans-serif;letter-spacing:.04em;padding:6px 5px;border-radius:8px;cursor:pointer}'
      + '.dock-lang-btn.is-on{color:#111;background:#fcd116}';
    document.head.appendChild(style);
    var box = document.createElement('div');
    box.id = 'dock-lang';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Language');
    LANGS.forEach(function (code) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-lang', code);
      btn.textContent = SHORT[code];
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        lang = code;
        writeLang(code);
        apply();
      });
      box.appendChild(btn);
    });
    bar.appendChild(box);
    apply();
  }

  window.zionChrome = {
    t: t,
    get lang() { return lang; },
    apply: apply,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  window.addEventListener('zion-lang', function (event) {
    var next = event && event.detail;
    if (!isLang(next) || next === lang) return;
    lang = next;
    apply();
  });
})();
