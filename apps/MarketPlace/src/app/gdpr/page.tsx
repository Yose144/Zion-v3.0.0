import InfoPage from '@/components/info/InfoPage';
import { T } from '@/components/info/T';
import { COMPANY } from '@/lib/invoice';

export const metadata = {
  title: 'GDPR | ZION Market',
  description: 'Ochrana osobních údajů a GDPR v ZION Market.',
};

export default function GdprPage() {
  return (
    <InfoPage
      titleKey="info.gdprTitle"
      subtitleKey="info.gdprSubtitle"
      icon="🔒"
    >
      <p className="update-date">
        <T cs="Platnost od 1. 1. 2026" en="Effective from 1 January 2026" />
      </p>

      <div className="rasta-info-toc">
        <h3>
          <T cs="Obsah" en="Contents" />
        </h3>
        <ol>
          <li><a href="#section1"><T cs="Správce osobních údajů" en="Data controller" /></a></li>
          <li><a href="#section2"><T cs="Jaké osobní údaje zpracováváme" en="What personal data we process" /></a></li>
          <li><a href="#section3"><T cs="Jak dlouho údaje uchováváme" en="How long we keep data" /></a></li>
          <li><a href="#section4"><T cs="Komu předáváme údaje" en="Who we share data with" /></a></li>
          <li><a href="#section5"><T cs="Vaše práva" en="Your rights" /></a></li>
          <li><a href="#section6"><T cs="Cookies a sledování" en="Cookies and tracking" /></a></li>
          <li><a href="#section7"><T cs="Zabezpečení údajů" en="Data security" /></a></li>
          <li><a href="#section8"><T cs="Newsletter" en="Newsletter" /></a></li>
          <li><a href="#section9"><T cs="Děti" en="Children" /></a></li>
          <li><a href="#section10"><T cs="Změny tohoto dokumentu" en="Changes to this document" /></a></li>
          <li><a href="#section11"><T cs="Kontakt" en="Contact" /></a></li>
        </ol>
      </div>

      <h2 id="section1">
        <T cs="1. Správce osobních údajů" en="1. Data controller" />
      </h2>
      <div className="seller-info">
        <p>
          <strong><T cs="Správce:" en="Controller:" /></strong> {COMPANY.name}
        </p>
        <p>
          <strong><T cs="IČ:" en="Company ID:" /></strong> {COMPANY.ico}
        </p>
        <p>
          <strong><T cs="DIČ:" en="VAT ID:" /></strong> {COMPANY.dic}
        </p>
        <p>
          <strong><T cs="Sídlo:" en="Registered office:" /></strong> {COMPANY.address}, {COMPANY.city}, {COMPANY.country}
        </p>
        <p>
          <strong><T cs="Zapsáno:" en="Registered:" /></strong> {COMPANY.court}, <T cs="Č. j." en="File no." /> {COMPANY.fileNo}
        </p>
        <p>
          <strong>E-mail:</strong> <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </p>
      </div>

      <div className="highlight-box">
        <p>
          <T
            cs="Tato informace o zpracování osobních údajů je v souladu s nařízením EU 2016/679 (GDPR). Vaše soukromí je pro nás prioritou."
            en="This privacy notice is in line with EU Regulation 2016/679 (GDPR). Your privacy is a priority for us."
          />
        </p>
      </div>

      <h2 id="section2">
        <T cs="2. Jaké osobní údaje zpracováváme" en="2. What personal data we process" />
      </h2>

      <h3>
        <T cs="2.1 Při nákupu v e-shopu" en="2.1 When you buy in the e-shop" />
      </h3>
      <div className="table-scroll"><table>
        <thead>
          <tr>
            <th><T cs="Údaj" en="Data" /></th>
            <th><T cs="Účel zpracování" en="Purpose" /></th>
            <th><T cs="Právní základ" en="Legal basis" /></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><T cs="Jméno a příjmení" en="Full name" /></td>
            <td><T cs="Plnění smlouvy, doručení zboží" en="Performance of the contract, delivery of goods" /></td>
            <td><T cs="Plnění smlouvy (GDPR čl. 6 odst. 1 písm. b)" en="Contract performance (GDPR Art. 6(1)(b))" /></td>
          </tr>
          <tr>
            <td>E-mail</td>
            <td><T cs="Komunikace o objednávce, zasílání dokladů" en="Order communication, sending documents" /></td>
            <td><T cs="Plnění smlouvy" en="Contract performance" /></td>
          </tr>
          <tr>
            <td><T cs="Telefon" en="Phone" /></td>
            <td><T cs="Kontakt při doručení (volitelné)" en="Contact on delivery (optional)" /></td>
            <td><T cs="Oprávněný zájem" en="Legitimate interest" /></td>
          </tr>
          <tr>
            <td><T cs="Adresa" en="Address" /></td>
            <td><T cs="Doručení zboží" en="Delivery of goods" /></td>
            <td><T cs="Plnění smlouvy" en="Contract performance" /></td>
          </tr>
          <tr>
            <td><T cs="IP adresa" en="IP address" /></td>
            <td><T cs="Zabezpečení, prevence podvodů" en="Security, fraud prevention" /></td>
            <td><T cs="Oprávněný zájem" en="Legitimate interest" /></td>
          </tr>
        </tbody>
      </table></div>

      <h3>
        <T cs="2.2 Při těžbě ZION tokenů" en="2.2 When mining ZION tokens" />
      </h3>
      <ul>
        <li><T cs="Wallet adresa – přiřazení vytěžených tokenů" en="Wallet address – allocation of mined tokens" /></li>
        <li><T cs="E-mail – zasílání informací o projektu (volitelně)" en="E-mail – project updates (optional)" /></li>
        <li><T cs="Mining statistiky – záznamy o těžební aktivitě" en="Mining statistics – records of mining activity" /></li>
      </ul>

      <h3>
        <T cs="2.3 Newsletter a marketing (pouze se souhlasem)" en="2.3 Newsletter and marketing (consent only)" />
      </h3>
      <ul>
        <li><T cs="E-mail pro zasílání obchodních sdělení" en="E-mail for commercial communications" /></li>
        <li><T cs="Historie interakcí (otevření emailů, kliky)" en="Interaction history (e-mail opens, clicks)" /></li>
      </ul>

      <h2 id="section3">
        <T cs="3. Jak dlouho údaje uchováváme" en="3. How long we keep data" />
      </h2>
      <ul>
        <li><T cs="Objednávky – 10 let (daňové účely)" en="Orders – 10 years (tax purposes)" /></li>
        <li><T cs="Fakturační údaje – 10 let (zákon o účetnictví)" en="Invoicing data – 10 years (Accounting Act)" /></li>
        <li><T cs="Marketing – do odvolání souhlasu" en="Marketing – until consent is withdrawn" /></li>
        <li><T cs="Cookies – max. 24 měsíců" en="Cookies – max. 24 months" /></li>
      </ul>

      <h2 id="section4">
        <T cs="4. Komu předáváme údaje" en="4. Who we share data with" />
      </h2>

      <h3>
        <T cs="4.1 Zpracovatelé (třetí strany)" en="4.1 Processors (third parties)" />
      </h3>
      <ul>
        <li><T cs="Zásilkovna – doručení zboží" en="Zásilkovna – delivery of goods" /></li>
        <li><T cs="Stripe – platební brána" en="Stripe – payment gateway" /></li>
        <li><T cs="Emailový poskytovatel – zasílání potvrzení objednávek" en="E-mail provider – order confirmations" /></li>
        <li><T cs="Trivi – účetní systém (fakturace)" en="Trivi – accounting system (invoicing)" /></li>
      </ul>
      <p>
        <T
          cs="Všichni zpracovatelé mají smlouvu o zpracování osobních údajů a jsou vázáni stejnými pravidly jako my."
          en="All processors have a data processing agreement and are bound by the same rules as we are."
        />
      </p>

      <h3>
        <T cs="4.2 Blockchain data (ZION tokeny)" en="4.2 Blockchain data (ZION tokens)" />
      </h3>
      <div className="warning-box">
        <p>
          <T
            cs="Transakce tokenů jsou zaznamenány na veřejném blockchainu. Wallet adresy jsou pseudonymní (není možné je jednoduše spojit s osobou), ale jednou zapsané transakce nelze smazat (decentralizovaná povaha blockchainu)."
            en="Token transactions are recorded on a public blockchain. Wallet addresses are pseudonymous (they cannot easily be linked to a person), but once a transaction is written it cannot be erased (the decentralised nature of the blockchain)."
          />
        </p>
      </div>

      <h2 id="section5">
        <T cs="5. Vaše práva" en="5. Your rights" />
      </h2>

      <h3>
        <T cs="5.1 Máte právo:" en="5.1 You have the right to:" />
      </h3>
      <ul>
        <li><T cs="Přístup k údajům – získat kopii svých osobních údajů" en="Access – obtain a copy of your personal data" /></li>
        <li><T cs="Oprava – opravit nesprávné nebo neúplné údaje" en="Rectification – correct inaccurate or incomplete data" /></li>
        <li><T cs="Výmaz – „právo být zapomenut“ (pokud není právní důvod pro uchovávání)" en="Erasure – the “right to be forgotten” (unless there is a legal ground for retention)" /></li>
        <li><T cs="Omezení zpracování – dočasně pozastavit zpracování" en="Restriction – temporarily suspend processing" /></li>
        <li><T cs="Přenositelnost – získat údaje v strukturovaném formátu" en="Portability – receive your data in a structured format" /></li>
        <li><T cs="Námitka – vznést námitku proti zpracování (marketing)" en="Objection – object to processing (marketing)" /></li>
        <li><T cs="Odvolání souhlasu – kdykoliv odvolat souhlas (newsletter)" en="Withdraw consent – withdraw consent at any time (newsletter)" /></li>
      </ul>

      <p>
        <T cs="Jak uplatnit svá práva: E-mail: " en="How to exercise your rights: e-mail: " />
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        <T
          cs=". Lhůta reakce: do 30 dnů od obdržení žádosti."
          en=". Response time: within 30 days of receiving the request."
        />
      </p>

      <h3>
        <T cs="5.2 Právo podat stížnost" en="5.2 Right to lodge a complaint" />
      </h3>
      <p>
        <T cs="Máte právo podat stížnost u dozorového úřadu:" en="You have the right to lodge a complaint with the supervisory authority:" />
      </p>
      <ul>
        <li><T cs="Úřad pro ochranu osobních údajů (ÚOOÚ)" en="Office for Personal Data Protection (ÚOOÚ)" /></li>
        <li>Pplk. Sochora 27, 170 00 Praha 7</li>
        <li>E-mail: <a href="mailto:posta@uoou.cz">posta@uoou.cz</a></li>
        <li>Web: <a href="https://www.uoou.cz" target="_blank" rel="noopener noreferrer">www.uoou.cz</a></li>
      </ul>

      <h2 id="section6">
        <T cs="6. Cookies a sledování" en="6. Cookies and tracking" />
      </h2>

      <h3>
        <T cs="6.1 Technické cookies (nezbytné)" en="6.1 Technical cookies (necessary)" />
      </h3>
      <p>
        <T
          cs="Umožňují základní funkce webu (košík, přihlášení). Nelze odmítnout."
          en="They enable basic site functions (cart, sign-in) and cannot be refused."
        />
      </p>

      <h3>
        <T cs="6.2 Analytické cookies (volitelné)" en="6.2 Analytics cookies (optional)" />
      </h3>
      <p>
        <T
          cs="Google Analytics – anonymizovaná statistika návštěvnosti. Účel: zlepšování webu, analýza chování uživatelů. Můžete odmítnout přes cookie lištu."
          en="Google Analytics – anonymised traffic statistics. Purpose: improving the site, analysing user behaviour. You can refuse them via the cookie bar."
        />
      </p>

      <h3>
        <T cs="6.3 Marketingové cookies (pouze se souhlasem)" en="6.3 Marketing cookies (consent only)" />
      </h3>
      <ul>
        <li><T cs="Zobrazování relevantních reklam" en="Displaying relevant ads" /></li>
        <li><T cs="Retargeting kampaně" en="Retargeting campaigns" /></li>
      </ul>

      <h2 id="section7">
        <T cs="7. Zabezpečení údajů" en="7. Data security" />
      </h2>
      <p>
        <T cs="Jak chráníme vaše údaje:" en="How we protect your data:" />
      </p>
      <ul>
        <li><T cs="SSL/TLS šifrování (HTTPS)" en="SSL/TLS encryption (HTTPS)" /></li>
        <li><T cs="Šifrování databází" en="Database encryption" /></li>
        <li><T cs="Pravidelné bezpečnostní audity" en="Regular security audits" /></li>
        <li><T cs="Omezený přístup k údajům (pouze oprávněné osoby)" en="Restricted access to data (authorised persons only)" /></li>
        <li><T cs="Zálohování dat" en="Data backups" /></li>
        <li><T cs="Anonymizace IP adres v Google Analytics" en="IP anonymisation in Google Analytics" /></li>
      </ul>

      <h2 id="section8">
        <T cs="8. Newsletter" en="8. Newsletter" />
      </h2>

      <h3>
        <T cs="8.1 Odběr newsletteru" en="8.1 Subscribing" />
      </h3>
      <p>
        <T cs="Pokud se přihlásíte k odběru newsletteru, zpracováváme:" en="If you subscribe to the newsletter, we process:" />
      </p>
      <ul>
        <li><T cs="E-mail – zasílání obchodních sdělení" en="E-mail – sending commercial communications" /></li>
        <li><T cs="Jméno (volitelné) – personalizace" en="Name (optional) – personalisation" /></li>
        <li><T cs="Statistiky otevření emailů (anonymně)" en="E-mail open statistics (anonymised)" /></li>
      </ul>

      <h3>
        <T cs="8.2 Jak se odhlásit" en="8.2 How to unsubscribe" />
      </h3>
      <p>
        <T
          cs="V každém emailu je odkaz pro odhlášení (Unsubscribe). Nebo nám napište na "
          en="Every e-mail contains an unsubscribe link. Or write to us at "
        />
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <h2 id="section9">
        <T cs="9. Děti" en="9. Children" />
      </h2>
      <p>
        <T
          cs="Neposkytujeme služby dětem mladším 18 let bez souhlasu zákonného zástupce. Pokud zjistíme, že jsme shromáždili údaje od dítěte bez souhlasu, údaje smažeme."
          en="We do not provide services to children under 18 without the consent of a legal guardian. If we find that we have collected data from a child without consent, we delete it."
        />
      </p>

      <h2 id="section10">
        <T cs="10. Změny tohoto dokumentu" en="10. Changes to this document" />
      </h2>
      <p>
        <T
          cs="Tuto informaci můžeme aktualizovat. Vždy na této stránce najdete nejnovější verzi. Poslední aktualizace: 1. 1. 2026."
          en="We may update this notice. The latest version is always available on this page. Last updated: 1 January 2026."
        />
      </p>

      <h2 id="section11">
        <T cs="11. Kontakt" en="11. Contact" />
      </h2>
      <p>
        <T cs="Máte otázky k GDPR? Kontaktujte nás na " en="Questions about GDPR? Contact us at " />
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </InfoPage>
  );
}
