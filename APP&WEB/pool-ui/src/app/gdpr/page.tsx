'use client';

// /gdpr — zásady ochrany osobních údajů / privacy (CS/EN).

import LegalPage, { H2, P, Ul, InfoBox, OPERATOR } from '@/components/LegalPage';
import { useLang } from '@/lib/i18n';

export default function GdprPage() {
  const { t } = useLang();
  return (
    <LegalPage
      titleCs="Ochrana osobních údajů (GDPR)"
      titleEn="Privacy Policy (GDPR)"
      subtitleCs="Poslední aktualizace: říjen 2026"
      subtitleEn="Last updated: October 2026"
    >
      <InfoBox>
        <p className="text-xs">
          <strong>{t('Správce údajů:', 'Data controller:')}</strong> {OPERATOR.name} ·{' '}
          {t('IČ', 'ID')}: {OPERATOR.ico} ·{' '}
          <a className="text-rasta-gold hover:underline" href={`mailto:${OPERATOR.email}`}>
            {OPERATOR.email}
          </a>
        </p>
      </InfoBox>

      <H2 id="s1">{t('1. Jaká data zpracováváme', '1. What data we process')}</H2>
      <Ul>
        <li>
          <strong>{t('Těžební data:', 'Mining data:')}</strong>{' '}
          {t(
            'payout adresa (veřejný klíč), jméno workeru, hashrate, počty shareů, IP adresa stratum spojení, časová razítka. Adresa je pseudonymní blockchainový údaj.',
            'payout address (public key), worker name, hashrate, share counts, stratum connection IP, timestamps. The address is a pseudonymous blockchain identifier.',
          )}
        </li>
        <li>
          <strong>{t('ZIS účet (pokud se přihlásíte):', 'ZIS account (if you sign in):')}</strong>{' '}
          {t(
            'uživatelské ID, primární adresa, zobrazované jméno, e-mail, avatar, napojené adresy. Spravuje ZIS (auth.zionterranova.com) — sdílené SSO pro celý ekosystém.',
            'user ID, primary address, display name, email, avatar, linked addresses. Managed by ZIS (auth.zionterranova.com) — the ecosystem-wide SSO.',
          )}
        </li>
        <li>
          <strong>{t('Technická data:', 'Technical data:')}</strong>{' '}
          {t(
            'serverové logy (IP, user-agent, časy požadavků) po omezenou dobu kvůli bezpečnosti a diagnostice.',
            'server logs (IP, user-agent, request times) retained briefly for security and diagnostics.',
          )}
        </li>
      </Ul>

      <H2 id="s2">{t('2. Cookies', '2. Cookies')}</H2>
      <Ul>
        <li>
          <code className="text-rasta-gold">zion_session</code> —{' '}
          {t(
            'httpOnly SSO cookie ZIS (doména .zionterranova.com), nastavená až po přihlášení. Bez ní funguje celý veřejný web včetně miner dashboardů.',
            'ZIS httpOnly SSO cookie (domain .zionterranova.com), set only after sign-in. The whole public site including miner dashboards works without it.',
          )}
        </li>
        <li>
          <code className="text-rasta-gold">localStorage</code> —{' '}
          {t(
            'volba jazyka (cs/en) a UI preference. Nejedná se o cookie a neobsahuje osobní údaje.',
            'language choice (cs/en) and UI preferences. Not a cookie and contains no personal data.',
          )}
        </li>
        <li>
          {t(
            'Žádné analytické ani reklamní cookies. Žádný tracking třetích stran.',
            'No analytics or advertising cookies. No third-party tracking.',
          )}
        </li>
      </Ul>

      <H2 id="s3">{t('3. Právní základ a účel', '3. Legal basis and purpose')}</H2>
      <Ul>
        <li>
          <strong>{t('Plnění služby (smlouva):', 'Service performance (contract):')}</strong>{' '}
          {t(
            'zpracování shareů a výpočet výplat je nutné k provozu poolu.',
            'processing shares and computing payouts is necessary to operate the pool.',
          )}
        </li>
        <li>
          <strong>{t('Oprávněný zájem:', 'Legitimate interest:')}</strong>{' '}
          {t(
            'bezpečnost, ochrana před zneužitím, statistiky výkonu poolu.',
            'security, abuse prevention, pool performance statistics.',
          )}
        </li>
        <li>
          <strong>{t('Souhlas:', 'Consent:')}</strong>{' '}
          {t(
            'přihlášení přes ZIS a napojení adres je dobrovolné — public část webu nevyžaduje účet.',
            'ZIS sign-in and address linking is voluntary — the public part of the site requires no account.',
          )}
        </li>
      </Ul>

      <H2 id="s4">{t('4. Předávání dat', '4. Data sharing')}</H2>
      <P>
        {t(
          'Osobní údaje neprodáváme ani nepředáváme třetím stranám. Technické zpracovatele tvoří pouze hostingová infrastruktura (Contabo, EU) a služba ZIS v rámci téhož projektu. Blockchainové záznamy (výplaty, nalezené bloky) jsou veřejné z povahy technologie.',
          'We do not sell or share personal data with third parties. The only processors are the hosting infrastructure (Contabo, EU) and the ZIS service within the same project. Blockchain records (payouts, found blocks) are public by the nature of the technology.',
        )}
      </P>

      <H2 id="s5">{t('5. Doba uchování', '5. Retention')}</H2>
      <Ul>
        <li>{t('Serverové logy: do 30 dnů.', 'Server logs: up to 30 days.')}</li>
        <li>
          {t(
            'Těžební statistiky a payout záznamy: po dobu provozu poolu (účetní evidence).',
            'Mining statistics and payout records: for the lifetime of the pool (accounting records).',
          )}
        </li>
        <li>
          {t(
            'ZIS účet: do smazání účtu uživatelem.',
            'ZIS account: until deleted by the user.',
          )}
        </li>
      </Ul>

      <H2 id="s6">{t('6. Vaše práva', '6. Your rights')}</H2>
      <P>
        {t(
          'Máte právo na přístup, opravu, výmaz, přenositelnost a námitku proti zpracování. Žádosti zasílejte na',
          'You have the right of access, rectification, erasure, portability and objection. Send requests to',
        )}{' '}
        <a className="text-rasta-gold hover:underline" href={`mailto:${OPERATOR.email}`}>
          {OPERATOR.email}
        </a>
        .{' '}
        {t(
          'Pozn.: blockchainové záznamy nelze vymazat z povahy technologie — platí zásada pseudonymity.',
          'Note: blockchain records cannot be erased due to the nature of the technology — pseudonymity applies.',
        )}
      </P>
    </LegalPage>
  );
}
