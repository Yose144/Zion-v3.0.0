import InfoPage from '@/components/info/InfoPage';
import { COMPANY } from '@/lib/invoice';

export const metadata = {
  title: 'Reklamační řád | ZION Market',
  description: 'Reklamační řád a záruka ZION Market (Omnity.One s.r.o.).',
};

export default function ReklamacePage() {
  return (
    <InfoPage title="Reklamační řád" subtitle="Záruka, reklamace a odstoupení od smlouvy" icon="🛡️">
      <p className="update-date">Poslední aktualizace: 29. října 2026 · Port z V2 `reklamacni-rad-cs.html`</p>

      <h2>1. Prodávající</h2>
      <div className="seller-info">
        <p>
          <strong>{COMPANY.name}</strong>
        </p>
        <p>
          {COMPANY.address}, {COMPANY.city}, {COMPANY.country}
        </p>
        <p>
          IČO {COMPANY.ico} · DIČ {COMPANY.dic}
        </p>
        <p>
          E-mail: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        </p>
      </div>

      <h2>2. Záruční doba</h2>
      <p>
        Na zboží poskytujeme zákonnou záruku 24 měsíců od převzetí (spotřebitel). U digitálního
        obsahu platí zvláštní podmínky v obchodních podmínkách (§6).
      </p>

      <h2>3. Jak reklamovat</h2>
      <ol>
        <li>
          Napište na <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> s číslem objednávky a
          popisem závady.
        </li>
        <li>Přiložte fotografie / video a doklad o koupi (faktura / VS).</li>
        <li>Po odsouhlasení zašlete zboží (není-li digi) na adresu sídla nebo domluvené místo.</li>
      </ol>

      <h2>4. Vyřízení</h2>
      <p>
        Reklamaci vyřídíme bez zbytečného odkladu, nejpozději do 30 dnů — opravou, výměnou, slevou
        nebo vrácením peněz dle zákona. Stav reklamace sdělíme e-mailem.
      </p>

      <h2>5. Odstoupení od smlouvy (14 dnů)</h2>
      <p>
        Spotřebitel může odstoupit do 14 dnů od převzetí zboží bez udání důvodu — výjimky (digi
        obsah po stažení, zboží na míru) viz{' '}
        <a href="/terms#section5">obchodní podmínky §5</a>.
      </p>

      <h2>6. Související dokumenty</h2>
      <ul>
        <li>
          <a href="/terms">Obchodní podmínky</a>
        </li>
        <li>
          <a href="/gdpr">GDPR</a>
        </li>
        <li>
          <a href="/shopping-guide">Nákupní řád</a>
        </li>
        <li>
          <a href="/order-tracking">Sledování objednávky</a>
        </li>
      </ul>
    </InfoPage>
  );
}
