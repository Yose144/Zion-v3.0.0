'use client';

// /terms — podmínky používání mining poolu (CS/EN).

import LegalPage, { H2, P, Ul, WarnBox, InfoBox, OPERATOR } from '@/components/LegalPage';
import { useLang } from '@/lib/i18n';

export default function TermsPage() {
  const { t } = useLang();
  return (
    <LegalPage
      titleCs="Podmínky používání poolu"
      titleEn="Pool Terms of Use"
      subtitleCs="Poslední aktualizace: říjen 2026"
      subtitleEn="Last updated: October 2026"
    >
      <InfoBox>
        <p className="text-xs">
          <strong>{t('Provozovatel:', 'Operator:')}</strong> {OPERATOR.name} ·{' '}
          {t('IČ', 'ID')}: {OPERATOR.ico} · {OPERATOR.address},{' '}
          {OPERATOR.city}, {OPERATOR.country} ·{' '}
          <a className="text-rasta-gold hover:underline" href={`mailto:${OPERATOR.email}`}>
            {OPERATOR.email}
          </a>
        </p>
      </InfoBox>

      <H2 id="s1">{t('1. Popis služby', '1. Service description')}</H2>
      <P>
        {t(
          'ZION Pool (pool.zionterranova.com) je veřejný těžební pool ekosystému ZION TerraNova. Umožňuje uživatelům sdružovat výpočetní výkon pro těžbu coinů ZION, Quantus (QTC), Pearl (PRL) a dalších podporovaných coinů a obdržet odměny podle průhledného rozpočítávacího schématu PPLNS.',
          'ZION Pool (pool.zionterranova.com) is the public mining pool of the ZION TerraNova ecosystem. It allows users to combine computing power to mine ZION, Quantus (QTC), Pearl (PRL) and other supported coins and to receive rewards under the transparent PPLNS payout scheme.',
        )}
      </P>

      <H2 id="s2">{t('2. Odměny a poplatky', '2. Rewards and fees')}</H2>
      <Ul>
        <li>
          {t(
            'Rozpočítání odměn probíhá schématem PPLNS (Pay-Per-Last-N-Shares) — odměna se rozděluje podle shareů v posledním kole před nálezem bloku.',
            'Rewards are distributed via PPLNS (Pay-Per-Last-N-Shares) — a reward is split according to shares in the last round before a block is found.',
          )}
        </li>
        <li>
          {t(
            'Pool fee je zobrazena na stránce Statistiky u každého coinu (aktuálně 1 %). Z poplatku se dále odvádí 5 % na humanitární fond a 5 % na vývoj.',
            'The pool fee is shown on the Stats page per coin (currently 1%). Of that, 5% goes to the humanitarian fund and 5% to development.',
          )}
        </li>
        <li>
          {t(
            'Výplaty probíhají v nativním coinu po dosažení minimální hranice zobrazené u každého coinu.',
            'Payouts are made in the native coin once the per-coin minimum threshold shown on the site is reached.',
          )}
        </li>
      </Ul>

      <H2 id="s3">{t('3. Žádné záruky výnosu', '3. No yield guarantee')}</H2>
      <WarnBox>
        {t(
          'Těžba je soutěžní proces — výnos závisí na štěstí, obtížnosti sítě a vámi poskytnutém výkonu. Pool nezaručuje žádný konkrétní výdělek ani návratnost nákladů (elektřina, HW). Hodnota digitálních jednotek může být kdykoliv nulová. Nejedná se o investiční produkt.',
          'Mining is a competitive process — yield depends on luck, network difficulty and your contributed hashrate. The pool guarantees no specific earnings or return on costs (electricity, hardware). The value of digital units may be zero at any time. This is not an investment product.',
        )}
      </WarnBox>

      <H2 id="s4">{t('4. Povinnosti uživatele', '4. User obligations')}</H2>
      <Ul>
        <li>
          {t(
            'Používat pouze vlastní výpočetní výkon nebo výkon, k němuž máte oprávnění.',
            'Use only computing power you own or are authorised to use.',
          )}
        </li>
        <li>
          {t(
            'Nepokoušet se podvádět share-validaci, měnit payout adresy cizích minerů nebo zatěžovat infrastrukturu poolu (DDoS, spam submitů).',
            'Do not attempt to cheat share validation, alter other miners\' payout addresses, or abuse pool infrastructure (DDoS, submit spam).',
          )}
        </li>
        <li>
          {t(
            'Ověřit si správnost payout adresy — transakce na blockchainu jsou nevratné.',
            'Verify your payout address — blockchain transactions are irreversible.',
          )}
        </li>
      </Ul>

      <H2 id="s5">{t('5. Dostupnost služby', '5. Availability')}</H2>
      <P>
        {t(
          'Pool je provozován jako experimentální open-source služba typu best-effort. Výpadky, restarty, aktualizace a změny parametrů mohou nastat bez předchozího upozornění. Při výpadku poolu se sharey odeslané mimo provoz neproplácí.',
          'The pool is operated as an experimental open-source best-effort service. Outages, restarts, upgrades and parameter changes may occur without prior notice. Shares submitted while the pool is down are not compensated.',
        )}
      </P>

      <H2 id="s6">{t('6. Odpovědnost', '6. Liability')}</H2>
      <P>
        {t(
          'V maximálním rozsahu povoleném zákonem provozovatel neodpovídá za nepřímé škody, ušlý výdělek, ztrátu dat, selhání třetích stran (upstream pooly, bridgy, nody) ani za chyby v open-source softwaru dodávaném „tak jak je".',
          'To the maximum extent permitted by law, the operator is not liable for indirect damages, lost earnings, data loss, third-party failures (upstream pools, bridges, nodes) or defects in open-source software provided "as is".',
        )}
      </P>

      <H2 id="s7">{t('7. Změny podmínek', '7. Changes to terms')}</H2>
      <P>
        {t(
          'Tyto podmínky se mohou měnit; aktuální verze je vždy na této stránce. Pokračováním v těžbě po změně podmínek s nimi souhlasíte.',
          'These terms may change; the current version is always on this page. By continuing to mine after a change, you accept the updated terms.',
        )}
      </P>
    </LegalPage>
  );
}
