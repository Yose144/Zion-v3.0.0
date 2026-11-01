'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/core/i18n';

/**
 * Okno třináctého uzlu — archy. Okno neopakuje misijní stránku: řekne, co loď
 * je, a nabídne dvě cesty — vstoupit na palubu (3D prezentace v Nirvaně) nebo
 * si přečíst misii na app.zionterranova.com.
 */
export function ArchaPortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const cs = lang === 'cs';

  return (
    <aside className="portal" role="dialog" aria-label={cs ? 'Archa' : 'The Ark'}>
      <header className="portal-head">
        <h2>{cs ? 'Království srdce · Nirvana' : 'Kingdom of the Heart · Nirvana'}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>

      <p className="muted">
        {cs
          ? 'Třináctý uzel sítě a jediný, který je na vodě: archa pro nejvýš sto lidí — semenný archiv, knihovna civilizace a plný uzel řetězce. Čtvrté plavidlo vedle Tres Marías, které se vrací pro ty, kdo zůstali ve vodě. Trasu mu určují keporkaci.'
          : 'The thirteenth node of the network and the only one on the water: an ark for at most one hundred people — a seed vault, a library of civilisation and a full chain node. The fourth vessel beside the Tres Marías, returning for those left in the water. Its route is set by the humpback whales.'}
      </p>

      <ul>
        <li>
          {cs ? 'Lidé na palubě' : 'People aboard'} <strong>≤ 100</strong>
        </li>
        <li>
          {cs ? 'Délka trupu' : 'Hull length'} <strong>~85 m</strong>
        </li>
        <li>
          {cs ? 'Semenný archiv' : 'Seed vault'} <strong>30–60k</strong>
        </li>
        <li>
          {cs ? 'Velrybí obvod' : 'Whale circuit'} <strong>~30 000 nm</strong>
        </li>
      </ul>

      <p className="muted">
        {cs
          ? 'Studie B3 je koncept — kýl položen není. Plachta je hlavní pohon, nafta zůstává v lékárničce.'
          : 'Study B3 is a concept — no keel has been laid. Sail is the primary propulsion; diesel stays in the medicine cabinet.'}
      </p>

      <div className="hiran-actions">
        <button type="button" onClick={() => router.push('/present/kralovstvi-srdce')}>
          {cs ? 'Vstoupit na palubu' : 'Step aboard'}
        </button>
        <a
          className="portal-link"
          href="https://app.zionterranova.com/terranova/kralovstvi-srdce"
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'Otevřít misii' : 'Open the mission'}
        </a>
      </div>
    </aside>
  );
}
