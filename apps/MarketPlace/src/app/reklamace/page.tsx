import InfoPage from '@/components/info/InfoPage';
import { T } from '@/components/info/T';
import { COMPANY } from '@/lib/invoice';

export const metadata = {
  title: 'Reklamační řád | ZION Market',
  description: 'Reklamační řád a záruka ZION Market (Omnity.One s.r.o.).',
};

export default function ReklamacePage() {
  return (
    <InfoPage
      titleKey="info.complaintsTitle"
      subtitleKey="info.complaintsSubtitle"
      icon="🛡️"
    >
      <p className="update-date">
        <T
          cs="Poslední aktualizace: 29. října 2026 · Port z V2 `reklamacni-rad-cs.html`"
          en="Last updated: 29 October 2026 · Ported from V2 `reklamacni-rad-cs.html`"
        />
      </p>

      <h2>
        <T cs="1. Prodávající" en="1. Seller" />
      </h2>
      <div className="seller-info">
        <p>
          <strong>{COMPANY.name}</strong>
        </p>
        <p>
          {COMPANY.address}, {COMPANY.city}, {COMPANY.country}
        </p>
        <p>
          <T cs="IČO" en="Company ID" /> {COMPANY.ico} · <T cs="DIČ" en="VAT ID" /> {COMPANY.dic}
        </p>
        <p>
          E-mail: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </p>
      </div>

      <h2>
        <T cs="2. Záruční doba" en="2. Warranty period" />
      </h2>
      <p>
        <T
          cs="Na zboží poskytujeme zákonnou záruku 24 měsíců od převzetí (spotřebitel). U digitálního obsahu platí zvláštní podmínky v obchodních podmínkách (§6)."
          en="Goods carry a statutory warranty of 24 months from receipt (consumers). Digital content is subject to the specific terms in the Commercial Terms (§6)."
        />
      </p>

      <h2>
        <T cs="3. Jak reklamovat" en="3. How to file a complaint" />
      </h2>
      <ol>
        <li>
          <T cs="Napište na " en="Write to " />
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          <T cs=" s číslem objednávky a popisem závady." en=" with the order number and a description of the defect." />
        </li>
        <li>
          <T
            cs="Přiložte fotografie / video a doklad o koupi (faktura / VS)."
            en="Attach photos / video and proof of purchase (invoice / variable symbol)."
          />
        </li>
        <li>
          <T
            cs="Po odsouhlasení zašlete zboží (není-li digi) na adresu sídla nebo domluvené místo."
            en="Once agreed, send the goods (unless digital) to our registered address or an agreed location."
          />
        </li>
      </ol>

      <h2>
        <T cs="4. Vyřízení" en="4. Resolution" />
      </h2>
      <p>
        <T
          cs="Reklamaci vyřídíme bez zbytečného odkladu, nejpozději do 30 dnů — opravou, výměnou, slevou nebo vrácením peněz dle zákona. Stav reklamace sdělíme e-mailem."
          en="We handle complaints without undue delay and no later than 30 days — by repair, replacement, discount or refund as required by law. We keep you informed of the status by e-mail."
        />
      </p>

      <h2>
        <T cs="5. Odstoupení od smlouvy (14 dnů)" en="5. Withdrawal from the contract (14 days)" />
      </h2>
      <p>
        <T
          cs="Spotřebitel může odstoupit do 14 dnů od převzetí zboží bez udání důvodu — výjimky (digi obsah po stažení, zboží na míru) viz "
          en="Consumers may withdraw within 14 days of receipt without giving a reason — for exceptions (digital content once downloaded, custom-made goods) see "
        />
        <a href="/terms#section5">
          <T cs="obchodní podmínky §5" en="Commercial Terms §5" />
        </a>
        .
      </p>

      <h2>
        <T cs="6. Související dokumenty" en="6. Related documents" />
      </h2>
      <ul>
        <li>
          <a href="/terms">
            <T cs="Obchodní podmínky" en="Commercial Terms" />
          </a>
        </li>
        <li>
          <a href="/gdpr">GDPR</a>
        </li>
        <li>
          <a href="/shopping-guide">
            <T cs="Nákupní řád" en="Shopping Guide" />
          </a>
        </li>
        <li>
          <a href="/order-tracking">
            <T cs="Sledování objednávky" en="Order tracking" />
          </a>
        </li>
      </ul>
    </InfoPage>
  );
}
