'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  isPublicLang,
  readPublicLang,
  writePublicLang,
  type PublicLang,
} from '../../../shared/i18n/persist';

export type Lang = PublicLang;

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Czech, a translation for es/pt/fr when passed, otherwise English. */
  t: (cs: string, en: string, more?: { es?: string; pt?: string; fr?: string }) => string;
};

/** Home and stats sentences. Key is the English argument of t(). */
const POOL_EXTRA: Record<string, { es: string; pt: string; fr: string }> = {
  'Start mining — guide': { es: 'Empezar a minar — guía', pt: 'Começar a minerar — guia', fr: 'Commencer à miner — guide' },
  'public mining pool · mainnet beta': { es: 'pool de minería público · mainnet beta', pt: 'pool de mineração público · mainnet beta', fr: 'pool de minage public · mainnet bêta' },
  'One pool.': { es: 'Un pool.', pt: 'Um pool.', fr: 'Un pool.' },
  'Twelve coins. One stratum address.': { es: 'Doce monedas. Una dirección stratum.', pt: 'Doze moedas. Um endereço stratum.', fr: 'Douze pièces. Une adresse stratum.' },
  miners: { es: 'mineros', pt: 'mineiros', fr: 'mineurs' },
  blocks: { es: 'bloques', pt: 'blocos', fr: 'blocs' },
  'pool hashrate': { es: 'hashrate del pool', pt: 'hashrate do pool', fr: 'hashrate du pool' },
  'Start mining': { es: 'Empezar a minar', pt: 'Começar a minerar', fr: 'Commencer à miner' },
  'Live stats': { es: 'Estadísticas en vivo', pt: 'Estatísticas ao vivo', fr: 'Stats en direct' },
  'Network status': { es: 'Estado de la red', pt: 'Estado da rede', fr: 'État du réseau' },
  difficulty: { es: 'dificultad', pt: 'dificuldade', fr: 'difficulté' },
  'Supported coins': { es: 'Monedas soportadas', pt: 'Moedas suportadas', fr: 'Pièces prises en charge' },
  'All mineable coins': { es: 'Todas las monedas minables', pt: 'Todas as moedas mineráveis', fr: 'Toutes les pièces minables' },
  'auxPoW coins pay out in ZION': { es: 'las monedas auxPoW se pagan en ZION', pt: 'as moedas auxPoW pagam em ZION', fr: 'les pièces auxPoW sont payées en ZION' },
  coin: { es: 'moneda', pt: 'moeda', fr: 'pièce' },
  algorithm: { es: 'algoritmo', pt: 'algoritmo', fr: 'algorithme' },
  price: { es: 'precio', pt: 'preço', fr: 'prix' },
  fee: { es: 'comisión', pt: 'taxa', fr: 'frais' },
  status: { es: 'estado', pt: 'estado', fr: 'état' },
  'Start in 2 minutes': { es: 'Empieza en 2 minutos', pt: 'Começa em 2 minutos', fr: 'Commence en 2 minutes' },
  'How to mine': { es: 'Cómo minar', pt: 'Como minerar', fr: 'Comment miner' },
  Telemetry: { es: 'Telemetría', pt: 'Telemetria', fr: 'Télémétrie' },
  'Pool stats': { es: 'Estadísticas del pool', pt: 'Estatísticas do pool', fr: 'Statistiques du pool' },
  'total hashrate': { es: 'hashrate total', pt: 'hashrate total', fr: 'hashrate total' },
  'miners online': { es: 'mineros en línea', pt: 'mineiros online', fr: 'mineurs en ligne' },
  'seed price': { es: 'precio semilla', pt: 'preço semente', fr: 'prix de référence' },
  coins: { es: 'monedas', pt: 'moedas', fr: 'pièces' },
  'blocks found': { es: 'bloques hallados', pt: 'blocos encontrados', fr: 'blocs trouvés' },
  'block reward split': { es: 'reparto de la recompensa', pt: 'repartição da recompensa', fr: 'répartition de la récompense' },
  'pool fee': { es: 'comisión del pool', pt: 'taxa do pool', fr: 'frais du pool' },
  'miners (PPLNS)': { es: 'mineros (PPLNS)', pt: 'mineiros (PPLNS)', fr: 'mineurs (PPLNS)' },
  'humanitarian fund': { es: 'fondo humanitario', pt: 'fundo humanitário', fr: 'fonds humanitaire' },
  'network (est)': { es: 'red (est.)', pt: 'rede (est.)', fr: 'réseau (est.)' },
};

const Ctx = createContext<LangCtx>({
  lang: 'cs',
  setLang: () => {},
  t: (cs) => cs,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('cs');

  useEffect(() => {
    const shared = readPublicLang();
    if (shared) {
      setLangState(shared);
      return;
    }
    const saved = window.localStorage.getItem('pool-lang');
    if (isPublicLang(saved)) setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writePublicLang(l);
    try {
      window.localStorage.setItem('pool-lang', l);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (cs: string, en: string, more?: { es?: string; pt?: string; fr?: string }) => {
      if (lang === 'cs') return cs;
      if (lang === 'en') return en;
      return more?.[lang] ?? POOL_EXTRA[en]?.[lang] ?? en;
    },
    [lang],
  );

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
