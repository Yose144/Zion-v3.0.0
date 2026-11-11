'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, Clock, Copy, Download, Package, Truck } from 'lucide-react';
import { pick, formatDate, type Localized } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { statusLabel } from '@/types/shop';
import { Price } from '@/components/price';

interface OrderItem {
  externalId: string;
  slug: string;
  name: Localized;
  quantity: number;
  unitPriceCzk: number;
  lineTotalCzk: number;
}

interface Bank {
  account: string;
  iban: string;
  bic: string;
  bankName: string;
  owner: string;
  amountCzk: number;
  variableSymbol: string;
  message: string;
  qrCode: string;
}

interface OrderData {
  orderId: string;
  status: string;
  paymentStatus: string;
  payment: string;
  shipping: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotalCzk: number;
  shippingCzk: number;
  codCzk: number;
  totalCzk: number;
  variableSymbol: string | null;
  invoiceNumber: string | null;
  trackingNumber: string | null;
  pickupPoint: string | null;
  createdAt: string;
  paidAt: string | null;
}

export default function OrderConfirmation({ orderId }: { orderId: string }) {
  const { lang } = useLang();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('lumi_order_email');
      if (stored) setEmail(stored);
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const fetchOrder = useCallback(
    async (mail: string) => {
      if (!mail) return;
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}?email=${encodeURIComponent(mail)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const json = await response.json();
        if (json?.success) {
          setOrder(json.data.order);
          setBank(json.data.bank);
          setError('');
        } else {
          setError(json?.error || pick({ cs: 'Objednávka nenalezena.', en: 'Order not found.', de: 'Bestellung nicht gefunden.' }, lang));
        }
      } catch {
        setError(pick({ cs: 'Objednávku se nepodařilo načíst.', en: 'The order could not be loaded.', de: 'Die Bestellung konnte nicht geladen werden.' }, lang));
      }
    },
    [orderId, lang],
  );

  // Po návratu ze Stripe ověříme session a teprve pak načteme objednávku.
  useEffect(() => {
    if (!loaded || !email) return;
    let cancelled = false;
    (async () => {
      if (sessionId) {
        try {
          await fetch('/api/stripe/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
        } catch {
          /* webhook to dohoní */
        }
      }
      if (!cancelled) await fetchOrder(email);
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, email, sessionId, fetchOrder]);

  // Lehké dotazování — stav se mění, když dorazí platba nebo se objednávka odešle.
  useEffect(() => {
    if (!order || order.paymentStatus === 'paid') return;
    const timer = window.setInterval(() => {
      void fetchOrder(email);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [order, email, fetchOrder]);

  const paid = order?.paymentStatus === 'paid';
  const items = useMemo(() => order?.items ?? [], [order]);

  if (!loaded) return null;

  if (!email || (!order && error)) {
    return (
      <div className="container-lumi py-16">
        <div className="card-warm mx-auto max-w-md p-8">
          <h1 className="h3">{pick({ cs: 'Sledování objednávky', en: 'Track your order', de: 'Bestellung verfolgen' }, lang)}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {pick({ cs: 'Zadejte e-mail, kterým jste objednávali.', en: 'Enter the e-mail you used for the order.', de: 'Geben Sie die E-Mail-Adresse der Bestellung ein.' }, lang)}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void fetchOrder(email);
            }}
            className="mt-5 space-y-3"
          >
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
              placeholder="vas@email.cz"
              autoComplete="email"
              required
            />
            <button type="submit" className="btn-primary w-full">
              {pick({ cs: 'Zobrazit objednávku', en: 'Show order', de: 'Bestellung anzeigen' }, lang)}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-rust">{error}</p>}
          <p className="mt-4 text-xs text-muted">
            {pick({ cs: 'Číslo objednávky', en: 'Order number', de: 'Bestellnummer' }, lang)}: <strong>{orderId}</strong>
          </p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-lumi py-16 text-center">
        <Clock className="mx-auto h-8 w-8 animate-pulse text-amber-700" />
        <p className="mt-3 text-sm text-ink-soft">{pick({ cs: 'Načítám objednávku…', en: 'Loading your order…', de: 'Bestellung wird geladen…' }, lang)}</p>
      </div>
    );
  }

  return (
    <div className="container-lumi py-10 lg:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <span className={`inline-flex h-14 w-14 items-center justify-center rounded-full ${paid ? 'bg-success/10 text-success' : 'bg-amber-500/15 text-amber-800'}`}>
            {paid ? <Check className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
          </span>
          <h1 className="h2 mt-4">
            {paid
              ? pick({ cs: 'Platba dorazila, děkujeme', en: 'Payment received, thank you', de: 'Zahlung eingegangen, danke' }, lang)
              : pick({ cs: 'Děkujeme za objednávku', en: 'Thank you for your order', de: 'Danke für Ihre Bestellung' }, lang)}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {pick({ cs: 'Číslo objednávky', en: 'Order number', de: 'Bestellnummer' }, lang)}:{' '}
            <strong className="text-ink">{order.orderId}</strong> · {formatDate(order.createdAt, lang)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {pick({ cs: 'Stav', en: 'Status', de: 'Status' }, lang)}: {statusLabel(order.status, lang)}
            {order.invoiceNumber ? ` · ${pick({ cs: 'Faktura', en: 'Invoice', de: 'Rechnung' }, lang)} ${order.invoiceNumber}` : ''}
          </p>
        </div>

        {!paid && order.payment === 'transfer' && bank && (
          <section className="card-warm mt-8 p-6 sm:p-8">
            <h2 className="h3">{pick({ cs: 'Zaplaťte převodem', en: 'Pay by bank transfer', de: 'Per Überweisung bezahlen' }, lang)}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {pick(
                {
                  cs: 'Naskenujte QR kód v aplikaci své banky, nebo opište údaje níže. Jako variabilní symbol použijte číslo objednávky.',
                  en: 'Scan the QR code in your banking app or use the details below. Use the order number as the payment reference.',
                  de: 'Scannen Sie den QR-Code in Ihrer Banking-App oder nutzen Sie die Angaben unten. Verwenden Sie die Bestellnummer als Verwendungszweck.',
                },
                lang,
              )}
            </p>
            <div className="mt-5 grid gap-6 sm:grid-cols-[180px_1fr] sm:items-center">
              <img src={bank.qrCode} alt="QR platba" className="mx-auto w-44 rounded-xl border border-line bg-white p-2" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">IBAN</dt>
                  <dd className="font-medium text-ink">{bank.iban}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{pick({ cs: 'Číslo účtu', en: 'Account', de: 'Konto' }, lang)}</dt>
                  <dd className="font-medium text-ink">{bank.account}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{pick({ cs: 'Variabilní symbol', en: 'Reference', de: 'Verwendungszweck' }, lang)}</dt>
                  <dd className="font-medium text-ink">
                    {bank.variableSymbol}
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(bank.variableSymbol);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                      }}
                      className="ml-2 inline-flex align-middle text-muted hover:text-ink"
                      aria-label="Kopírovat"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-semibold">
                  <dt>{pick({ cs: 'Částka', en: 'Amount', de: 'Betrag' }, lang)}</dt>
                  <dd>
                    <Price value={bank.amountCzk} />
                  </dd>
                </div>
              </dl>
            </div>
            {copied && <p className="mt-2 text-xs text-success">Zkopírováno</p>}
            <p className="mt-4 text-xs text-muted">
              {pick({ cs: 'Stav se aktualizuje automaticky.', en: 'The status updates automatically.', de: 'Der Status wird automatisch aktualisiert.' }, lang)}
            </p>
          </section>
        )}

        {!paid && order.payment === 'card' && (
          <section className="card-warm mt-8 p-6 text-sm leading-relaxed text-ink-soft">
            {pick(
              {
                cs: 'Platbu kartou vyřizuje Stripe. Jakmile ji potvrdí, stav se změní na „Zaplaceno“ a my začneme vyrábět.',
                en: 'Card payment is handled by Stripe. Once confirmed, the status changes to “Paid” and we start production.',
                de: 'Die Kartenzahlung wird von Stripe abgewickelt. Nach der Bestätigung wechselt der Status auf „Bezahlt“ und wir beginnen mit der Fertigung.',
              },
              lang,
            )}
          </section>
        )}

        {!paid && order.payment === 'cod' && (
          <section className="card-warm mt-8 p-6 text-sm leading-relaxed text-ink-soft">
            {pick(
              {
                cs: 'Zaplatíte při převzetí. Objednávku jsme přijali a ozveme se s termínem výroby.',
                en: 'You will pay on delivery. We have received the order and will confirm the production date.',
                de: 'Sie zahlen bei Lieferung. Wir haben die Bestellung erhalten und bestätigen den Produktionstermin.',
              },
              lang,
            )}
          </section>
        )}

        <section className="card-warm mt-6 p-6 sm:p-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            {pick({ cs: 'Objednávka', en: 'Your order', de: 'Ihre Bestellung' }, lang)}
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {items.map((item) => (
              <li key={`${item.externalId}-${item.quantity}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-ink">
                  {pick(item.name, lang)} <span className="text-muted">× {item.quantity}</span>
                </span>
                <span className="font-medium text-ink">
                  <Price value={item.lineTotalCzk} />
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{pick({ cs: 'Doprava', en: 'Shipping', de: 'Versand' }, lang)}</dt>
              <dd className="text-ink">
                {order.shippingCzk === 0 ? pick({ cs: 'zdarma', en: 'free', de: 'kostenlos' }, lang) : <Price value={order.shippingCzk} />}
              </dd>
            </div>
            {order.codCzk > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">{pick({ cs: 'Dobírka', en: 'Cash on delivery', de: 'Nachnahme' }, lang)}</dt>
                <dd className="text-ink">
                  <Price value={order.codCzk} />
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
              <dt>{pick({ cs: 'Celkem', en: 'Total', de: 'Gesamt' }, lang)}</dt>
              <dd>
                <Price value={order.totalCzk} />
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href={`/api/invoice/${encodeURIComponent(order.orderId)}?email=${encodeURIComponent(email)}`} className="btn-outline" target="_blank">
              <Download className="h-4 w-4" /> {pick({ cs: 'Faktura', en: 'Invoice', de: 'Rechnung' }, lang)}
            </Link>
            <Link href="/kolekce" className="btn-ghost">
              {pick({ cs: 'Zpět do kolekce', en: 'Back to the collection', de: 'Zurück zur Kollektion' }, lang)}
            </Link>
          </div>
        </section>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-parchment-deep/60 p-5 text-sm text-ink-soft">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p>
              {pick(
                {
                  cs: 'Vyrábíme na zakázku, obvykle odesíláme do 5 pracovních dnů. Potvrzení jsme poslali na e-mail.',
                  en: 'We make to order and usually ship within 5 working days. We sent a confirmation to your e-mail.',
                  de: 'Wir fertigen auf Bestellung und versenden meist innerhalb von 5 Werktagen. Eine Bestätigung haben wir per E-Mail gesendet.',
                },
                lang,
              )}
            </p>
            {order.trackingNumber && (
              <p className="mt-2 inline-flex items-center gap-2 font-medium text-ink">
                <Truck className="h-4 w-4" /> {pick({ cs: 'Sledovací číslo', en: 'Tracking number', de: 'Sendungsnummer' }, lang)}: {order.trackingNumber}
              </p>
            )}
            {order.pickupPoint && (
              <p className="mt-1 text-xs text-muted">
                {pick({ cs: 'Výdejní místo', en: 'Pickup point', de: 'Abholstelle' }, lang)}: {order.pickupPoint}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
