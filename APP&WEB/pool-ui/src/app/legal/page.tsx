'use client';

// /legal — právní informace o projektu (CS/EN), Marketplace-style.

import Link from 'next/link';
import LegalPage, { H2, P, Ul, WarnBox, InfoBox, OPERATOR } from '@/components/LegalPage';
import { useLang } from '@/lib/i18n';

export default function LegalInfoPage() {
  const { t } = useLang();
  return (
    <LegalPage
      titleCs="Právní informace"
      titleEn="Legal information"
      subtitleCs="ZION Pool — těžební pool ekosystému ZION TerraNova"
      subtitleEn="ZION Pool — mining pool of the ZION TerraNova ecosystem"
    >
      <InfoBox>
        <div className="grid gap-1 text-xs sm:grid-cols-2">
          <p>
            <strong>{t('Provozovatel:', 'Operator:')}</strong> {OPERATOR.name}
          </p>
          <p>
            <strong>{t('IČ:', 'ID:')}</strong> {OPERATOR.ico} ·{' '}
            <strong>{t('DIČ:', 'VAT:')}</strong> {OPERATOR.dic}
          </p>
          <p>
            <strong>{t('Sídlo:', 'Registered at:')}</strong> {OPERATOR.address},{' '}
            {OPERATOR.city}, {OPERATOR.country}
          </p>
          <p>
            <strong>{t('Kontakt:', 'Contact:')}</strong>{' '}
            <a className="text-rasta-gold hover:underline" href={`mailto:${OPERATOR.email}`}>
              {OPERATOR.email}
            </a>
          </p>
        </div>
      </InfoBox>

      <H2 id="s1">{t('1. Povaha projektu', '1. Nature of the project')}</H2>
      <P>
        {t(
          'ZION TerraNova je experimentální open-source iniciativa kombinující decentralizované technologie s filozofickými principy. ZION Pool je její veřejný těžební pool — poskytuje infrastrukturu pro sdruženou těžbu a průhledné rozpočítávání odměn.',
          'ZION TerraNova is an experimental open-source initiative combining decentralised technologies with philosophical principles. ZION Pool is its public mining pool — providing infrastructure for pooled mining and transparent reward distribution.',
        )}
      </P>
      <WarnBox>
        {t(
          'ZION není klasická kryptoměna ani investiční produkt. Účast v těžbě je na vlastní odpovědnost a neměla by být motivována finančním ziskem.',
          'ZION is not a conventional cryptocurrency nor an investment product. Participation in mining is at your own risk and should not be motivated by financial gain.',
        )}
      </WarnBox>

      <H2 id="s2">{t('2. Struktura odměn', '2. Reward structure')}</H2>
      <Ul>
        <li>
          {t(
            'PPLNS — odměna se rozděluje podle shareů v posledním kole před nálezem bloku.',
            'PPLNS — rewards split by shares in the last round before a block is found.',
          )}
        </li>
        <li>
          {t(
            'Pool fee 1 %; z ní 5 % humanitární fond, 5 % vývoj.',
            'Pool fee 1%; of it 5% humanitarian fund, 5% development.',
          )}
        </li>
        <li>
          {t(
            '10 % z každého bloku ZION putuje na humanitární účely (on-chain).',
            '10% of every ZION block goes to humanitarian purposes (on-chain).',
          )}
        </li>
        <li>
          {t(
            'Výplaty v nativním coinu — žádný forced exchange.',
            'Payouts in the native coin — no forced exchange.',
          )}
        </li>
      </Ul>

      <H2 id="s3">{t('3. Open-source', '3. Open source')}</H2>
      <P>
        {t(
          'Veškerý kód poolu, mineru i blockchainu je veřejně dostupný k auditu a příspěvkům pod open-source licencí.',
          'All pool, miner and blockchain code is publicly available for audit and contributions under an open-source licence.',
        )}{' '}
        <a
          href="https://github.com/Yose144/Zion-v3.0.0"
          target="_blank"
          rel="noreferrer"
          className="text-rasta-gold hover:underline"
        >
          GitHub
        </a>
        .
      </P>

      <H2 id="s4">{t('4. Související dokumenty', '4. Related documents')}</H2>
      <Ul>
        <li>
          <Link href="/terms/" className="text-rasta-gold hover:underline">
            {t('Podmínky používání poolu', 'Pool Terms of Use')}
          </Link>
        </li>
        <li>
          <Link href="/gdpr/" className="text-rasta-gold hover:underline">
            {t('Ochrana osobních údajů (GDPR)', 'Privacy Policy (GDPR)')}
          </Link>
        </li>
        <li>
          <a
            href="https://market.zionterranova.com/legal"
            target="_blank"
            rel="noreferrer"
            className="text-rasta-gold hover:underline"
          >
            {t('Právní informace MarketPlace', 'MarketPlace legal information')}
          </a>
        </li>
      </Ul>
    </LegalPage>
  );
}
