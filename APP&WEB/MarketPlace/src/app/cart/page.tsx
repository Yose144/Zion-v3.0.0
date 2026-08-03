'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Trash2, Minus, Plus, Truck, User, CreditCard, Check, AlertTriangle, X } from 'lucide-react';
import { useCart } from '@/components/shop/CartContext';
import { SHIPPING_PRICES, type ShippingMethod } from '@/types/shop';
import { isVirtualOnlyCart, createShopOrder, createStripeCheckoutSession } from '@/lib/shop-api';
import { useLangT } from '@/lib/useTranslation';

const shippingOptions: { value: ShippingMethod; labelKey: string; descKey: string; price: number }[] = [
  { value: 'zasilkovna', labelKey: 'cart.shippingZasilkovna', descKey: 'cart.shippingZasilkovnaDesc', price: SHIPPING_PRICES.zasilkovna },
  { value: 'zasilkovna-home', labelKey: 'cart.shippingZasilkovnaHome', descKey: 'cart.shippingZasilkovnaHomeDesc', price: SHIPPING_PRICES['zasilkovna-home'] },
  { value: 'virtualni-nakup', labelKey: 'cart.shippingVirtualBuy', descKey: 'cart.shippingVirtualBuyDesc', price: SHIPPING_PRICES['virtualni-nakup'] },
  { value: 'virtualni-odber', labelKey: 'cart.shippingVirtualPickup', descKey: 'cart.shippingVirtualPickupDesc', price: SHIPPING_PRICES['virtualni-odber'] },
];

export default function CartPage() {
  const { items, count, total, updateQuantity, remove, clear } = useCart();
  const router = useRouter();
  const { t } = useLangT();

  const [shipping, setShipping] = useState<ShippingMethod>('zasilkovna');
  const [payment, setPayment] = useState<'transfer' | 'card' | 'crypto'>('transfer');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    zip: '',
    note: '',
  });
  const [terms, setTerms] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    qrCode: string;
    bank: { account: string; iban: string; bic: string; vs: string; amount: number };
  } | null>(null);

  const virtualOnly = useMemo(() => isVirtualOnlyCart(items), [items]);

  useEffect(() => {
    if (virtualOnly && shipping !== 'virtualni-nakup' && shipping !== 'virtualni-odber') {
      setShipping('virtualni-nakup');
    }
  }, [virtualOnly, shipping]);

  const shippingPrice = SHIPPING_PRICES[shipping];
  const finalTotal = total + shippingPrice;
  const zionTokens = items.reduce((sum, item) => sum + item.tokens * item.quantity, 0);

  const needsAddress = shipping === 'zasilkovna-home';
  const needsPickup = shipping === 'zasilkovna';

  const canSubmit =
    items.length > 0 &&
    form.name.trim() &&
    form.email.trim() &&
    form.phone.trim() &&
    terms &&
    (!needsAddress || (form.street && form.city && form.zip));

  const formatPrice = (price: number) => t('common.price', { price, symbol: t('common.kcSymbol') });

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    const orderId = `ORD-${Math.floor(Date.now() / 1000)}-${Math.random().toString(36).substring(2, 8)}`;

    const result = await createShopOrder({
      orderId,
      customer: {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: needsAddress
          ? { street: form.street.trim(), city: form.city.trim(), zip: form.zip.trim() }
          : null,
        newsletter,
      },
      shipping: { method: shipping, price: shippingPrice },
      payment,
      note: form.note,
      items,
      total: finalTotal,
      zionTokens,
      termsAccepted: terms,
    });

    if (result?.success && result.data) {
      setOrderResult({
        orderId,
        qrCode: result.data.bank.qrCode,
        bank: result.data.bank,
      });
      if (payment === 'transfer') {
        setShowQr(true);
      } else if (payment === 'card') {
        const stripeResult = await createStripeCheckoutSession(orderId, form.email.trim());
        if (stripeResult?.success && stripeResult.data?.url) {
          clear();
          window.location.href = stripeResult.data.url;
          return;
        }
        alert(stripeResult?.error || t('cart.alertStripeError'));
      } else {
        clear();
        router.push(`/order-success?order=${encodeURIComponent(orderId)}`);
      }
    } else {
      alert(result?.error || t('cart.alertOrderError'));
    }

    setSubmitting(false);
  }

  const closeQr = () => {
    setShowQr(false);
    clear();
    router.push(`/order-success?order=${encodeURIComponent(orderResult?.orderId ?? '')}`);
  };

  const termsText = t('cart.terms', { termsLink: '%%LINK%%' });
  const [termsBefore, termsAfter] = termsText.includes('%%LINK%%')
    ? termsText.split('%%LINK%%')
    : [termsText, ''];

  if (items.length === 0 && !showQr) {
    return (
      <div className="zion-section p-16 text-center max-w-2xl mx-auto">
        <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-oasis-gold opacity-60" />
        <h1 className="text-2xl font-black font-display mb-2">{t('cart.emptyTitle')}</h1>
        <p className="text-gray-500 mb-6">{t('cart.emptySubtitle')}</p>
        <Link href="/shop" className="zion-button-primary">
          <ShoppingCart className="w-4 h-4" /> {t('cart.openCatalog')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black font-display mb-2 inline-flex items-center justify-center gap-3">
          <ShoppingCart className="w-8 h-8 text-oasis-gold" /> {t('cart.title')}
        </h1>
        <p className="text-gray-500">{t('cart.headerCount', { count, total: finalTotal, symbol: t('common.kcSymbol') })}</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Cart items */}
        <section className="zion-section p-5 space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5"
            >
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-black/30 flex-shrink-0">
                <img
                  src={item.image}
                  alt={item.name}
                  onError={(e) => { e.currentTarget.src = '/shop/img/shared/logo.jpg'; }}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white truncate">{item.name}</div>
                <div className="text-xs text-gray-500 capitalize">{item.category}</div>
                <div className="text-xs text-oasis-gold">{t('cart.tokens', { amount: item.tokens })}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="zion-button-icon zion-button-ghost w-8 h-8"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-mono font-bold">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="zion-button-icon zion-button-ghost w-8 h-8"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="font-mono font-bold text-white min-w-[80px] text-right">
                {formatPrice(item.priceCzk * item.quantity)}
              </div>
              <button
                onClick={() => remove(item.id)}
                className="zion-button-icon zion-button-ghost text-oasis-rose hover:text-oasis-rose/80"
                title={t('cart.remove')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </section>

        {/* Checkout */}
        <section className="space-y-4">
          {/* Shipping */}
          <div className="zion-section p-5">
            <h2 className="text-lg font-black font-display mb-4 flex items-center gap-2 text-oasis-emerald">
              <Truck className="w-5 h-5" /> {t('cart.sectionShipping')}
            </h2>
            <div className="space-y-2">
              {shippingOptions.map((opt) => {
                const disabled = virtualOnly && opt.price > 0;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      shipping === opt.value
                        ? 'border-oasis-emerald bg-oasis-emerald/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      value={opt.value}
                      checked={shipping === opt.value}
                      onChange={() => setShipping(opt.value)}
                      disabled={disabled}
                      className="accent-oasis-emerald"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-sm">{t(opt.labelKey)}</div>
                      <div className="text-xs text-gray-500">{t(opt.descKey)}</div>
                    </div>
                    <div className="font-mono font-bold text-sm">
                      {opt.price === 0 ? t('cart.shippingFree') : t('cart.shippingPrice', { price: opt.price, symbol: t('common.kcSymbol') })}
                    </div>
                  </label>
                );
              })}
            </div>

            {needsPickup && (
              <div className="mt-4 p-3 rounded-xl bg-oasis-emerald/5 border border-oasis-emerald/20 text-sm text-gray-300">
                {t('cart.pickupNote')}
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="zion-section p-5">
            <h2 className="text-lg font-black font-display mb-4 flex items-center gap-2 text-oasis-gold">
              <User className="w-5 h-5" /> {t('cart.sectionCustomer')}
            </h2>
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder={t('cart.placeholderName')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-zion w-full"
                  required
                />
                <input
                  type="email"
                  placeholder={t('cart.placeholderEmail')}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-zion w-full"
                  required
                />
              </div>
              <input
                type="tel"
                placeholder={t('cart.placeholderPhone')}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input-zion w-full"
                required
              />

              {needsAddress && (
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <h3 className="text-sm font-bold text-gray-300">{t('cart.sectionAddress')}</h3>
                  <input
                    type="text"
                    placeholder={t('cart.placeholderStreet')}
                    value={form.street}
                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                    className="input-zion w-full"
                    required
                  />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder={t('cart.placeholderCity')}
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="input-zion w-full"
                      required
                    />
                    <input
                      type="text"
                      placeholder={t('cart.placeholderZip')}
                      value={form.zip}
                      onChange={(e) => setForm({ ...form, zip: e.target.value })}
                      className="input-zion w-full"
                      required
                    />
                  </div>
                </div>
              )}

              <textarea
                placeholder={t('cart.placeholderNote')}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="input-zion w-full min-h-[80px]"
                rows={3}
              />
            </div>
          </div>

          {/* Payment */}
          <div className="zion-section p-5">
            <h2 className="text-lg font-black font-display mb-4 flex items-center gap-2 text-oasis-rose">
              <CreditCard className="w-5 h-5" /> {t('cart.sectionPayment')}
            </h2>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                payment === 'transfer' ? 'border-oasis-rose bg-oasis-rose/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}>
                <input
                  type="radio"
                  name="payment"
                  value="transfer"
                  checked={payment === 'transfer'}
                  onChange={() => setPayment('transfer')}
                  className="accent-oasis-rose"
                />
                <div className="flex-1">
                  <div className="font-bold text-sm">{t('cart.paymentTransfer')}</div>
                  <div className="text-xs text-gray-500">{t('cart.paymentTransferDesc')}</div>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                payment === 'card' ? 'border-oasis-rose bg-oasis-rose/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}>
                <input
                  type="radio"
                  name="payment"
                  value="card"
                  checked={payment === 'card'}
                  onChange={() => setPayment('card')}
                  className="accent-oasis-rose"
                />
                <div className="flex-1">
                  <div className="font-bold text-sm">{t('cart.paymentCard')}</div>
                  <div className="text-xs text-gray-500">{t('cart.paymentCardDesc')}</div>
                </div>
              </label>
            </div>
          </div>

          {/* Summary */}
          <div className="zion-section p-5 border-2 border-oasis-gold/30 bg-oasis-gold/5">
            <h2 className="text-lg font-black font-display mb-4 flex items-center gap-2 text-gradient-gold">
              <Check className="w-5 h-5" /> {t('cart.sectionSummary')}
            </h2>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">{t('cart.summaryProducts')}</span>
                <span className="font-mono">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('cart.summaryShipping')}</span>
                <span className="font-mono">{shippingPrice === 0 ? t('cart.shippingFree') : t('cart.shippingPrice', { price: shippingPrice, symbol: t('common.kcSymbol') })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{t('cart.summaryBonus')}</span>
                <span className="font-mono text-oasis-gold">+{zionTokens}</span>
              </div>
              <div className="flex justify-between text-lg font-black border-t border-white/10 pt-2">
                <span>{t('cart.summaryTotal')}</span>
                <span className="text-gradient-gold">{formatPrice(finalTotal)}</span>
              </div>
            </div>

            <label className="flex items-start gap-3 text-sm mb-3">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-1 accent-oasis-emerald"
                required
              />
              <span className="text-gray-400">
                {termsBefore}<Link href="/terms" className="text-oasis-gold hover:underline">{t('cart.termsLink')}</Link>{termsAfter}
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm mb-5">
              <input
                type="checkbox"
                checked={newsletter}
                onChange={(e) => setNewsletter(e.target.checked)}
                className="mt-1 accent-oasis-cyan"
              />
              <span className="text-gray-400">{t('cart.newsletter')}</span>
            </label>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={`zion-button-primary w-full ${(!canSubmit || submitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {submitting ? (
                t('cart.submitting')
              ) : !canSubmit ? (
                <span className="inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {t('cart.fillRequired')}</span>
              ) : (
                <span className="inline-flex items-center gap-2"><Check className="w-4 h-4" /> {t('cart.completeOrder')}</span>
              )}
            </button>
          </div>
        </section>
      </div>

      {/* QR Modal */}
      {showQr && orderResult && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={closeQr}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="zion-panel w-full max-w-md relative z-10 p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={closeQr} className="absolute top-4 right-4 zion-button-icon zion-button-ghost">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-black font-display mb-2">{t('cart.qrTitle')}</h2>
            <p className="text-sm text-gray-400 mb-4">{t('cart.qrSubtitle')}</p>
            <img
              src={orderResult.qrCode}
              alt={t('cart.qrAlt')}
              className="w-56 h-56 mx-auto mb-4 bg-white p-2 rounded-xl"
            />
            <div className="space-y-2 text-sm text-left bg-white/5 p-4 rounded-xl mb-4">
              <div className="flex justify-between"><span className="text-gray-500">{t('cart.qrAccount')}</span><strong>{orderResult.bank.account}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('cart.qrIban')}</span><strong>{orderResult.bank.iban}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('cart.qrBic')}</span><strong>{orderResult.bank.bic}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('cart.qrVs')}</span><strong>{orderResult.bank.vs}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('cart.qrAmount')}</span><strong>{formatPrice(orderResult.bank.amount)}</strong></div>
            </div>
            <button onClick={closeQr} className="zion-button-primary w-full">
              <Check className="w-4 h-4" /> {t('cart.qrDone')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
