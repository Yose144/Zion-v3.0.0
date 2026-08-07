import InfoPage from '@/components/info/InfoPage';
import { tr } from '@/lib/translations';
import { COMPANY } from '@/lib/invoice';

export const metadata = {
  title: 'Obchodní podmínky | ZION Market',
  description: 'Obchodní podmínky ZION Market.',
};

export default function TermsPage() {
  return (
    <InfoPage
      title={tr('info', 'termsTitle', 'cs')}
      subtitle={tr('info', 'termsSubtitle', 'cs')}
      icon="📜"
    >
      <p className="update-date">Poslední aktualizace: 28. července 2026</p>

      <div className="rasta-info-toc">
        <h3>Obsah</h3>
        <ol>
          <li><a href="#section1">Úvodní ustanovení</a></li>
          <li><a href="#section2">Objednávka a uzavření smlouvy</a></li>
          <li><a href="#section3">Ceny a platební podmínky</a></li>
          <li><a href="#section4">Doprava a dodání</a></li>
          <li><a href="#section5">Odstoupení od smlouvy</a></li>
          <li><a href="#section6">Reklamace a záruka</a></li>
          <li><a href="#section7">ZION Token Reward Program</a></li>
          <li><a href="#section8">Ochrana osobních údajů</a></li>
          <li><a href="#section9">Závěrečná ustanovení</a></li>
        </ol>
      </div>

      <h2 id="section1">1. Úvodní ustanovení</h2>

      <h3>1.1 Identifikace prodávajícího</h3>
      <div className="seller-info">
        <p><strong>Název:</strong> {COMPANY.name}</p>
        <p><strong>IČ:</strong> {COMPANY.ico}</p>
        <p><strong>DIČ:</strong> {COMPANY.dic}</p>
        <p><strong>Sídlo:</strong> {COMPANY.address}, {COMPANY.city}, {COMPANY.country}</p>
        <p><strong>Zapsáno:</strong> {COMPANY.court}, Č. j. {COMPANY.fileNo}</p>
        <p><strong>E-mail:</strong> <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
        <p><strong>Web:</strong> <a href={`https://${COMPANY.web}`} target="_blank" rel="noopener noreferrer">https://{COMPANY.web}</a></p>
      </div>

      <h3>1.2 Transparentní účet</h3>
      <div className="seller-info">
        <p><strong>Banka:</strong> {COMPANY.bankName}</p>
        <p><strong>Číslo účtu:</strong> {COMPANY.bankAccount}</p>
        <p><strong>IBAN:</strong> {COMPANY.iban}</p>
        <p><strong>BIC/SWIFT:</strong> {COMPANY.swift}</p>
      </div>

      <h3>1.3 Definice pojmů</h3>
      <ul>
        <li><strong>Prodávající</strong> – {COMPANY.name}, provozovatel internetového obchodu {COMPANY.web} a market.zionterranova.com</li>
        <li><strong>Kupující</strong> – fyzická nebo právnická osoba, která uzavírá kupní smlouvu</li>
        <li><strong>Zboží</strong> – produkty a digitální artefakty nabízené v internetovém obchodě</li>
        <li><strong>Objednávka</strong> – závazný návrh kupujícího na uzavření kupní smlouvy</li>
      </ul>

      <h2 id="section2">2. Objednávka a uzavření smlouvy</h2>

      <h3>2.1 Postup objednávky</h3>
      <ol>
        <li>Kupující vybere zboží a vloží ho do košíku</li>
        <li>Vyplní dodací a fakturační údaje</li>
        <li>Zvolí způsob dopravy a platby</li>
        <li>Zkontroluje a odešle objednávku</li>
        <li>Obdrží e-mail s potvrzením objednávky</li>
      </ol>

      <h3>2.2 Uzavření kupní smlouvy</h3>
      <p>Kupní smlouva je uzavřena okamžikem potvrzení objednávky prodávajícím. Potvrzení je zasláno na e-mailovou adresu kupujícího.</p>

      <h2 id="section3">3. Ceny a platební podmínky</h2>

      <h3>3.1 Ceny</h3>
      <p>Všechny ceny jsou uvedeny v českých korunách (CZK) včetně DPH. Cena je platná v okamžiku odeslání objednávky.</p>

      <h3>3.2 Způsoby platby</h3>
      <table>
        <thead>
          <tr>
            <th>Způsob platby</th>
            <th>Popis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Platba kartou</td>
            <td>Online platba přes zabezpečenou bránu Stripe</td>
          </tr>
          <tr>
            <td>Bankovní převod</td>
            <td>Platba na účet před odesláním zboží</td>
          </tr>
          <tr>
            <td>Dobírka</td>
            <td>Platba v hotovosti při převzetí zásilky</td>
          </tr>
        </tbody>
      </table>

      <h2 id="section4">4. Doprava a dodání</h2>

      <h3>4.1 Způsoby dopravy</h3>
      <table>
        <thead>
          <tr>
            <th>Dopravce</th>
            <th>Cena</th>
            <th>Dodací doba</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Zásilkovna – výdejní místo</td>
            <td>79 Kč</td>
            <td>1-3 pracovní dny</td>
          </tr>
          <tr>
            <td>Zásilkovna – na adresu</td>
            <td>119 Kč</td>
            <td>1-3 pracovní dny</td>
          </tr>
          <tr>
            <td>Virtuální nákup (digitální doručení)</td>
            <td>Zdarma</td>
            <td>Okamžitě po potvrzení platby</td>
          </tr>
        </tbody>
      </table>

      <h3>4.2 Dodací lhůta</h3>
      <p>Standardní dodací lhůta je 3-7 pracovních dnů od potvrzení objednávky (resp. přijetí platby u platby předem).</p>

      <h2 id="section5">5. Odstoupení od smlouvy</h2>

      <h3>5.1 Právo na odstoupení</h3>
      <p>Kupující – spotřebitel má právo odstoupit od smlouvy bez udání důvodu do <strong>14 dnů</strong> od převzetí zboží.</p>

      <h3>5.2 Postup odstoupení</h3>
      <ol>
        <li>Informujte nás e-mailem o svém rozhodnutí odstoupit od smlouvy</li>
        <li>Zboží zašlete zpět na naši adresu (nepoškozené, v původním obalu)</li>
        <li>Peníze vám vrátíme do 14 dnů od doručení vráceného zboží</li>
      </ol>

      <h3>5.3 Výjimky z práva na odstoupení</h3>
      <p>Právo na odstoupení se nevztahuje na:</p>
      <ul>
        <li>Zboží vyrobené na zakázku podle specifikací kupujícího</li>
        <li>Zboží podléhající rychlé zkáze</li>
        <li>Hygienické potřeby po porušení obalu</li>
      </ul>

      <h2 id="section6">6. Reklamace a záruka</h2>

      <h3>6.1 Záruční doba</h3>
      <p>Na zboží poskytujeme záruku <strong>24 měsíců</strong> od data převzetí (pro spotřebitele).</p>

      <h3>6.2 Uplatnění reklamace</h3>
      <ol>
        <li>Kontaktujte nás e-mailem s popisem závady</li>
        <li>Přiložte fotodokumentaci a číslo objednávky</li>
        <li>Dohodneme se na dalším postupu</li>
      </ol>

      <h3>6.3 Lhůta pro vyřízení</h3>
      <p>Reklamace bude vyřízena nejpozději do <strong>30 dnů</strong> od jejího uplatnění.</p>

      <h2 id="section7">7. ZION Token Reward Program</h2>

      <h3>7.1 Podmínky programu</h3>
      <ul>
        <li>Tokeny jsou přidělovány automaticky k dokončeným objednávkám</li>
        <li>Počet tokenů závisí na zakoupených produktech</li>
        <li>Tokeny budou odeslány na wallet adresu uvedenou v objednávce</li>
        <li>Program je aktivní v testovací fázi – tokeny budou odeslány po spuštění mainnetu</li>
      </ul>

      <h3>7.2 Důležité upozornění</h3>
      <p>ZION tokeny jsou bonusem a nemají garantovanou peněžní hodnotu. Jedná se o experimentální projekt.</p>

      <h2 id="section8">8. Ochrana osobních údajů</h2>

      <h3>8.1 Správce údajů</h3>
      <div className="seller-info">
        <p><strong>Správce:</strong> {COMPANY.name}</p>
        <p><strong>IČ:</strong> {COMPANY.ico}</p>
        <p><strong>DIČ:</strong> {COMPANY.dic}</p>
        <p><strong>Sídlo:</strong> {COMPANY.address}, {COMPANY.city}, {COMPANY.country}</p>
        <p><strong>Zapsáno:</strong> {COMPANY.court}, Č. j. {COMPANY.fileNo}</p>
        <p><strong>E-mail pro GDPR:</strong> <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
      </div>

      <h3>8.2 Zpracovávané údaje</h3>
      <ul>
        <li>Jméno a příjmení</li>
        <li>E-mailová adresa</li>
        <li>Telefonní číslo</li>
        <li>Doručovací adresa</li>
        <li>Fakturační údaje</li>
      </ul>

      <h3>8.3 Účel zpracování</h3>
      <ul>
        <li>Vyřízení objednávky a dodání zboží</li>
        <li>Komunikace ohledně objednávky</li>
        <li>Plnění zákonných povinností (účetnictví)</li>
        <li>Zasílání newsletteru (pouze se souhlasem)</li>
      </ul>

      <h3>8.4 Práva subjektu údajů</h3>
      <p>Máte právo na přístup k údajům, jejich opravu, výmaz, omezení zpracování a přenositelnost. Kontaktujte nás na <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.</p>

      <h2 id="section9">9. Závěrečná ustanovení</h2>

      <h3>9.1 Platnost</h3>
      <p>Tyto obchodní podmínky jsou platné a účinné od 1. prosince 2025.</p>

      <h3>9.2 Změny podmínek</h3>
      <p>Prodávající si vyhrazuje právo tyto podmínky změnit. Změny budou zveřejněny na této stránce.</p>

      <h3>9.3 Rozhodné právo</h3>
      <p>Tyto podmínky se řídí právním řádem České republiky.</p>

      <h3>9.4 Řešení sporů</h3>
      <p>Případné spory lze řešit mimosoudně prostřednictvím <a href="https://www.coi.cz" target="_blank" rel="noopener noreferrer">České obchodní inspekce</a> nebo platformy <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ODR</a>.</p>
    </InfoPage>
  );
}
