import InfoPage from '@/components/info/InfoPage';
import { T } from '@/components/info/T';
import { COMPANY } from '@/lib/invoice';

export const metadata = {
  title: 'Nákupní řád | ZION Market',
  description: 'Jak nakupovat na ZION Marketu — platební metody, doprava a FAQ.',
};

export default function ShoppingGuidePage() {
  return (
    <InfoPage
      titleKey="info.guideTitle"
      subtitleKey="info.guideSubtitle"
      icon="🛍️"
    >
      <h2>
        <T cs="Jak nakoupit krok za krokem" en="How to shop, step by step" />
      </h2>
      <ol>
        <li>
          <strong><T cs="Vyberte produkt" en="Choose a product" /></strong>
          <T
            cs=" — Procházejte naši nabídku a vyberte si produkty, které vás zaujmou."
            en=" — browse our offer and pick the products you like."
          />
        </li>
        <li>
          <strong><T cs="Přidejte do košíku" en="Add to cart" /></strong>
          <T
            cs=" — Klikněte na tlačítko „Do košíku“ u vybraného produktu."
            en=" — click the “Add to cart” button on the product you chose."
          />
        </li>
        <li>
          <strong><T cs="Zkontrolujte košík" en="Check your cart" /></strong>
          <T
            cs=" — Přejděte do košíku a zkontrolujte objednávku. Upravte množství dle potřeby."
            en=" — open the cart and review the order. Adjust quantities as needed."
          />
        </li>
        <li>
          <strong><T cs="Vyplňte údaje" en="Fill in your details" /></strong>
          <T
            cs=" — Zadejte dodací adresu, kontaktní údaje a případně wallet adresu pro ZION tokeny."
            en=" — enter your shipping address, contact details and, optionally, a wallet address for the ZION tokens."
          />
        </li>
        <li>
          <strong><T cs="Zvolte dopravu" en="Choose shipping" /></strong>
          <T
            cs=" — Vyberte způsob doručení – Zásilkovna, doručení na adresu nebo virtuální nákup."
            en=" — pick a delivery method: Zásilkovna pickup point, home delivery, or a virtual purchase."
          />
        </li>
        <li>
          <strong><T cs="Zaplaťte" en="Pay" /></strong>
          <T
            cs=" — Vyberte platební metodu a dokončete objednávku. Obdržíte potvrzení e-mailem."
            en=" — choose a payment method and complete the order. You will receive a confirmation e-mail."
          />
        </li>
      </ol>

      <div className="highlight-box">
        <p>
          <T
            cs="Bonus! Za každý nákup získáváte ZION tokeny jako poděkování. Nezapomeňte uvést svou wallet adresu!"
            en="Bonus! Every purchase earns you ZION tokens as a thank-you. Don’t forget to enter your wallet address!"
          />
        </p>
      </div>

      <h2>
        <T cs="Platební metody" en="Payment methods" />
      </h2>
      <table>
        <thead>
          <tr>
            <th><T cs="Metoda" en="Method" /></th>
            <th><T cs="Popis" en="Description" /></th>
            <th><T cs="Poplatek" en="Fee" /></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><T cs="Platba kartou" en="Card payment" /></td>
            <td>
              <T
                cs="Okamžitá platba přes zabezpečenou bránu Stripe. Podporujeme Visa, Mastercard, Apple Pay, Google Pay."
                en="Instant payment through the secure Stripe gateway. We support Visa, Mastercard, Apple Pay and Google Pay."
              />
            </td>
            <td><T cs="Zdarma" en="Free" /></td>
          </tr>
          <tr>
            <td><T cs="Bankovní převod" en="Bank transfer" /></td>
            <td>
              <T
                cs="Platba na účet před odesláním. Variabilní symbol = číslo objednávky."
                en="Payment to our account before dispatch. Variable symbol = order number."
              />
            </td>
            <td><T cs="Zdarma" en="Free" /></td>
          </tr>
          <tr>
            <td><T cs="Dobírka" en="Cash on delivery" /></td>
            <td>
              <T
                cs="Platba v hotovosti při převzetí zásilky od kurýra nebo na výdejním místě."
                en="Cash payment when you collect the parcel from the courier or at a pickup point."
              />
            </td>
            <td>+30 Kč</td>
          </tr>
        </tbody>
      </table>

      <h2>
        <T cs="Způsoby dopravy" en="Delivery options" />
      </h2>
      <table>
        <thead>
          <tr>
            <th><T cs="Dopravce" en="Carrier" /></th>
            <th><T cs="Popis" en="Description" /></th>
            <th><T cs="Cena" en="Price" /></th>
            <th><T cs="Doba doručení" en="Delivery time" /></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><T cs="Zásilkovna – výdejní místo" en="Zásilkovna – pickup point" /></td>
            <td>
              <T
                cs="Vyzvednutí na vybraném Z-Boxu nebo partnerském místě"
                en="Collection at a chosen Z-Box or partner location"
              />
            </td>
            <td>79 Kč</td>
            <td><T cs="1-3 prac. dny" en="1-3 business days" /></td>
          </tr>
          <tr>
            <td><T cs="Zásilkovna – na adresu" en="Zásilkovna – home delivery" /></td>
            <td>
              <T cs="Doručení přímo k vám domů kurýrem" en="Courier delivery straight to your door" />
            </td>
            <td>119 Kč</td>
            <td><T cs="1-3 prac. dny" en="1-3 business days" /></td>
          </tr>
          <tr>
            <td><T cs="Virtuální nákup" en="Virtual purchase" /></td>
            <td>
              <T
                cs="Digitální doručení bez logistiky – ideální pro dary nebo obsah"
                en="Digital delivery without logistics — ideal for gifts or content"
              />
            </td>
            <td><T cs="Zdarma" en="Free" /></td>
            <td>
              <T cs="Okamžitě po potvrzení platby" en="Immediately after payment confirmation" />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="warning-box">
        <p>
          <T
            cs="Upozornění: U ručně vyráběných produktů (dřevořezby, umění) může být dodací lhůta delší. O přesném termínu vás budeme informovat e-mailem."
            en="Please note: handmade products (wood carvings, art) may take longer to deliver. We will let you know the exact date by e-mail."
          />
        </p>
      </div>

      <h2>ZION Token Bonus</h2>
      <p>
        <T
          cs="Jako poděkování za váš nákup vám přidělujeme bonusové ZION tokeny. Každý produkt má přiřazen určitý počet tokenů."
          en="As a thank-you for your purchase we allocate bonus ZION tokens. Every product carries a set number of tokens."
        />
      </p>
      <ol>
        <li>
          <strong><T cs="Zadejte wallet" en="Enter your wallet" /></strong>
          <T
            cs=" — Při objednávce zadejte vaši ZION wallet adresu (volitelné)"
            en=" — enter your ZION wallet address at checkout (optional)"
          />
        </li>
        <li>
          <strong><T cs="Obdržíte QR" en="You get a QR code" /></strong>
          <T
            cs=" — V potvrzovacím e-mailu dostanete QR kód s vašimi tokeny"
            en=" — the confirmation e-mail contains a QR code with your tokens"
          />
        </li>
        <li>
          <strong><T cs="Tokeny přijdou" en="The tokens arrive" /></strong>
          <T
            cs=" — Po spuštění mainnetu vám tokeny automaticky odešleme"
            en=" — once the mainnet is live we send the tokens automatically"
          />
        </li>
      </ol>

      <h2>
        <T cs="Časté dotazy (FAQ)" en="Frequently asked questions (FAQ)" />
      </h2>

      <h3>
        <T cs="Jak dlouho trvá zpracování objednávky?" en="How long does order processing take?" />
      </h3>
      <p>
        <T
          cs="Standardní objednávky zpracováváme do 1-2 pracovních dnů. U ručně vyráběných produktů může příprava trvat déle – vždy vás budeme informovat e-mailem."
          en="Standard orders are processed within 1-2 business days. Handmade products may take longer to prepare — we will always keep you informed by e-mail."
        />
      </p>

      <h3>
        <T cs="Mohu změnit nebo zrušit objednávku?" en="Can I change or cancel an order?" />
      </h3>
      <p>
        <T
          cs="Ano, pokud ještě nebyla odeslána. Kontaktujte nás co nejdříve na "
          en="Yes, as long as it has not been dispatched yet. Contact us as soon as possible at "
        />
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        <T cs=" s číslem objednávky." en=" with your order number." />
      </p>

      <h3>
        <T cs="Jak zjistím stav své objednávky?" en="How do I check my order status?" />
      </h3>
      <p>
        <T
          cs="Po odeslání obdržíte e-mail s trackovacím číslem. Zásilku můžete sledovat na webu Zásilkovny nebo přímo v aplikaci."
          en="Once dispatched you receive an e-mail with a tracking number. You can track the parcel on the Zásilkovna website or in their app."
        />
      </p>

      <h3>
        <T cs="Co když mi zboží nepřijde?" en="What if my order does not arrive?" />
      </h3>
      <p>
        <T
          cs="Kontaktujte nás – prověříme situaci s dopravcem. Pokud se zásilka ztratí, zašleme vám novou nebo vrátíme peníze."
          en="Contact us — we will investigate with the carrier. If the parcel is lost, we send a replacement or refund you."
        />
      </p>

      <h3>
        <T cs="Musím mít ZION wallet pro nákup?" en="Do I need a ZION wallet to buy?" />
      </h3>
      <p>
        <T
          cs="Ne, wallet je volitelný. Pokud ho nezadáte, vygenerujeme vám novou wallet adresu a QR kód vám pošleme e-mailem."
          en="No, the wallet is optional. If you don’t provide one, we generate a new wallet address for you and send the QR code by e-mail."
        />
      </p>

      <h3>
        <T cs="Posíláte i do zahraničí?" en="Do you ship abroad?" />
      </h3>
      <p>
        <T
          cs="Momentálně odesíláme pouze v rámci České republiky a Slovenska. Pro zahraniční zásilky nás kontaktujte individuálně."
          en="We currently ship within the Czech Republic and Slovakia only. For international shipping, please contact us individually."
        />
      </p>
    </InfoPage>
  );
}
