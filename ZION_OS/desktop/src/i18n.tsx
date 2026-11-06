import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const DESK_LANGS = ['cs', 'en', 'es', 'pt', 'fr'] as const;
export type DeskLang = (typeof DESK_LANGS)[number];

export const DESK_SHORT: Record<DeskLang, string> = {
  cs: 'CZ',
  en: 'EN',
  es: 'ES',
  pt: 'PT',
  fr: 'FR',
};

type Row = Record<DeskLang, string>;

const COPY: Record<string, Row> = {
  language: { cs: 'Jazyk', en: 'Language', es: 'Idioma', pt: 'Idioma', fr: 'Langue' },
  kicker: {
    cs: 'Spuštění mainnetu · Velitelské centrum',
    en: 'Mainnet Launch · Command Center',
    es: 'Lanzamiento mainnet · Centro de mando',
    pt: 'Lançamento mainnet · Centro de comando',
    fr: 'Lancement mainnet · Centre de commande',
  },
  command: { cs: 'Velitelské centrum', en: 'Command Center', es: 'Centro de mando', pt: 'Centro de comando', fr: 'Centre de commande' },
  connected: { cs: '● Připojeno', en: '● Connected', es: '● Conectado', pt: '● Ligado', fr: '● Connecté' },
  disconnected: { cs: '● Odpojeno', en: '● Disconnected', es: '● Desconectado', pt: '● Desligado', fr: '● Déconnecté' },
  alertCount: { cs: 'upozornění', en: 'alerts', es: 'alertas', pt: 'alertas', fr: 'alertes' },
  theme: { cs: 'Přepnout motiv', en: 'Toggle theme', es: 'Cambiar tema', pt: 'Mudar tema', fr: 'Changer le thème' },
  refresh: { cs: 'Obnovit', en: 'Refresh', es: 'Actualizar', pt: 'Atualizar', fr: 'Actualiser' },
  auto: { cs: 'Automatické obnovení', en: 'Auto refresh', es: 'Actualización automática', pt: 'Atualização automática', fr: 'Actualisation auto' },
  'hero-network': { cs: 'Stav sítě', en: 'Network Status', es: 'Estado de la red', pt: 'Estado da rede', fr: 'État du réseau' },
  'hero-pool': { cs: 'Pool', en: 'Pool', es: 'Pool', pt: 'Pool', fr: 'Pool' },
  'hero-block': { cs: 'Poslední blok', en: 'Latest Block', es: 'Último bloque', pt: 'Último bloco', fr: 'Dernier bloc' },
  'hero-miners': { cs: 'Aktivní mineři', en: 'Active Miners', es: 'Mineros activos', pt: 'Mineiros ativos', fr: 'Mineurs actifs' },
  live: { cs: 'Živě', en: 'Live', es: 'En vivo', pt: 'Ao vivo', fr: 'En direct' },
  down: { cs: 'Mimo', en: 'Down', es: 'Caído', pt: 'Em baixo', fr: 'Hors ligne' },
  peers: { cs: 'peerů', en: 'peers', es: 'pares', pt: 'pares', fr: 'pairs' },
  sessions: { cs: 'aktivní relace', en: 'active sessions', es: 'sesiones activas', pt: 'sessões ativas', fr: 'sessions actives' },
  height: { cs: 'výška řetězu', en: 'chain height', es: 'altura de cadena', pt: 'altura da cadeia', fr: 'hauteur de chaîne' },
  workers: { cs: 'připojení pracovníci', en: 'connected workers', es: 'trabajadores conectados', pt: 'trabalhadores ligados', fr: 'workers connectés' },
  'group-network': { cs: 'Síť', en: 'Network', es: 'Red', pt: 'Rede', fr: 'Réseau' },
  'group-pool': { cs: 'Pool', en: 'Pool', es: 'Pool', pt: 'Pool', fr: 'Pool' },
  'group-layers': { cs: 'Vrstvy', en: 'Layers', es: 'Capas', pt: 'Camadas', fr: 'Couches' },
  'group-ai': { cs: 'AI', en: 'AI', es: 'IA', pt: 'IA', fr: 'IA' },
  'group-ops': { cs: 'Provoz', en: 'Ops', es: 'Ops', pt: 'Ops', fr: 'Ops' },
  overview: { cs: 'Přehled', en: 'Overview', es: 'Resumen', pt: 'Resumo', fr: 'Aperçu' },
  mining: { cs: 'Těžba', en: 'Mining', es: 'Minería', pt: 'Mineração', fr: 'Minage' },
  network: { cs: 'Síť', en: 'Network', es: 'Red', pt: 'Rede', fr: 'Réseau' },
  ecosystem: { cs: 'Ekosystém', en: 'Ecosystem', es: 'Ecosistema', pt: 'Ecossistema', fr: 'Écosystème' },
  ops: { cs: 'Provoz', en: 'Ops', es: 'Ops', pt: 'Ops', fr: 'Ops' },
  nodes: { cs: 'Uzly', en: 'Nodes', es: 'Nodos', pt: 'Nós', fr: 'Nœuds' },
  topology: { cs: 'Topologie', en: 'Topology', es: 'Topología', pt: 'Topologia', fr: 'Topologie' },
  orchestrator: { cs: 'Orchestrátor', en: 'Orchestrator', es: 'Orquestador', pt: 'Orquestrador', fr: 'Orchestrateur' },
  'pool-miners': { cs: 'Mineři', en: 'Miners', es: 'Mineros', pt: 'Mineiros', fr: 'Mineurs' },
  payout: { cs: 'Výplaty', en: 'Payouts', es: 'Pagos', pt: 'Pagamentos', fr: 'Paiements' },
  revenue: { cs: 'Příjmy', en: 'Revenue', es: 'Ingresos', pt: 'Receita', fr: 'Revenus' },
  'miner-live': { cs: 'Živý miner', en: 'Live Miner', es: 'Miner en vivo', pt: 'Miner ao vivo', fr: 'Mineur en direct' },
  l1: { cs: 'L1 konsensus', en: 'L1 Consensus', es: 'L1 Consenso', pt: 'L1 Consenso', fr: 'L1 Consensus' },
  l2: { cs: 'L2 most / DAO', en: 'L2 Bridge / DAO', es: 'L2 Puente / DAO', pt: 'L2 Ponte / DAO', fr: 'L2 Pont / DAO' },
  l3: { cs: 'L3 pokročilé', en: 'L3 Advanced', es: 'L3 Avanzado', pt: 'L3 Avançado', fr: 'L3 Avancé' },
  warp: { cs: 'WARP most', en: 'WARP Bridge', es: 'Puente WARP', pt: 'Ponte WARP', fr: 'Pont WARP' },
  l4: { cs: 'L4 OASIS', en: 'L4 OASIS', es: 'L4 OASIS', pt: 'L4 OASIS', fr: 'L4 OASIS' },
  l5: { cs: 'L5 humanitární', en: 'L5 Humanitarian', es: 'L5 Humanitario', pt: 'L5 Humanitário', fr: 'L5 Humanitaire' },
  l6: { cs: 'L6 vesmír', en: 'L6 Space', es: 'L6 Espacio', pt: 'L6 Espaço', fr: 'L6 Espace' },
  hiran: { cs: 'Hiran AI', en: 'Hiran AI', es: 'Hiran AI', pt: 'Hiran AI', fr: 'Hiran AI' },
  'ai-agents': { cs: 'AI agenti', en: 'AI Agents', es: 'Agentes IA', pt: 'Agentes IA', fr: 'Agents IA' },
  'ncl-jobs': { cs: 'NCL úlohy', en: 'NCL Jobs', es: 'Trabajos NCL', pt: 'Tarefas NCL', fr: 'Tâches NCL' },
  'poc-lab': { cs: 'PoC laboratoř', en: 'PoC Lab', es: 'Lab PoC', pt: 'Lab PoC', fr: 'Labo PoC' },
  services: { cs: 'Zdraví služeb', en: 'Services Health', es: 'Salud de servicios', pt: 'Saúde dos serviços', fr: 'Santé des services' },
  alerts: { cs: 'Upozornění', en: 'Alerts', es: 'Alertas', pt: 'Alertas', fr: 'Alertes' },
  logs: { cs: 'Záznamy', en: 'Logs', es: 'Registros', pt: 'Registos', fr: 'Journaux' },
  backups: { cs: 'Zálohy', en: 'Backups', es: 'Copias', pt: 'Cópias', fr: 'Sauvegardes' },
  fleet: { cs: 'Flotila', en: 'Fleet', es: 'Flota', pt: 'Frota', fr: 'Flotte' },
  settings: { cs: 'Nastavení', en: 'Settings', es: 'Ajustes', pt: 'Definições', fr: 'Réglages' },
  explorer: { cs: 'Prohlížeč', en: 'Explorer', es: 'Explorador', pt: 'Explorador', fr: 'Explorateur' },
  wallets: { cs: 'Peněženky', en: 'Wallets', es: 'Carteras', pt: 'Carteiras', fr: 'Portefeuilles' },
  dao: { cs: 'DAO', en: 'DAO', es: 'DAO', pt: 'DAO', fr: 'DAO' },
  bridge: { cs: 'Most', en: 'Bridge', es: 'Puente', pt: 'Ponte', fr: 'Pont' },
  'bridge-validators': { cs: 'Validátoři', en: 'Validators', es: 'Validadores', pt: 'Validadores', fr: 'Validateurs' },
  'warp-swap': { cs: 'Směna', en: 'Swap', es: 'Intercambio', pt: 'Troca', fr: 'Échange' },
  cex: { cs: 'CEX', en: 'CEX', es: 'CEX', pt: 'CEX', fr: 'CEX' },
  charts: { cs: 'Grafy', en: 'Charts', es: 'Gráficos', pt: 'Gráficos', fr: 'Graphiques' },
  events: { cs: 'Události', en: 'Events', es: 'Eventos', pt: 'Eventos', fr: 'Événements' },
  metrics: { cs: 'Metriky', en: 'Metrics', es: 'Métricas', pt: 'Métricas', fr: 'Métriques' },
  database: { cs: 'DB', en: 'DB', es: 'BD', pt: 'BD', fr: 'BD' },
  env: { cs: 'Prostředí', en: 'Env', es: 'Entorno', pt: 'Ambiente', fr: 'Env' },
  genesis: { cs: 'Genesis', en: 'Genesis', es: 'Génesis', pt: 'Gênesis', fr: 'Genèse' },
  blockers: { cs: 'Bloky', en: 'Blockers', es: 'Bloqueos', pt: 'Bloqueios', fr: 'Blocages' },
  'servers-setup': { cs: 'Servery', en: 'Servers', es: 'Servidores', pt: 'Servidores', fr: 'Serveurs' },
  'launch-day': { cs: 'Start', en: 'Launch', es: 'Lanzamiento', pt: 'Lançamento', fr: 'Lancement' },
  wizard: { cs: 'Průvodce', en: 'Wizard', es: 'Asistente', pt: 'Assistente', fr: 'Assistant' },
  agent: { cs: 'Agent', en: 'Agent', es: 'Agente', pt: 'Agente', fr: 'Agent' },
};

function isLang(value: string | null): value is DeskLang {
  return value === 'cs' || value === 'en' || value === 'es' || value === 'pt' || value === 'fr';
}

function readLang(): DeskLang | null {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie.match(/(?:^|; )zion_locale=([^;]+)/);
  const fromCookie = cookie ? decodeURIComponent(cookie[1]) : null;
  if (isLang(fromCookie)) return fromCookie;
  try {
    const stored = localStorage.getItem('zion-lang') || localStorage.getItem('zion_lang');
    if (isLang(stored)) return stored;
  } catch {
    /* private mode */
  }
  return null;
}

function writeLang(lang: DeskLang) {
  try {
    localStorage.setItem('zion-lang', lang);
  } catch {
    /* private mode */
  }
  const host = typeof location !== 'undefined' ? location.hostname : '';
  const domain =
    host === 'zionterranova.com' || host.endsWith('.zionterranova.com')
      ? '; domain=.zionterranova.com'
      : '';
  document.cookie = `zion_locale=${lang}; path=/; max-age=31536000; samesite=lax${domain}`;
  window.dispatchEvent(new CustomEvent('zion-lang', { detail: lang }));
}

type Ctx = { lang: DeskLang; setLang: (lang: DeskLang) => void; t: (key: string) => string };

const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (key) => key });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<DeskLang>('en');

  useEffect(() => {
    const saved = readLang();
    if (saved) setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: DeskLang) => {
    setLangState(next);
    writeLang(next);
  }, []);

  const t = useCallback(
    (key: string) => {
      const row = COPY[key];
      if (!row) return key;
      if (lang === 'cs') return row.cs;
      return row[lang] || row.en;
    },
    [lang],
  );

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}
