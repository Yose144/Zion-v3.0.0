'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  CreditCard,
  Flame,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  User,
} from 'lucide-react';
import { PRODUCTS, productById } from '@/data/catalog';
import { SHIPPING_OPTIONS, type PaymentMethod, type ShippingMethod } from '@/types/shop';
import { FIRE_CONSENT_VERSION, FIRE_SAFETY, requiresFireConsent } from '@/lib/fire-safety';
import { pick } from '@/lib/i18n';
import { imageVariant } from '@/lib/images';
import { useLang } from '@/lib/lang-context';
import { useProducts } from '@/lib/use-products';
import { useCart } from '@/components/cart-provider';
import { Price } from '@/components/price';
import { cn } from '@/lib/utils';

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

interface Capabilities {
  card: boolean;
  cod: boolean;
  codFeeCzk: number;
  freeShippingFrom: number;
}

const DEFAULT_CAPS: Capabilities = { card: false, cod: true, codFeeCzk: 45, freeShippingFrom: 1500 };

export default function CartPage() {
  const { lang } = useLang();
  const router = useRouter();
  const { lines, count, ready, setQuantity, remove, clear } = useCart();
  const products = useProducts();
  const [caps, setCaps] = useState<Capabilities>(DEFAULT_CAPS);

  const [shipping, setShipping] = useState<ShippingMethod>('zasilkovna');
  const [payment, setPayment] = useState<PaymentMethod>('transfer');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    zip: '',
    pickupPoint: '',
    note: '',
    companyName: '',
    ico: '',
    dic: '',
  });
  const [isCompany, setIsCompany] = useState(false);
  const [terms, setTerms] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [fireAck, setFireAck] = useState(false);
  const [fireSignature, setFireSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Jedno číslo objednávky na jeden pokus: když selže platební brána nebo
  // spojení, retry nesmí vytvořit druhou objednávku. Změna košíku ho resetuje.
  const orderIdRef = useRef<string | null>(null);
  useEffect(() => {
    orderIdRef.current = null;
  }, [lines]);

  useEffect(() => {
    fetch('/api/capabilities', { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (json?.data) {
          setCaps({
            card: Boolean(json.data.card),
            cod: Boolean(json.data.cod),
            codFeeCzk: Number(json.data.codFeeCzk) || 0,
            freeShippingFrom: Number(json.data.freeShippingFrom) || 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!caps.card && payment === 'card') setPayment('transfer');
    if (!caps.cod && payment === 'cod') setPayment('transfer');
  }, [caps, payment]);

  const rows = useMemo(
    () =>
      lines
        .map((line) => {
          const def = productById(line.externalId);
          const live = products.find((view) => view.externalId === line.externalId);
          if (!def) return null;
          return {
            line,
            def,
            priceCzk: live?.priceCzk ?? def.priceCzk,
            stock: live?.stock ?? def.stock,
            active: live?.active ?? def.active,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    [lines, products],
  );

  const subtotal = rows.reduce((sum, row) => sum + row.priceCzk * row.line.quantity, 0);
  const hasLantern = rows.some((row) => row.def.category === 'lampiony');
  const hasAddon = rows.some((row) => row.def.category === 'doplnky');
  const addonWithoutLantern = hasAddon && !hasLantern;
  const needsFire = requiresFireConsent(rows.map((row) => row.def));
  const shippingBase = SHIPPING_OPTIONS.find((option) => option.value === shipping)?.priceCzk ?? 0;
  const freeShipping =
    caps.freeShippingFrom > 0 && subtotal >= caps.freeShippingFrom && (shipping === 'zasilkovna' || shipping === 'zasilkovna-home');
  const shippingCzk = freeShipping ? 0 : shippingBase;
  const codCzk = payment === 'cod' ? caps.codFeeCzk : 0;
  const total = subtotal + shippingCzk + codCzk;
  const fireSigned = fireAck && fireSignature.trim().length >= 3;

  const needsAddress = shipping === 'zasilkovna-home';
  const needsPickup = shipping === 'zasilkovna';

  const canSubmit =
    ready &&
    rows.length > 0 &&
    form.name.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
    form.phone.trim().length >= 5 &&
    terms &&
    (!needsAddress || (form.street.trim() && form.city.trim() && form.zip.trim())) &&
    (!needsPickup || form.pickupPoint.trim().length >= 3) &&
    (!needsFire || fireSigned) &&
    !addonWithoutLantern &&
    (!isCompany || (form.companyName.trim().length > 1 && /^\d{8}$/.test(form.ico.replace(/\s/g, ''))));

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');

    const orderId =
      orderIdRef.current ??
      `LUMI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    orderIdRef.current = orderId;
    const payload = {
      orderId,
      lang,
      customer: {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: needsAddress
          ? { street: form.street.trim(), city: form.city.trim(), zip: form.zip.trim() }
          : null,
        newsletter,
        company: isCompany
          ? { name: form.companyName.trim(), ico: form.ico.replace(/\s/g, ''), dic: form.dic.replace(/\s/g, '') }
          : null,
      },
      shipping: {
        method: shipping,
        pickupPoint: needsPickup ? form.pickupPoint.trim() : null,
      },
      payment,
      note: form.note.trim(),
      items: lines.map((line) => ({ externalId: line.externalId, quantity: line.quantity })),
      termsAccepted: terms,
      fireSafety: needsFire
        ? {
            accepted: fireAck,
            signature: fireSignature.trim(),
            version: FIRE_CONSENT_VERSION,
            signedAt: new Date().toISOString(),
          }
        : undefined,
    };

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        setError(json?.error || 'Objednávku se nepodařilo odeslat.');
        setSubmitting(false);
        return;
      }

      try {
        window.sessionStorage.setItem('lumi_order_email', form.email.trim());
      } catch {
        /* ignore */
      }

      if (payment === 'card') {
        const stripeResponse = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, email: form.email.trim() }),
        });
        const stripeJson = await stripeResponse.json();
        if (stripeResponse.ok && stripeJson?.data?.url) {
          clear();
          window.location.href = stripeJson.data.url;
          return;
        }
        setError(stripeJson?.error || 'Platební bránu se nepodařilo otevřít.');
        setSubmitting(false);
        return;
      }

      clear();
      orderIdRef.current = null;
      router.push(`/objednavka/${encodeURIComponent(orderId)}`);
    } catch {
      setError('Objednávku se nepodařilo odeslat. Zkuste to prosím znovu.');
      setSubmitting(false);
    }
  }

  if (ready && rows.length === 0) {
    return (
      <div className="container-lumi py-20">
        <div className="card-warm mx-auto max-w-xl p-10 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-amber-700/60" />
          <h1 className="h3 mt-4">{pick({ cs: 'Košík je prázdný', en: 'Your cart is empty', de: 'Ihr Warenkorb ist leer' }, lang)}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {pick({ cs: 'Vyberte si lampion a začneme.', en: 'Choose a lantern and let’s begin.', de: 'Wählen Sie eine Laterne und los geht’s.' }, lang)}
          </p>
          <Link href="/kolekce" className="btn-primary mt-6">
            {pick({ cs: 'Zobrazit kolekci', en: 'See the collection', de: 'Kollektion ansehen' }, lang)}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-lumi py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{pick({ cs: 'Košík', en: 'Cart', de: 'Warenkorb' }, lang)}</p>
          <h1 className="h2 mt-2">{pick({ cs: 'Dokončení objednávky', en: 'Checkout', de: 'Bestellung abschließen' }, lang)}</h1>
        </div>
        <Link href="/kolekce" className="text-sm link-underline">
          {pick({ cs: 'Pokračovat v nákupu', en: 'Continue shopping', de: 'Weiter einkaufen' }, lang)}
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Levá část */}
        <div className="space-y-6">
          <section className="card-warm p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
              <ShoppingBag className="h-4 w-4" /> {pick({ cs: 'Položky', en: 'Items', de: 'Artikel' }, lang)} ({count})
            </h2>
            {addonWithoutLantern && (
              <p className="mt-3 rounded-lg border border-amber-600/30 bg-amber-500/10 p-3 text-sm text-amber-900">
                {pick(
                  {
                    cs: 'Personalizace a dárkové balení se objednávají spolu s lampionem. Přidejte prosím Lumi, Mini nebo Kit.',
                    en: 'Personalisation and gift wrapping are ordered together with a lantern. Please add Lumi, Mini or Kit.',
                    de: 'Personalisierung und Geschenkverpackung werden zusammen mit einer Laterne bestellt. Bitte fügen Sie Lumi, Mini oder Kit hinzu.',
                  },
                  lang,
                )}
              </p>
            )}
            <div className="mt-4 divide-y divide-line">
              {rows.map(({ line, def, priceCzk }) => (
                <div key={line.externalId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <Link href={`/kolekce/${def.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-parchment-deep">
                    <img
                      src={imageVariant(def.image, 200)}
                      alt={pick(def.name, lang)}
                      width={80}
                      height={80}
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/kolekce/${def.slug}`} className="text-sm font-semibold text-ink hover:text-amber-800">
                      {pick(def.name, lang)}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">{pick(def.leadTime, lang)}</p>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-line bg-card/70">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.externalId, line.quantity - 1)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink/5"
                      aria-label="−"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.externalId, line.quantity + 1)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink/5"
                      aria-label="+"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-right text-sm font-semibold text-ink sm:w-24">
                    <Price value={priceCzk * line.quantity} />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(line.externalId)}
                    className="self-end rounded-full p-2 text-muted transition-colors hover:bg-rust/10 hover:text-rust sm:self-auto"
                    aria-label={pick({ cs: 'Odebrat', en: 'Remove', de: 'Entfernen' }, lang)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="card-warm p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
              <Truck className="h-4 w-4" /> {pick({ cs: 'Doprava', en: 'Shipping', de: 'Versand' }, lang)}
            </h2>
            <div className="mt-4 space-y-2">
              {SHIPPING_OPTIONS.map((option) => {
                const price = freeShipping && option.value !== 'osobni-odber' ? 0 : option.priceCzk;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
                      shipping === option.value ? 'border-ink bg-ink/[0.03]' : 'border-line bg-card/40 hover:border-ink/30',
                    )}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      checked={shipping === option.value}
                      onChange={() => setShipping(option.value)}
                      className="mt-1 accent-amber-700"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">{pick(option.label, lang)}</p>
                      <p className="mt-0.5 text-xs text-muted">{pick(option.hint, lang)}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink">
                      {price === 0 ? pick({ cs: 'zdarma', en: 'free', de: 'kostenlos' }, lang) : <Price value={price} />}
                    </span>
                  </label>
                );
              })}
            </div>

            {needsPickup && (
              <label className="mt-4 block">
                <span className="label">{pick({ cs: 'Výdejní místo', en: 'Pickup point', de: 'Abholstelle' }, lang)} *</span>
                <input
                  value={form.pickupPoint}
                  onChange={(event) => setForm({ ...form, pickupPoint: event.target.value })}
                  placeholder={pick(
                    { cs: 'např. Z-Box Náměstí', en: 'e.g. Z-Box Náměstí', de: 'z. B. Z-Box Náměstí' },
                    lang,
                  )}
                  className="input"
                  required
                />
                <span className="mt-1 block text-xs text-muted">
                  {pick(
                    {
                      cs: 'Název nebo adresu výdejního místa Zásilkovny.',
                      en: 'Name or address of the Zásilkovna pickup point.',
                      de: 'Name oder Adresse der Zásilkovna-Abholstelle.',
                    },
                    lang,
                  )}
                </span>
              </label>
            )}
          </section>

          <section className="card-warm p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
              <User className="h-4 w-4" /> {pick({ cs: 'Kontaktní údaje', en: 'Contact details', de: 'Kontaktdaten' }, lang)}
            </h2>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">{pick({ cs: 'Jméno a příjmení', en: 'Full name', de: 'Vor- und Nachname' }, lang)} *</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" autoComplete="name" />
                </label>
                <label className="block">
                  <span className="label">{pick({ cs: 'E-mail', en: 'E-mail', de: 'E-Mail' }, lang)} *</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" autoComplete="email" />
                </label>
              </div>
              <label className="block">
                <span className="label">{pick({ cs: 'Telefon', en: 'Phone', de: 'Telefon' }, lang)} *</span>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" autoComplete="tel" />
              </label>

              {needsAddress && (
                <div className="space-y-4 border-t border-line pt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                    {pick({ cs: 'Dodací adresa', en: 'Delivery address', de: 'Lieferadresse' }, lang)}
                  </p>
                  <label className="block">
                    <span className="label">{pick({ cs: 'Ulice a číslo', en: 'Street and number', de: 'Straße und Hausnummer' }, lang)} *</span>
                    <input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} className="input" autoComplete="street-address" />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="label">{pick({ cs: 'Město', en: 'City', de: 'Stadt' }, lang)} *</span>
                      <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" autoComplete="address-level2" />
                    </label>
                    <label className="block">
                      <span className="label">{pick({ cs: 'PSČ', en: 'Postal code', de: 'Postleitzahl' }, lang)} *</span>
                      <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className="input" autoComplete="postal-code" />
                    </label>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} className="h-4 w-4 accent-amber-700" />
                {pick({ cs: 'Nakupuji na firmu', en: 'Buying for a company', de: 'Ich kaufe für eine Firma' }, lang)}
              </label>
              {isCompany && (
                <div className="space-y-4 rounded-xl border border-line bg-card/50 p-4">
                  <label className="block">
                    <span className="label">{pick({ cs: 'Název firmy', en: 'Company name', de: 'Firmenname' }, lang)} *</span>
                    <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="input" autoComplete="organization" />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="label">{pick({ cs: 'IČO', en: 'Company ID', de: 'Handelsregisternummer' }, lang)} *</span>
                      <input value={form.ico} onChange={(e) => setForm({ ...form, ico: e.target.value })} className="input" inputMode="numeric" />
                    </label>
                    <label className="block">
                      <span className="label">{pick({ cs: 'DIČ', en: 'VAT ID', de: 'USt-IdNr.' }, lang)}</span>
                      <input value={form.dic} onChange={(e) => setForm({ ...form, dic: e.target.value })} className="input" />
                    </label>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="label">{pick({ cs: 'Poznámka k objednávce', en: 'Order note', de: 'Bestellnotiz' }, lang)}</span>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="input"
                  placeholder={pick(
                    { cs: 'Vzkaz na kartičku, jména k personalizaci, jiná adresa…', en: 'Card message, names for personalisation, another address…', de: 'Kartennachricht, Namen zur Personalisierung, andere Adresse…' },
                    lang,
                  )}
                />
              </label>
            </div>
          </section>

          {needsFire && (
            <section className="card-warm border-2 border-amber-700/30 bg-amber-500/[0.05] p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                <Flame className="h-5 w-5 text-amber-700" /> {pick(FIRE_SAFETY.title, lang)}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pick(FIRE_SAFETY.lead, lang)}</p>
              <ol className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
                {FIRE_SAFETY.points.map((point, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="shrink-0 font-semibold text-amber-700">{index + 1}.</span>
                    <span>{renderBold(pick(point, lang))}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs leading-relaxed text-muted">{pick(FIRE_SAFETY.disclaimer, lang)}</p>
              <label className="mt-4 flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={fireAck} onChange={(e) => setFireAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-700" />
                {pick(FIRE_SAFETY.ackLabel, lang)}
              </label>
              <label className="mt-3 block">
                <span className="label">{pick(FIRE_SAFETY.signatureLabel, lang)}</span>
                <input
                  value={fireSignature}
                  onChange={(e) => setFireSignature(e.target.value)}
                  className="input"
                  placeholder={form.name}
                  autoComplete="off"
                />
                <span className="mt-1 block text-[11px] text-muted">{pick(FIRE_SAFETY.signatureHint, lang)}</span>
              </label>
            </section>
          )}
        </div>

        {/* Pravá část — souhrn */}
        <div className="space-y-6">
          <section className="card-warm p-5">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
              <CreditCard className="h-4 w-4" /> {pick({ cs: 'Platba', en: 'Payment', de: 'Zahlung' }, lang)}
            </h2>
            <div className="mt-4 space-y-2">
              {(
                [
                  { value: 'transfer' as const, title: { cs: 'Bankovní převod', en: 'Bank transfer', de: 'Banküberweisung' }, desc: { cs: 'Pošleme QR kód a číslo účtu.', en: 'We send a QR code and bank details.', de: 'Sie erhalten QR-Code und Bankdaten.' } },
                  ...(caps.cod
                    ? [{ value: 'cod' as const, title: { cs: 'Dobírka', en: 'Cash on delivery', de: 'Nachnahme' }, desc: { cs: `Příplatek ${caps.codFeeCzk} Kč.`, en: `Fee CZK ${caps.codFeeCzk}.`, de: `Gebühr ${caps.codFeeCzk} CZK.` } }]
                    : []),
                  ...(caps.card
                    ? [{ value: 'card' as const, title: { cs: 'Karta', en: 'Card', de: 'Karte' }, desc: { cs: 'Zaplatíte přes Stripe.', en: 'Pay via Stripe.', de: 'Zahlung über Stripe.' } }]
                    : []),
                ]
              ).map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
                    payment === option.value ? 'border-ink bg-ink/[0.03]' : 'border-line bg-card/40 hover:border-ink/30',
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === option.value}
                    onChange={() => setPayment(option.value)}
                    className="mt-1 accent-amber-700"
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink">{pick(option.title, lang)}</p>
                    <p className="mt-0.5 text-xs text-muted">{pick(option.desc, lang)}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="card-warm border-2 border-ink/10 p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              {pick({ cs: 'Souhrn', en: 'Summary', de: 'Übersicht' }, lang)}
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">{pick({ cs: 'Zboží', en: 'Items', de: 'Artikel' }, lang)}</dt>
                <dd className="font-medium text-ink">
                  <Price value={subtotal} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">{pick({ cs: 'Doprava', en: 'Shipping', de: 'Versand' }, lang)}</dt>
                <dd className="font-medium text-ink">
                  {shippingCzk === 0 ? pick({ cs: 'zdarma', en: 'free', de: 'kostenlos' }, lang) : <Price value={shippingCzk} />}
                </dd>
              </div>
              {codCzk > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{pick({ cs: 'Dobírka', en: 'Cash on delivery', de: 'Nachnahme' }, lang)}</dt>
                  <dd className="font-medium text-ink">
                    <Price value={codCzk} />
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
                <dt>{pick({ cs: 'Celkem', en: 'Total', de: 'Gesamt' }, lang)}</dt>
                <dd>
                  <Price value={total} />
                </dd>
              </div>
            </dl>

            <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-700" />
              <span>
                {pick({ cs: 'Souhlasím s', en: 'I agree to the', de: 'Ich stimme den' }, lang)}{' '}
                <Link href="/obchodni-podminky" className="link-underline text-ink">
                  {pick({ cs: 'obchodními podmínkami', en: 'terms and conditions', de: 'AGB' }, lang)}
                </Link>
                ,{' '}
                <Link href="/nakupni-rad" className="link-underline text-ink">
                  {pick({ cs: 'nákupním řádem', en: 'order process', de: 'Bestellregeln' }, lang)}
                </Link>{' '}
                {pick({ cs: 'a beru na vědomí', en: 'and acknowledge', de: 'zu und nehme zur Kenntnis' }, lang)}{' '}
                <Link href="/ochrana-osobnich-udaju" className="link-underline text-ink">
                  {pick({ cs: 'zpracování osobních údajů', en: 'the privacy policy', de: 'die Datenschutzerklärung' }, lang)}
                </Link>
                .
              </span>
            </label>

            <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
              <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-700" />
              {pick({ cs: 'Chci dostávat novinky Lumi (jeden e-mail za sezónu).', en: 'Send me Lumi news (one e-mail per season).', de: 'Ich möchte Lumi-Neuigkeiten (eine E-Mail pro Saison).' }, lang)}
            </label>

            {error && (
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-rust/30 bg-rust/10 p-3 text-sm text-rust">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}

            <button type="button" onClick={submit} disabled={!canSubmit || submitting} className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting
                ? pick({ cs: 'Odesílám…', en: 'Sending…', de: 'Wird gesendet…' }, lang)
                : pick({ cs: 'Dokončit objednávku', en: 'Complete order', de: 'Bestellung abschließen' }, lang)}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">
              {pick(
                { cs: 'Odesláním vzniká objednávka. Platbu potvrdíme e-mailem.', en: 'Sending creates an order. We confirm payment by e-mail.', de: 'Mit dem Senden entsteht eine Bestellung. Die Zahlung bestätigen wir per E-Mail.' },
                lang,
              )}
            </p>
            <p className="mt-2 text-center text-[11px] text-muted">
              {pick({ cs: 'Máte právo odstoupit do 14 dnů.', en: 'You have the right to withdraw within 14 days.', de: 'Sie haben ein 14-tägiges Widerrufsrecht.' }, lang)}{' '}
              <Link href="/odstoupeni-od-smlouvy" className="link-underline text-ink">
                {pick({ cs: 'Postup a formulář', en: 'Process and form', de: 'Ablauf und Formular' }, lang)}
              </Link>
            </p>
            <p className="mt-1 text-center text-[11px] text-muted">
              {pick({ cs: 'Ceny jsou konečné, nejsme plátci DPH.', en: 'Prices are final; we are not VAT payers.', de: 'Preise sind endgültig; wir sind keine Umsatzsteuerzahler.' }, lang)}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
