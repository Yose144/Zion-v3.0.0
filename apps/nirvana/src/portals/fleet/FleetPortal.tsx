'use client';

import { useI18n } from '@/core/i18n';

/**
 * Okno nebeské flotily — pohyblivý uzel L6.
 *
 * Okno neopakuje knihu: řekne, co flotila je, kdo na ní je a co z toho
 * existuje. Nic z toho neexistuje — proto je v okně status u každého trupu
 * a žádné číslo, které by se dalo splést s hardwarem.
 */
export function FleetPortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const cs = lang === 'cs';

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
