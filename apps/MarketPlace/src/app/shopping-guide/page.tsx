import InfoPage from '@/components/info/InfoPage';
import { tr } from '@/lib/translations';
import { COMPANY } from '@/lib/invoice';

export const metadata = {
  title: 'Nákupní řád | ZION Market',
  description: 'Jak nakupovat na ZION Marketu — platební metody, doprava a FAQ.',
};

export default function ShoppingGuidePage() {
  return (
    <InfoPage
      title={tr('info', 'guideTitle', 'cs')}
      subtitle={tr('info', 'guideSubtitle', 'cs')}
      icon="🛍️"
    >
      <h2>Jak nakoupit krok za krokem</h2>
      <ol>
        <li><strong>Vyberte produkt</strong> — Procházejte naši nabídku a vyberte si produkty, které vás zaujmou.</li>
        <li><strong>Přidejte do košíku</strong> — Klikněte na tlačítko „Do košíku" u vybraného produktu.</li>
        <li><strong>Zkontrolujte košík</strong> — Přejděte do košíku a zkontrolujte objednávku. Upravte množství dle potřeby.</li>
        <li><strong>Vyplňte údaje</strong> — Zadejte dodací adresu, kontaktní údaje a případně wallet adresu pro ZION tokeny.</li>
        <li><strong>Zvolte dopravu</strong> — Vyberte způsob doručení – Zásilkovna, doručení na adresu nebo virtuální nákup.</li>
        <li><strong>Zaplaťte</strong> — Vyberte platební metodu a dokončete objednávku. Obdržíte potvrzení e-mailem.</li>
      </ol>

      <div className="highlight-box">
        <p>Bonus! Za každý nákup získáváte ZION tokeny jako poděkování. Nezapomeňte uvést svou wallet adresu!</p>
      </div>

      <h2>Platební metody</h2>
      <table>
        <thead>
          <tr>
            <th>Metoda</th>
            <th>Popis</th>
            <th>Poplatek</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Platba kartou</td>
            <td>Okamžitá platba přes zabezpečenou bránu Stripe. Podporujeme Visa, Mastercard, Apple Pay, Google Pay.</td>
            <td>Zdarma</td>
          </tr>
          <tr>
            <td>Bankovní převod</td>
            <td>Platba na účet před odesláním. Variabilní symbol = číslo objednávky.</td>
            <td>Zdarma</td>
          </tr>
          <tr>
            <td>Dobírka</td>
            <td>Platba v hotovosti při převzetí zásilky od kurýra nebo na výdejním místě.</td>
            <td>+30 Kč</td>
          </tr>
        </tbody>
      </table>

      <h2>Způsoby dopravy</h2>
      <table>
        <thead>
          <tr>
            <th>Dopravce</th>
            <th>Popis</th>
            <th>Cena</th>
            <th>Doba doručení</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Zásilkovna – výdejní místo</td>
            <td>Vyzvednutí na vybraném Z-Boxu nebo partnerském místě</td>
            <td>79 Kč</td>
            <td>1-3 prac. dny</td>
          </tr>
          <tr>
            <td>Zásilkovna – na adresu</td>
            <td>Doručení přímo k vám domů kurýrem</td>
            <td>119 Kč</td>
            <td>1-3 prac. dny</td>
          </tr>
          <tr>
            <td>Virtuální nákup</td>
            <td>Digitální doručení bez logistiky – ideální pro dary nebo obsah</td>
            <td>Zdarma</td>
            <td>Okamžitě po potvrzení platby</td>
          </tr>
        </tbody>
      </table>

      <div className="warning-box">
        <p>Upozornění: U ručně vyráběných produktů (dřevořezby, umění) může být dodací lhůta delší. O přesném termínu vás budeme informovat e-mailem.</p>
      </div>

      <h2>ZION Token Bonus</h2>
      <p>Jako poděkování za váš nákup vám přidělujeme bonusové ZION tokeny. Každý produkt má přiřazen určitý počet tokenů.</p>
      <ol>
        <li><strong>Zadejte wallet</strong> — Při objednávce zadejte vaši ZION wallet adresu (volitelné)</li>
        <li><strong>Obdržíte QR</strong> — V potvrzovacím e-mailu dostanete QR kód s vašimi tokeny</li>
        <li><strong>Tokeny přijdou</strong> — Po spuštění mainnetu vám tokeny automaticky odešleme</li>
      </ol>

      <h2>Časté dotazy (FAQ)</h2>

      <h3>Jak dlouho trvá zpracování objednávky?</h3>
      <p>Standardní objednávky zpracováváme do 1-2 pracovních dnů. U ručně vyráběných produktů může příprava trvat déle – vždy vás budeme informovat e-mailem.</p>

      <h3>Mohu změnit nebo zrušit objednávku?</h3>
      <p>Ano, pokud ještě nebyla odeslána. Kontaktujte nás co nejdříve na <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> s číslem objednávky.</p>

      <h3>Jak zjistím stav své objednávky?</h3>
      <p>Po odeslání obdržíte e-mail s trackovacím číslem. Zásilku můžete sledovat na webu Zásilkovny nebo přímo v aplikaci.</p>

      <h3>Co když mi zboží nepřijde?</h3>
      <p>Kontaktujte nás – prověříme situaci s dopravcem. Pokud se zásilka ztratí, zašleme vám novou nebo vrátíme peníze.</p>

      <h3>Musím mít ZION wallet pro nákup?</h3>
      <p>Ne, wallet je volitelný. Pokud ho nezadáte, vygenerujeme vám novou wallet adresu a QR kód vám pošleme e-mailem.</p>

      <h3>Posíláte i do zahraničí?</h3>
      <p>Momentálně odesíláme pouze v rámci České republiky a Slovenska. Pro zahraniční zásilky nás kontaktujte individuálně.</p>
    </InfoPage>
  );
}
