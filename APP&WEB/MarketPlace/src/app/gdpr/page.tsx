import InfoPage from '@/components/info/InfoPage';
import { tr } from '@/lib/translations';

export const metadata = {
  title: 'GDPR | ZION Market',
  description: 'Ochrana osobních údajů a GDPR v ZION Market.',
};

export default function GdprPage() {
  return (
    <InfoPage
      title={tr('info', 'gdprTitle', 'cs')}
      subtitle={tr('info', 'gdprSubtitle', 'cs')}
    >
      <p className="text-sm text-gray-400 mb-6">Platnost od 1. 1. 2026</p>

      <div className="highlight-box">
        <p>Tato informace o zpracování osobních údajů je v souladu s nařízením EU 2016/679 (GDPR). Vaše soukromí je pro nás prioritou.</p>
      </div>

      <h2>1. Správce osobních údajů</h2>
      <ul>
        <li>ZION TerraNova® (provozovatel ZION Market)</li>
        <li>IČO: 09120050</li>
        <li>Sídlo: Horní Čermná, 56156, Česká republika</li>
        <li>E-mail: <a href="mailto:shop@zionterranova.com">shop@zionterranova.com</a></li>
        <li>GDPR kontakt: <a href="mailto:gdpr@zionterranova.com">gdpr@zionterranova.com</a></li>
      </ul>

      <h2>2. Jaké osobní údaje zpracováváme</h2>

      <h3>2.1 Při nákupu v e-shopu</h3>
      <table>
        <thead>
          <tr>
            <th>Údaj</th>
            <th>Účel zpracování</th>
            <th>Právní základ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Jméno a příjmení</td>
            <td>Plnění smlouvy, doručení zboží</td>
            <td>Plnění smlouvy (GDPR čl. 6 odst. 1 písm. b)</td>
          </tr>
          <tr>
            <td>E-mail</td>
            <td>Komunikace o objednávce, zasílání dokladů</td>
            <td>Plnění smlouvy</td>
          </tr>
          <tr>
            <td>Telefon</td>
            <td>Kontakt při doručení (volitelné)</td>
            <td>Oprávněný zájem</td>
          </tr>
          <tr>
            <td>Adresa</td>
            <td>Doručení zboží</td>
            <td>Plnění smlouvy</td>
          </tr>
          <tr>
            <td>IP adresa</td>
            <td>Zabezpečení, prevence podvodů</td>
            <td>Oprávněný zájem</td>
          </tr>
        </tbody>
      </table>

      <h3>2.2 Při těžbě ZION tokenů</h3>
      <ul>
        <li>Wallet adresa – přiřazení vytěžených tokenů</li>
        <li>E-mail – zasílání informací o projektu (volitelně)</li>
        <li>Mining statistiky – záznamy o těžební aktivitě</li>
      </ul>

      <h3>2.3 Newsletter a marketing (pouze se souhlasem)</h3>
      <ul>
        <li>E-mail pro zasílání obchodních sdělení</li>
        <li>Historie interakcí (otevření emailů, kliky)</li>
      </ul>

      <h2>3. Jak dlouho údaje uchováváme</h2>
      <ul>
        <li>Objednávky – 10 let (daňové účely)</li>
        <li>Fakturační údaje – 10 let (zákon o účetnictví)</li>
        <li>Marketing – do odvolání souhlasu</li>
        <li>Cookies – max. 24 měsíců</li>
      </ul>

      <h2>4. Komu předáváme údaje</h2>

      <h3>4.1 Zpracovatelé (třetí strany)</h3>
      <ul>
        <li>Zásilkovna – doručení zboží</li>
        <li>Stripe – platební brána</li>
        <li>Emailový poskytovatel – zasílání potvrzení objednávek</li>
        <li>Trivi – účetní systém (fakturace)</li>
      </ul>
      <p>Všichni zpracovatelé mají smlouvu o zpracování osobních údajů a jsou vázáni stejnými pravidly jako my.</p>

      <h3>4.2 Blockchain data (ZION tokeny)</h3>
      <div className="warning-box">
        <p>Transakce tokenů jsou zaznamenány na veřejném blockchainu. Wallet adresy jsou pseudonymní (není možné je jednoduše spojit s osobou), ale jednou zapsané transakce nelze smazat (decentralizovaná povaha blockchainu).</p>
      </div>

      <h2>5. Vaše práva</h2>

      <h3>5.1 Máte právo:</h3>
      <ul>
        <li>Přístup k údajům – získat kopii svých osobních údajů</li>
        <li>Oprava – opravit nesprávné nebo neúplné údaje</li>
        <li>Výmaz – „právo být zapomenut“ (pokud není právní důvod pro uchovávání)</li>
        <li>Omezení zpracování – dočasně pozastavit zpracování</li>
        <li>Přenositelnost – získat údaje v strukturovaném formátu</li>
        <li>Námitka – vznést námitku proti zpracování (marketing)</li>
        <li>Odvolání souhlasu – kdykoliv odvolat souhlas (newsletter)</li>
      </ul>

      <p>Jak uplatnit svá práva: E-mail: <a href="mailto:gdpr@zionterranova.com">gdpr@zionterranova.com</a> nebo <a href="mailto:shop@zionterranova.com">shop@zionterranova.com</a>. Lhůta reakce: do 30 dnů od obdržení žádosti.</p>

      <h3>5.2 Právo podat stížnost</h3>
      <p>Máte právo podat stížnost u dozorového úřadu:</p>
      <ul>
        <li>Úřad pro ochranu osobních údajů (ÚOOÚ)</li>
        <li>Pplk. Sochora 27, 170 00 Praha 7</li>
        <li>E-mail: <a href="mailto:posta@uoou.cz">posta@uoou.cz</a></li>
        <li>Web: <a href="https://www.uoou.cz" target="_blank" rel="noopener noreferrer">www.uoou.cz</a></li>
      </ul>

      <h2>6. Cookies a sledování</h2>

      <h3>6.1 Technické cookies (nezbytné)</h3>
      <p>Umožňují základní funkce webu (košík, přihlášení). Nelze odmítnout.</p>

      <h3>6.2 Analytické cookies (volitelné)</h3>
      <p>Google Analytics – anonymizovaná statistika návštěvnosti. Účel: zlepšování webu, analýza chování uživatelů. Můžete odmítnout přes cookie lištu.</p>

      <h3>6.3 Marketingové cookies (pouze se souhlasem)</h3>
      <ul>
        <li>Zobrazování relevantních reklam</li>
        <li>Retargeting kampaně</li>
      </ul>

      <h2>7. Zabezpečení údajů</h2>
      <p>Jak chráníme vaše údaje:</p>
      <ul>
        <li>SSL/TLS šifrování (HTTPS)</li>
        <li>Šifrování databází</li>
        <li>Pravidelné bezpečnostní audity</li>
        <li>Omezený přístup k údajům (pouze oprávněné osoby)</li>
        <li>Zálohování dat</li>
        <li>Anonymizace IP adres v Google Analytics</li>
      </ul>

      <h2>8. Newsletter</h2>

      <h3>8.1 Odběr newsletteru</h3>
      <p>Pokud se přihlásíte k odběru newsletteru, zpracováváme:</p>
      <ul>
        <li>E-mail – zasílání obchodních sdělení</li>
        <li>Jméno (volitelné) – personalizace</li>
        <li>Statistiky otevření emailů (anonymně)</li>
      </ul>

      <h3>8.2 Jak se odhlásit</h3>
      <p>V každém emailu je odkaz pro odhlášení (Unsubscribe). Nebo nám napište na <a href="mailto:shop@zionterranova.com">shop@zionterranova.com</a>.</p>

      <h2>9. Děti</h2>
      <p>Neposkytujeme služby dětem mladším 18 let bez souhlasu zákonného zástupce. Pokud zjistíme, že jsme shromáždili údaje od dítěte bez souhlasu, údaje smažeme.</p>

      <h2>10. Změny tohoto dokumentu</h2>
      <p>Tuto informaci můžeme aktualizovat. Vždy na této stránce najdete nejnovější verzi. Poslední aktualizace: 1. 1. 2026.</p>

      <h2>11. Kontakt</h2>
      <p>Máte otázky k GDPR? GDPR specialista: <a href="mailto:gdpr@zionterranova.com">gdpr@zionterranova.com</a>. Obecný kontakt: <a href="mailto:shop@zionterranova.com">shop@zionterranova.com</a>.</p>
    </InfoPage>
  );
}
