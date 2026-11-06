'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/core/i18n';
import { KingdomLink } from '@/core/portals/KingdomLink';

/**
 * Issobella — stanice na prstenci Nové Země. Okno je jen rozcestí: práce
 * (šatník, observatoř) se děje v prezentaci `/present/issobella`, kam se
 * chodí stejným způsobem jako u ostatních L5 scén.
 */
export function IssobellaPortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const cs = lang === 'cs';

  return (
    <aside className="portal" role="dialog" aria-label="Issobella">
      <header className="portal-head">
        <h2>Issobella</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>

      <p className="muted">
        {cs
          ? 'Orbitální observatoř nad Novou Zemí. Uvnitř je šatník OASIS — vybereš si postavu, se kterou tě uvidí ostatní hráči.'
          : 'Orbital observatory above New Earth. Inside is the OASIS wardrobe — pick the figure other players will see.'}
      </p>

      <div className="hiran-actions">
        {/*
          Issobella je **jeden ze dvou doků** flotily — okno na to musí
          ukázat, jinak se k ní dá doletět jen náhodou.
        */}
        <Link className="portal-link is-primary" href="/fleet">
          {cs ? 'Přiletět k doku →' : 'Fly to the dock →'}
        </Link>
        <button type="button" onClick={() => router.push('/present/issobella')}>
          {cs ? 'Vstoupit do stanice' : 'Enter the station'}
        </button>
        <a
          className="portal-link"
          href="/avatars"
          onClick={(event) => {
            event.preventDefault();
            router.push('/avatars');
          }}
        >
          {cs ? 'Všech 202 postav' : 'All 202 figures'}
        </a>
      </div>
      <KingdomLink portalId="issobella" />
    </aside>
  );
}
