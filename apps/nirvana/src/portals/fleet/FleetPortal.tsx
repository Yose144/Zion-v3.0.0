'use client';

import Link from 'next/link';
import { useI18n } from '@/core/i18n';
import type { FleetLeg } from '@/core/scene/universe/SkyFleet';

/**
 * Okno nebeské flotily — pohyblivý uzel L6.
 *
 * Okno neopakuje knihu: řekne, co flotila je, kdo na ní je a co z toho
 * existuje. Nic z toho neexistuje — proto je v okně status u každého trupu
 * a žádné číslo, které by se dalo splést s hardwarem.
 */
export function FleetPortal({
  onClose,
  leg,
  onSelectLeg,
}: {
  onClose: () => void;
  leg: FleetLeg | null;
  onSelectLeg: (next: FleetLeg | null) => void;
}) {
  const { t, lang } = useI18n();
  const cs = lang === 'cs';

  const legs: { id: FleetLeg; label: string }[] = [
    { id: 'lumi', label: cs ? 'Z LUMI (Kostarika)' : 'From LUMI (Costa Rica)' },
    { id: 'issobella', label: cs ? 'Z prstence Issobella' : 'From the Issobella ring' },
    { id: 'matrix', label: cs ? 'K Měsíci (Matrix)' : 'To the Moon (Matrix)' },
  ];

  return (
    <aside className="portal" role="dialog" aria-label={cs ? 'Nebeská flotila' : 'The sky fleet'}>
      <header className="portal-head">
        <h2>{cs ? 'Nebeská flotila · Nabukano' : 'The Sky Fleet · Nabukano'}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>

      <p className="muted">
        {cs
          ? 'Pohyblivý uzel L6 — loď, která pluje nahoru. Mateřská loď Nabukano nese dokovací rám a tři nebeské Marie; dohromady tvoří svislou osu mezi pozemním uzlem LUMI a stanicí Issobella. Není to čtrnáctý pozemský uzel a nemá pin na pevnině.'
          : 'A mobile L6 node — the ship that sails upward. The mother ship Nabukano carries a docking frame and three sky Marías; together they form the vertical axis between the ground node LUMI and the Issobella station. It is not a fourteenth Earth node and it has no pin on land.'}
      </p>

      <ul>
        <li>
          {cs ? 'Nabukano (mateřská loď + dok)' : 'Nabukano (mother ship + dock)'}{' '}
          <strong>{cs ? 'vize' : 'vision'}</strong>
        </li>
        <li>
          Santa María la Mayor · {cs ? 'nebeská' : 'of the sky'} <strong>{cs ? 'blízké nebe' : 'near sky'}</strong>
        </li>
        <li>
          Nossa Senhora de Fátima · {cs ? 'nebeská' : 'of the sky'} <strong>{cs ? 'mezi Zemí a Měsícem' : 'Earth to Moon'}</strong>
        </li>
        <li>
          María de las Nieves · {cs ? 'nebeská' : 'of the sky'} <strong>{cs ? 'horizont' : 'horizon'}</strong>
        </li>
      </ul>

      <p className="muted">
        {cs
          ? 'Kýl položený není a žádný trup neexistuje. Nahoru dnes vozí jiní — flotila si nekupuje slávu, kupuje místo. Kniha Nabukano je kánon, tohle okno je jeho obraz.'
          : 'No keel has been laid and no hull exists. Others carry people up today — the fleet buys a place, not glory. The book Nabukano is the canon; this window is its image.'}
      </p>

      <div className="hiran-actions">
        {legs.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onSelectLeg(leg === l.id ? null : l.id)}
            style={{
              borderColor: leg === l.id ? '#7fd3ff' : undefined,
              color: leg === l.id ? '#bfe9ff' : undefined,
            }}
          >
            {l.label}
          </button>
        ))}
        {leg && (
          <button type="button" onClick={() => onSelectLeg(null)}>
            {cs ? 'Zrušit trasu' : 'Clear the route'}
          </button>
        )}
      </div>

      <p className="muted">
        {leg
          ? cs
            ? 'Trasa je animace konceptu: oblouk a světlo na cestě. Žádný let, žádný čas příletu, žádný slib — jen obraz toho, kudy by cesta vedla.'
            : 'The route is a concept animation: an arc and a light along it. No flight, no arrival time, no promise — only an image of where the path would lead.'
          : cs
            ? 'Vyber trasu a uvidíš oblouk od startu k doku. Je to obraz, ne jízdní řád.'
            : 'Pick a route to see the arc from the start to the dock. It is an image, not a timetable.'}
      </p>

      <div className="hiran-actions">
        {/*
          Hlavní cesta z okna: **vzlétnout**. Okno dřív vedlo jen na knihu
          a prezentaci, takže se o hratelné flotile člověk nedozvěděl.
        */}
        <Link className="portal-link is-primary" href="/fleet">
          {cs ? 'Vzlétnout z Nabukana →' : 'Launch from Nabukano →'}
        </Link>
        <a
          className="portal-link"
          href="https://nirvana.zionterranova.com/present/nebeska-flotila"
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'Prohlédnout flotilu' : 'Walk the fleet'}
        </a>
        <a
          className="portal-link"
          href="https://app.zionterranova.com/zion-archive/nabukano/cist"
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'Číst knihu Nabukano' : 'Read the book Nabukano'}
        </a>
        <a
          className="portal-link"
          href="https://app.zionterranova.com/l6-issobella"
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'Stanice Issobella' : 'The Issobella station'}
        </a>
      </div>
    </aside>
  );
}
