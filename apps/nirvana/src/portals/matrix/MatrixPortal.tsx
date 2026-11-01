'use client';

import { useI18n } from '@/core/i18n';

/**
 * Okno Měsíce — Matrix na Shackletonu.
 *
 * Měsíc není čtrnáctý pozemský uzel: je to zrcadlo dvanácti pozemských misí
 * („jak nahoře, tak dole"). Okno říká, co na povrchu je a co není — žádná
 * základna neexistuje, vše je vize. Prezentace je na `/present/matrix`.
 */
export function MatrixPortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const cs = lang === 'cs';

  return (
    <aside className="portal" role="dialog" aria-label={cs ? 'Matrix' : 'Matrix'}>
      <header className="portal-head">
        <h2>{cs ? 'Matrix · Shackleton' : 'Matrix · Shackleton'}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>

      <p className="muted">
        {cs
          ? 'Lunární uzel na jižním pólu Měsíce, v okolí kráteru Shackleton (89,9° j. š.). Ve stálém stínu kráteru je led, na hřebenech kolem skoro pořád svítí slunce — z místní vody a světla se dá žít. Matrix není třináctý kontinent: drží obraz dvanácti pozemských misí nad nimi.'
          : 'The lunar node at the Moon’s south pole, around Shackleton crater (89.9° S). Ice sits in the crater’s permanent shadow while the surrounding ridges are almost always lit — local water and sunlight are enough to live on. Matrix is not a thirteenth continent: it holds the image of the twelve Earth missions above them.'}
      </p>

      <ul>
        <li>
          {cs ? 'Poloha' : 'Position'} <strong>89,9° S · Shackleton</strong>
        </li>
        <li>
          {cs ? 'Základna' : 'Base'} <strong>{cs ? 'tři habitaty + skleník' : 'three habitats + greenhouse'}</strong>
        </li>
        <li>
          {cs ? 'Stav' : 'Status'} <strong>{cs ? 'vize' : 'vision'}</strong>
        </li>
      </ul>

      <p className="muted">
        {cs
          ? 'Základna neexistuje — na Měsíci dnes nestojí nic z tohoto uzlu. Okno i scéna jsou obraz konceptu; cesta k Měsíci je jen oblouk trasy z doku flotily.'
          : 'The base does not exist — nothing of this node stands on the Moon today. The window and the scene are an image of the concept; the route to the Moon is only an arc from the fleet’s dock.'}
      </p>

      <div className="hiran-actions">
        <a
          className="portal-link"
          href="https://nirvana.zionterranova.com/present/matrix"
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'Vstoupit na základnu' : 'Enter the base'}
        </a>
        <a
          className="portal-link"
          href="https://app.zionterranova.com/l6-issobella"
          target="_blank"
          rel="noopener noreferrer"
        >
          {cs ? 'Uzly L6' : 'L6 nodes'}
        </a>
      </div>
    </aside>
  );
}
