import InfoPage from '@/components/info/InfoPage';
import { T } from '@/components/info/T';
import { COMPANY } from '@/lib/invoice';

export const metadata = {
  title: 'Obchodní podmínky | ZION Market',
  description: 'Obchodní podmínky ZION Market.',
};

export default function TermsPage() {
  return (
    <InfoPage
      titleKey="info.termsTitle"
      subtitleKey="info.termsSubtitle"
      icon="📜"
    >
      <p className="update-date">
        <T
          cs="Poslední aktualizace: 28. července 2026"
          en="Last updated: 28 July 2026 · The Czech version of these Commercial Terms is legally binding; this English translation is provided for convenience only."
        />
      </p>

      <div className="rasta-info-toc">
        <h3>
          <T cs="Obsah" en="Contents" />
        </h3>
        <ol>
          <li><a href="#section1"><T cs="Úvodní ustanovení" en="General provisions" /></a></li>
          <li><a href="#section2"><T cs="Objednávka a uzavření smlouvy" en="Order and conclusion of the contract" /></a></li>
          <li><a href="#section3"><T cs="Ceny a platební podmínky" en="Prices and payment terms" /></a></li>
          <li><a href="#section4"><T cs="Doprava a dodání" en="Shipping and delivery" /></a></li>
          <li><a href="#section5"><T cs="Odstoupení od smlouvy" en="Withdrawal from the contract" /></a></li>
          <li><a href="#section6"><T cs="Reklamace a záruka" en="Complaints and warranty" /></a></li>
          <li><a href="#section7">ZION Token Reward Program</a></li>
          <li><a href="#section8"><T cs="Ochrana osobních údajů" en="Personal data protection" /></a></li>
          <li><a href="#section9"><T cs="Experimentální produkty a digitální edice" en="Experimental products and digital editions" /></a></li>
          <li><a href="#section10"><T cs="Závěrečná ustanovení" en="Final provisions" /></a></li>
        </ol>
      </div>

      <h2 id="section1">
        <T cs="1. Úvodní ustanovení" en="1. General provisions" />
      </h2>

      <h3>
        <T cs="1.1 Identifikace prodávajícího" en="1.1 Identification of the seller" />
      </h3>
      <div className="seller-info">
        <p><strong><T cs="Název:" en="Name:" /></strong> {COMPANY.name}</p>
        <p><strong><T cs="IČ:" en="Company ID:" /></strong> {COMPANY.ico}</p>
        <p><strong><T cs="DIČ:" en="VAT ID:" /></strong> {COMPANY.dic}</p>
        <p><strong><T cs="Sídlo:" en="Registered office:" /></strong> {COMPANY.address}, {COMPANY.city}, {COMPANY.country}</p>
        <p>
          <strong><T cs="Zapsáno:" en="Registered:" /></strong> {COMPANY.court}, <T cs="Č. j." en="File no." /> {COMPANY.fileNo}
        </p>
        <p><strong>E-mail:</strong> <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
        <p>
          <strong>Web:</strong>{' '}
          <a href={`https://${COMPANY.web}`} target="_blank" rel="noopener noreferrer">https://{COMPANY.web}</a>
        </p>
      </div>

      <h3>
        <T cs="1.2 Transparentní účet" en="1.2 Transparent account" />
      </h3>
      <div className="seller-info">
        <p><strong><T cs="Banka:" en="Bank:" /></strong> {COMPANY.bankName}</p>
        <p><strong><T cs="Číslo účtu:" en="Account number:" /></strong> {COMPANY.bankAccount}</p>
        <p><strong>IBAN:</strong> {COMPANY.iban}</p>
        <p><strong>BIC/SWIFT:</strong> {COMPANY.swift}</p>
      </div>

      <h3>
        <T cs="1.3 Definice pojmů" en="1.3 Definitions" />
      </h3>
      <ul>
        <li>
          <strong><T cs="Prodávající" en="Seller" /></strong>
          <T
            cs={` – ${COMPANY.name}, provozovatel internetového obchodu ${COMPANY.web} a market.zionterranova.com`}
            en={` – ${COMPANY.name}, operator of the online shop ${COMPANY.web} and market.zionterranova.com`}
          />
        </li>
        <li>
          <strong><T cs="Kupující" en="Buyer" /></strong>
          <T
            cs=" – fyzická nebo právnická osoba, která uzavírá kupní smlouvu"
            en=" – a natural or legal person concluding the purchase contract"
          />
        </li>
        <li>
          <strong><T cs="Zboží" en="Goods" /></strong>
          <T
            cs=" – produkty a digitální artefakty nabízené v internetovém obchodě"
            en=" – products and digital artifacts offered in the online shop"
          />
        </li>
        <li>
          <strong><T cs="Objednávka" en="Order" /></strong>
          <T
            cs=" – závazný návrh kupujícího na uzavření kupní smlouvy"
            en=" – the buyer’s binding proposal to conclude the purchase contract"
          />
        </li>
      </ul>

      <h2 id="section2">
        <T cs="2. Objednávka a uzavření smlouvy" en="2. Order and conclusion of the contract" />
      </h2>

      <h3>
        <T cs="2.1 Postup objednávky" en="2.1 Order process" />
      </h3>
      <ol>
        <li><T cs="Kupující vybere zboží a vloží ho do košíku" en="The buyer selects goods and adds them to the cart" /></li>
        <li><T cs="Vyplní dodací a fakturační údaje" en="Fills in shipping and billing details" /></li>
        <li><T cs="Zvolí způsob dopravy a platby" en="Chooses the delivery and payment method" /></li>
        <li><T cs="Zkontroluje a odešle objednávku" en="Reviews and submits the order" /></li>
        <li><T cs="Obdrží e-mail s potvrzením objednávky" en="Receives an order confirmation e-mail" /></li>
      </ol>

      <h3>
        <T cs="2.2 Uzavření kupní smlouvy" en="2.2 Conclusion of the purchase contract" />
      </h3>
      <p>
        <T
          cs="Kupní smlouva je uzavřena okamžikem potvrzení objednávky prodávajícím. Potvrzení je zasláno na e-mailovou adresu kupujícího."
          en="The purchase contract is concluded at the moment the seller confirms the order. The confirmation is sent to the buyer’s e-mail address."
        />
      </p>

      <h2 id="section3">
        <T cs="3. Ceny a platební podmínky" en="3. Prices and payment terms" />
      </h2>

      <h3>
        <T cs="3.1 Ceny" en="3.1 Prices" />
      </h3>
      <p>
        <T
          cs="Všechny ceny jsou uvedeny v českých korunách (CZK) včetně DPH. Cena je platná v okamžiku odeslání objednávky."
          en="All prices are stated in Czech korunas (CZK) including VAT. The price is valid at the moment the order is submitted."
        />
      </p>

      <h3>
        <T cs="3.2 Způsoby platby" en="3.2 Payment methods" />
      </h3>
      <div className="table-scroll"><table>
        <thead>
          <tr>
            <th><T cs="Způsob platby" en="Payment method" /></th>
            <th><T cs="Popis" en="Description" /></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><T cs="Platba kartou" en="Card payment" /></td>
            <td><T cs="Online platba přes zabezpečenou bránu Stripe" en="Online payment via the secure Stripe gateway" /></td>
          </tr>
          <tr>
            <td><T cs="Bankovní převod" en="Bank transfer" /></td>
            <td><T cs="Platba na účet před odesláním zboží" en="Payment to the account before dispatch" /></td>
          </tr>
          <tr>
            <td><T cs="Dobírka" en="Cash on delivery" /></td>
            <td><T cs="Platba v hotovosti při převzetí zásilky" en="Cash payment on collection of the parcel" /></td>
          </tr>
        </tbody>
      </table></div>

      <h2 id="section4">
        <T cs="4. Doprava a dodání" en="4. Shipping and delivery" />
      </h2>

      <h3>
        <T cs="4.1 Způsoby dopravy" en="4.1 Delivery options" />
      </h3>
      <div className="table-scroll"><table>
        <thead>
          <tr>
            <th><T cs="Dopravce" en="Carrier" /></th>
            <th><T cs="Cena" en="Price" /></th>
            <th><T cs="Dodací doba" en="Delivery time" /></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><T cs="Zásilkovna – výdejní místo" en="Zásilkovna – pickup point" /></td>
            <td>79 Kč</td>
            <td><T cs="1-3 pracovní dny" en="1-3 business days" /></td>
          </tr>
          <tr>
            <td><T cs="Zásilkovna – na adresu" en="Zásilkovna – home delivery" /></td>
            <td>119 Kč</td>
            <td><T cs="1-3 pracovní dny" en="1-3 business days" /></td>
          </tr>
          <tr>
            <td><T cs="Virtuální nákup (digitální doručení)" en="Virtual purchase (digital delivery)" /></td>
            <td><T cs="Zdarma" en="Free" /></td>
            <td><T cs="Okamžitě po potvrzení platby" en="Immediately after payment confirmation" /></td>
          </tr>
        </tbody>
      </table></div>

      <h3>
        <T cs="4.2 Dodací lhůta" en="4.2 Delivery period" />
      </h3>
      <p>
        <T
          cs="Standardní dodací lhůta je 3-7 pracovních dnů od potvrzení objednávky (resp. přijetí platby u platby předem)."
          en="The standard delivery period is 3-7 business days from order confirmation (or from receipt of payment for prepaid orders)."
        />
      </p>

      <h2 id="section5">
        <T cs="5. Odstoupení od smlouvy" en="5. Withdrawal from the contract" />
      </h2>

      <h3>
        <T cs="5.1 Právo na odstoupení" en="5.1 Right of withdrawal" />
      </h3>
      <p>
        <T
          cs={<>Kupující – spotřebitel má právo odstoupit od smlouvy bez udání důvodu do <strong>14 dnů</strong> od převzetí zboží.</>}
          en={<>The buyer – consumer has the right to withdraw from the contract without giving a reason within <strong>14 days</strong> of receiving the goods.</>}
        />
      </p>

      <h3>
        <T cs="5.2 Postup odstoupení" en="5.2 Withdrawal process" />
      </h3>
      <ol>
        <li><T cs="Informujte nás e-mailem o svém rozhodnutí odstoupit od smlouvy" en="Inform us by e-mail of your decision to withdraw from the contract" /></li>
        <li><T cs="Zboží zašlete zpět na naši adresu (nepoškozené, v původním obalu)" en="Send the goods back to our address (undamaged, in the original packaging)" /></li>
        <li><T cs="Peníze vám vrátíme do 14 dnů od doručení vráceného zboží" en="We refund you within 14 days of receiving the returned goods" /></li>
      </ol>

      <h3>
        <T cs="5.3 Výjimky z práva na odstoupení" en="5.3 Exceptions to the right of withdrawal" />
      </h3>
      <p>
        <T cs="Právo na odstoupení se nevztahuje na:" en="The right of withdrawal does not apply to:" />
      </p>
      <ul>
        <li><T cs="Zboží vyrobené na zakázku podle specifikací kupujícího" en="goods made to order according to the buyer’s specifications" /></li>
        <li><T cs="Zboží podléhající rychlé zkáze" en="goods subject to rapid deterioration" /></li>
        <li><T cs="Hygienické potřeby po porušení obalu" en="hygiene products once the packaging has been opened" /></li>
      </ul>

      <h2 id="section6">
        <T cs="6. Reklamace a záruka" en="6. Complaints and warranty" />
      </h2>

      <h3>
        <T cs="6.1 Záruční doba" en="6.1 Warranty period" />
      </h3>
      <p>
        <T
          cs={<>Na zboží poskytujeme záruku <strong>24 měsíců</strong> od data převzetí (pro spotřebitele).</>}
          en={<>We provide a warranty of <strong>24 months</strong> from the date of receipt (for consumers).</>}
        />
      </p>

      <h3>
        <T cs="6.2 Uplatnění reklamace" en="6.2 Filing a complaint" />
      </h3>
      <ol>
        <li><T cs="Kontaktujte nás e-mailem s popisem závady" en="Contact us by e-mail with a description of the defect" /></li>
        <li><T cs="Přiložte fotodokumentaci a číslo objednávky" en="Attach photo documentation and the order number" /></li>
        <li><T cs="Dohodneme se na dalším postupu" en="We agree on the next steps" /></li>
      </ol>

      <h3>
        <T cs="6.3 Lhůta pro vyřízení" en="6.3 Handling period" />
      </h3>
      <p>
        <T
          cs={<>Reklamace bude vyřízena nejpozději do <strong>30 dnů</strong> od jejího uplatnění.</>}
          en={<>The complaint will be handled no later than <strong>30 days</strong> after it is filed.</>}
        />
      </p>

      <h2 id="section7">7. ZION Token Reward Program</h2>

      <h3>
        <T cs="7.1 Podmínky programu" en="7.1 Programme terms" />
      </h3>
      <ul>
        <li><T cs="Tokeny jsou přidělovány automaticky k dokončeným objednávkám" en="Tokens are allocated automatically to completed orders" /></li>
        <li><T cs="Počet tokenů závisí na zakoupených produktech" en="The number of tokens depends on the products purchased" /></li>
        <li><T cs="Tokeny budou odeslány na wallet adresu uvedenou v objednávce" en="Tokens are sent to the wallet address provided in the order" /></li>
        <li><T cs="Program je aktivní v testovací fázi – tokeny budou odeslány po spuštění mainnetu" en="The programme runs in a test phase – tokens are sent once the mainnet is live" /></li>
      </ul>

      <h3>
        <T cs="7.2 Důležité upozornění" en="7.2 Important notice" />
      </h3>
      <p>
        <T
          cs="ZION tokeny jsou bonusem a nemají garantovanou peněžní hodnotu. Jedná se o experimentální projekt."
          en="ZION tokens are a bonus and have no guaranteed monetary value. This is an experimental project."
        />
      </p>

      <h2 id="section8">
        <T cs="8. Ochrana osobních údajů" en="8. Personal data protection" />
      </h2>

      <h3>
        <T cs="8.1 Správce údajů" en="8.1 Data controller" />
      </h3>
      <div className="seller-info">
        <p><strong><T cs="Správce:" en="Controller:" /></strong> {COMPANY.name}</p>
        <p><strong><T cs="IČ:" en="Company ID:" /></strong> {COMPANY.ico}</p>
        <p><strong><T cs="DIČ:" en="VAT ID:" /></strong> {COMPANY.dic}</p>
        <p><strong><T cs="Sídlo:" en="Registered office:" /></strong> {COMPANY.address}, {COMPANY.city}, {COMPANY.country}</p>
        <p>
          <strong><T cs="Zapsáno:" en="Registered:" /></strong> {COMPANY.court}, <T cs="Č. j." en="File no." /> {COMPANY.fileNo}
        </p>
        <p>
          <strong><T cs="E-mail pro GDPR:" en="GDPR e-mail:" /></strong>{' '}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </p>
      </div>

      <h3>
        <T cs="8.2 Zpracovávané údaje" en="8.2 Data processed" />
      </h3>
      <ul>
        <li><T cs="Jméno a příjmení" en="Full name" /></li>
        <li><T cs="E-mailová adresa" en="E-mail address" /></li>
        <li><T cs="Telefonní číslo" en="Phone number" /></li>
        <li><T cs="Doručovací adresa" en="Delivery address" /></li>
        <li><T cs="Fakturační údaje" en="Billing details" /></li>
      </ul>

      <h3>
        <T cs="8.3 Účel zpracování" en="8.3 Purpose of processing" />
      </h3>
      <ul>
        <li><T cs="Vyřízení objednávky a dodání zboží" en="Processing the order and delivering the goods" /></li>
        <li><T cs="Komunikace ohledně objednávky" en="Communication regarding the order" /></li>
        <li><T cs="Plnění zákonných povinností (účetnictví)" en="Compliance with legal obligations (accounting)" /></li>
        <li><T cs="Zasílání newsletteru (pouze se souhlasem)" en="Sending the newsletter (with consent only)" /></li>
      </ul>

      <h3>
        <T cs="8.4 Práva subjektu údajů" en="8.4 Data subject rights" />
      </h3>
      <p>
        <T
          cs="Máte právo na přístup k údajům, jejich opravu, výmaz, omezení zpracování a přenositelnost. Kontaktujte nás na "
          en="You have the right to access, rectify, erase, restrict processing of and port your data. Contact us at "
        />
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <h2 id="section9">
        <T cs="9. Experimentální produkty a digitální edice" en="9. Experimental products and digital editions" />
      </h2>

      <h3>
        <T cs="9.1 Charakter experimentální nabídky" en="9.1 Nature of the experimental offer" />
      </h3>
      <p>
        <T
          cs="Produkty označené jako vánoční edice, ZION Pass, digitální edice knih, OASIS artefakty a produkty s bonusy ZION jsou součástí experimentálního ekosystému ve vývoji. Kupující bere na vědomí, že jde o podporu rozvíjeného projektu — prodávající neslibuje konkrétní funkčnost, výnos, rozvoj ani výsledek. Objednávkou tato skutečnost akceptuje."
          en="Products marked as Christmas edition, ZION Pass, digital book editions, OASIS artifacts and products carrying ZION bonuses are part of an experimental ecosystem under development. The buyer acknowledges this is support for an evolving project — the seller promises no specific functionality, yield, development or outcome. By ordering, the buyer accepts this."
        />
      </p>

      <h3>
        <T cs="9.2 ZION bonusy" en="9.2 ZION bonuses" />
      </h3>
      <p>
        <T
          cs="ZION bonusy mají charakter dobrovolného věrnostního benefitu. Nemají peněžní hodnotu, nejsou investičním nástrojem, cenným papírem ani platebním prostředkem a nelze je vyplatit v penězích ani uplatnit nárok na jejich směnu. S koupeným produktem jsou neoddělitelně spjaty a nevzniká z nich samostatný majetkový nárok vůči prodávajícímu."
          en="ZION bonuses are a voluntary loyalty benefit. They have no monetary value, are not an investment instrument, security or means of payment, cannot be paid out in cash, and no claim to their exchange arises. They are inseparable from the purchased product and create no standalone proprietary claim against the seller."
        />
      </p>

      <h3>
        <T cs="9.3 Digitální obsah — zánik práva na odstoupení" en="9.3 Digital content — expiry of withdrawal right" />
      </h3>
      <p>
        <T
          cs="U digitálního obsahu (ZION Pass, e-knihy, digitální licence, soubory ke stažení) dodaného ihned po zaplacení souhlasí kupující s okamžitým plněním a bere na vědomí, že jeho dodáním zaniká právo na odstoupení od smlouvy ve smyslu § 1837 písm. l) občanského zákoníku."
          en="For digital content (ZION Pass, e-books, digital licences, downloadable files) delivered immediately after payment, the buyer consents to immediate performance and acknowledges that delivery extinguishes the right of withdrawal pursuant to Section 1837(l) of the Czech Civil Code."
        />
      </p>

      <h3>
        <T cs="9.4 Zboží na zakázku a ruční výroba" en="9.4 Made-to-order and handmade goods" />
      </h3>
      <p>
        <T
          cs="U zboží upraveného či vyrobeného podle přání kupujícího (gravírované výrobky, lampiony, zakázkové výrobky) právo na odstoupení od smlouvy nevzniká (§ 1837 písm. d) občanského zákoníku). U ručně vyráběného zboží se drobné odchylky vzhledu, odstínu dřeva nebo provedení nepovažují za vadu — fotografie v obchodě jsou ilustrační."
          en="For goods customised or made to the buyer’s specifications (engraved products, lanterns, made-to-order items), no right of withdrawal arises (Section 1837(d) of the Czech Civil Code). For handmade goods, minor deviations in appearance, wood tone or finish are not defects — product photos are illustrative."
        />
      </p>

      <h3>
        <T cs="9.5 Rozsah záruk a reklamací" en="9.5 Scope of warranties and complaints" />
      </h3>
      <p>
        <T
          cs="Produkty této edice dodáváme „tak, jak jsou“. V maximálním rozsahu, který připouštějí závazná ustanovení práva na ochranu spotřebitele, se na ně nevztahují žádné dobrovolné záruky nad rámec povinného rozsahu a reklamace se řídí pouze závaznými zákonnými ustanoveními. Závazná práva spotřebitele, která zákon vyloučit nepřípouští, zůstávají nedotčena."
          en="Products in this edition are supplied “as is”. To the maximum extent permitted by mandatory consumer-protection provisions, no voluntary warranties apply beyond the statutory scope and complaints are governed solely by mandatory statutory provisions. Mandatory consumer rights that the law does not permit to be waived remain unaffected."
        />
      </p>

      <h2 id="section10">
        <T cs="10. Závěrečná ustanovení" en="10. Final provisions" />
      </h2>

      <h3>
        <T cs="10.1 Platnost" en="10.1 Validity" />
      </h3>
      <p>
        <T
          cs="Tyto obchodní podmínky jsou platné a účinné od 1. prosince 2025."
          en="These Commercial Terms are valid and effective from 1 December 2025."
        />
      </p>

      <h3>
        <T cs="10.2 Změny podmínek" en="10.2 Changes to the terms" />
      </h3>
      <p>
        <T
          cs="Prodávající si vyhrazuje právo tyto podmínky změnit. Změny budou zveřejněny na této stránce."
          en="The seller reserves the right to change these terms. Changes are published on this page."
        />
      </p>

      <h3>
        <T cs="10.3 Rozhodné právo" en="10.3 Governing law" />
      </h3>
      <p>
        <T
          cs="Tyto podmínky se řídí právním řádem České republiky."
          en="These terms are governed by the law of the Czech Republic."
        />
      </p>

      <h3>
        <T cs="10.4 Řešení sporů" en="10.4 Dispute resolution" />
      </h3>
      <p>
        <T cs="Případné spory lze řešit mimosoudně prostřednictvím " en="Disputes may be resolved out of court through the " />
        <a href="https://www.coi.cz" target="_blank" rel="noopener noreferrer">
          <T cs="České obchodní inspekce" en="Czech Trade Inspection Authority" />
        </a>
        <T cs=" nebo platformy " en=" or the " />
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ODR</a>.
      </p>
    </InfoPage>
  );
}
