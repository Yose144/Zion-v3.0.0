'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Trash2, Minus, Plus, Truck, User, CreditCard, Check, AlertTriangle, X } from 'lucide-react';
import { useCart } from '@/components/shop/CartContext';
import { SHIPPING_PRICES, type ShippingMethod } from '@/types/shop';
import { isVirtualOnlyCart, createShopOrder, createStripeCheckoutSession, createCommerceCheckout, trackOrder } from '@/lib/shop-api';
import { useLangT } from '@/lib/useTranslation';

const shippingOptions: { value: ShippingMethod; labelKey: string; descKey: string; price: number }[] = [
  { value: 'zasilkovna', labelKey: 'cart.shippingZasilkovna', descKey: 'cart.shippingZasilkovnaDesc', price: SHIPPING_PRICES.zasilkovna },
  { value: 'zasilkovna-home', labelKey: 'cart.shippingZasilkovnaHome', descKey: 'cart.shippingZasilkovnaHomeDesc', price: SHIPPING_PRICES['zasilkovna-home'] },
  { value: 'virtualni-nakup', labelKey: 'cart.shippingVirtualBuy', descKey: 'cart.shippingVirtualBuyDesc', price: SHIPPING_PRICES['virtualni-nakup'] },
  { value: 'virtualni-odber', labelKey: 'cart.shippingVirtualPickup', descKey: 'cart.shippingVirtualPickupDesc', price: SHIPPING_PRICES['virtualni-odber'] },
];

type ShopCapabilities = {
  softLaunch: boolean;
  stripe: boolean;
  email: boolean;
  modes: { transfer: boolean; card: boolean; crypto: boolean; zion?: boolean; commerce?: boolean };
};

type ZionPayData = {
  address: string;
  memo: string;
  amountZion: number;
  uri: string;
  qrCode: string;
  cliHint: string;
};

export default function CartPage() {
  const { items, count, total, updateQuantity, remove, clear } = useCart();
  const router = useRouter();
  const { t } = useLangT();

  const [shipping, setShipping] = useState<ShippingMethod>('zasilkovna');
  const [payment, setPayment] = useState<'transfer' | 'card' | 'crypto' | 'zion' | 'commerce'>('transfer');
  const [caps, setCaps] = useState<ShopCapabilities | null>(null);
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
  const [submitting, setSubmitting] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    qrCode: string;
    bank: { account: string; iban: string; bic: string; vs: string; amount: number };
    zion?: ZionPayData | null;
  } | null>(null);
  const [showZionQr, setShowZionQr] = useState(false);
  const [zionPaid, setZionPaid] = useState(false);

  const virtualOnly = useMemo(() => isVirtualOnlyCart(items), [items]);
  const cardEnabled = caps?.modes.card ?? false;
  const zionEnabled = caps?.modes.zion ?? true;
  const commerceEnabled = caps?.modes.commerce ?? false;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/shop/capabilities', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j) setCaps(j as ShopCapabilities);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (caps && !caps.modes.card && payment === 'card') {
      setPayment('transfer');
    }
  }, [caps, payment]);

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
    (!needsAddress || (form.street && form.city && form.zip)) &&
    (!needsPickup || form.pickupPoint.trim().length >= 3) &&
    (!isCompany || (form.companyName.trim() && /^\d{8}$/.test(form.ico.replace(/\s/g, ''))));

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
        company: isCompany
          ? {
              name: form.companyName.trim(),
              ico: form.ico.replace(/\s/g, ''),
              dic: form.dic.replace(/\s/g, ''),
            }
          : null,
      },
      shipping: {
        method: shipping,
        price: shippingPrice,
        pickupPoint: needsPickup
          ? { name: form.pickupPoint.trim(), source: 'manual' }
          : undefined,
      },
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
        zion: result.data.zion ?? null,
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
      } else if (payment === 'commerce') {
        const co = await createCommerceCheckout(orderId);
        if (co?.success && co.data?.hostedUrl) {
          clear();
          window.location.href = co.data.hostedUrl;
          return;
        }
        alert(co?.error || t('cart.alertCommerceError'));
      } else if (payment === 'zion' || payment === 'crypto') {
        if (result.data.zion) {
          setZionPaid(false);
          setShowZionQr(true);
        } else {
          clear();
          router.push(`/order-success?order=${encodeURIComponent(orderId)}`);
        }
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

  const closeZionQr = () => {
    setShowZionQr(false);
    clear();
    router.push(`/order-success?order=${encodeURIComponent(orderResult?.orderId ?? '')}`);
  };

  // Poll order status while the ZION QR modal is open — flips to a paid
  // state once the l1-watcher confirms the SHOPPAY transaction.
  useEffect(() => {
    if (!showZionQr || zionPaid || !orderResult) return;
    const email = form.email.trim();
    let cancelled = false;
    const tick = async () => {
      const res = await trackOrder(orderResult.orderId, email);
      if (cancelled) return;
      if (res?.success && res.data?.paymentStatus === 'paid') {
        setZionPaid(true);
      }
    };
    const iv = setInterval(tick, 10_000);
    tick();
    return () => { cancelled = true; clearInterval(iv); };
  }, [showZionQr, zionPaid, orderResult, form.email]);

  const termsText = t('cart.terms', { termsLink: '%%LINK%%' });
  const [termsBefore, termsAfter] = termsText.includes('%%LINK%%')
    ? termsText.split('%%LINK%%')
    : [termsText, ''];

  if (items.length === 0 && !showQr) {
    return (
      <div className="zion-section p-16 text-center max-w-2xl mx-auto">
        <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-rasta-gold opacity-60" />
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
          <ShoppingCart className="w-8 h-8 text-rasta-gold" /> {t('cart.title')}
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
                <div className="text-xs text-rasta-gold">{t('cart.tokens', { amount: item.tokens })}</div>
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
                className="zion-button-icon zion-button-ghost text-rasta-red hover:text-rasta-red/80"
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
            <h2 className="text-lg font-black font-display mb-4 flex items-center gap-2 text-rasta-green">
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
                        ? 'border-rasta-green bg-rasta-green/10'
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
                      className="accent-rasta-green"
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
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-300">{t('cart.pickupNote')}</p>
                <input
                  type="text"
                  value={form.pickupPoint}
                  onChange={(e) => setForm({ ...form, pickupPoint: e.target.value })}
                  placeholder={t('cart.placeholderPickup')}
                  className="input-zion w-full"
                  required
                />
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="zion-section p-5">
            <h2 className="text-lg font-black font-display mb-4 flex items-center gap-2 text-rasta-gold">
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

              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isCompany}
                  onChange={(e) => setIsCompany(e.target.checked)}
                  className="w-4 h-4 accent-rasta-gold"
                />
                {t('cart.companyToggle')}
              </label>
              {isCompany && (
                <div className="space-y-3 p-3 rounded-xl border border-rasta-gold/30 bg-rasta-gold/5">
                  <input
                    type="text"
                    placeholder={t('cart.placeholderCompany')}
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="input-zion w-full"
                    required
                  />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={t('cart.placeholderIco')}
                      value={form.ico}
                      onChange={(e) => setForm({ ...form, ico: e.target.value })}
                      className="input-zion w-full"
                      required
                    />
                    <input
                      type="text"
                      placeholder={t('cart.placeholderDic')}
                      value={form.dic}
                      onChange={(e) => setForm({ ...form, dic: e.target.value })}
                      className="input-zion w-full"
                    />
                  </div>
                </div>
              )}

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
            <h2 className="text-lg font-black font-display mb-4 flex items-center gap-2 text-rasta-red">
              <CreditCard className="w-5 h-5" /> {t('cart.sectionPayment')}
            </h2>
            {caps?.softLaunch && (
              <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {t('cart.softLaunchBanner')}
                {!caps.email && (
                  <span className="mt-1 block text-amber-200/80">{t('cart.softLaunchNoEmail')}</span>
                )}
              </div>
            )}
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                payment === 'transfer' ? 'border-rasta-red bg-rasta-red/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}>
                <input
                  type="radio"
                  name="payment"
                  value="transfer"
                  checked={payment === 'transfer'}
                  onChange={() => setPayment('transfer')}
                  className="accent-rasta-red"
                />
                <div className="flex-1">
                  <div className="font-bold text-sm">{t('cart.paymentTransfer')}</div>
                  <div className="text-xs text-gray-500">{t('cart.paymentTransferDesc')}</div>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                !cardEnabled
                  ? 'cursor-not-allowed opacity-50 border-white/5 bg-white/[0.03]'
                  : payment === 'card'
                    ? 'cursor-pointer border-rasta-red bg-rasta-red/10'
                    : 'cursor-pointer border-white/10 bg-white/5 hover:bg-white/10'
              }`}>
                <input
                  type="radio"
                  name="payment"
                  value="card"
                  checked={payment === 'card'}
                  disabled={!cardEnabled}
                  onChange={() => cardEnabled && setPayment('card')}
                  className="accent-rasta-red"
                />
                <div className="flex-1">
                  <div className="font-bold text-sm">{t('cart.paymentCard')}</div>
                  <div className="text-xs text-gray-500">
                    {cardEnabled ? t('cart.paymentCardDesc') : t('cart.paymentCardSoon')}
                  </div>
                </div>
              </label>
              {zionEnabled && (
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  payment === 'zion' ? 'border-rasta-gold bg-rasta-gold/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}>
                  <input
                    type="radio"
                    name="payment"
                    value="zion"
                    checked={payment === 'zion'}
                    onChange={() => setPayment('zion')}
                    className="accent-rasta-gold"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-sm">{t('cart.paymentZion')}</div>
                    <div className="text-xs text-gray-500">{t('cart.paymentZionDesc')}</div>
                  </div>
                </label>
              )}
              {commerceEnabled && (
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  payment === 'commerce' ? 'border-rasta-gold bg-rasta-gold/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}>
                  <input
                    type="radio"
                    name="payment"
                    value="commerce"
                    checked={payment === 'commerce'}
                    onChange={() => setPayment('commerce')}
                    className="accent-rasta-gold"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-sm">{t('cart.paymentCommerce')}</div>
                    <div className="text-xs text-gray-500">{t('cart.paymentCommerceDesc')}</div>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="zion-section p-5 border-2 border-rasta-gold/30 bg-rasta-gold/5">
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
                <span className="font-mono text-rasta-gold">+{zionTokens}</span>
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
                className="mt-1 accent-rasta-green"
                required
              />
              <span className="text-gray-400">
                {termsBefore}<Link href="/terms" className="text-rasta-gold hover:underline">{t('cart.termsLink')}</Link>{termsAfter}
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm mb-5">
              <input
                type="checkbox"
                checked={newsletter}
                onChange={(e) => setNewsletter(e.target.checked)}
                className="mt-1 accent-rasta-green"
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

      {/* ZION QR Modal */}
      {showZionQr && orderResult?.zion && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={closeZionQr}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="zion-panel w-full max-w-md relative z-10 p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={closeZionQr} className="absolute top-4 right-4 zion-button-icon zion-button-ghost">
              <X className="w-5 h-5" />
            </button>
            {zionPaid ? (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rasta-green/20 border-2 border-rasta-green flex items-center justify-center">
                  <Check className="w-8 h-8 text-rasta-green" />
                </div>
                <h2 className="text-xl font-black font-display mb-2 text-rasta-green">{t('cart.zionPaidTitle')}</h2>
                <p className="text-sm text-gray-400 mb-6">{t('cart.zionPaidDesc')}</p>
                <button onClick={closeZionQr} className="zion-button-primary w-full">
                  <Check className="w-4 h-4" /> {t('cart.qrDone')}
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-black font-display mb-2">{t('cart.zionQrTitle')}</h2>
                <p className="text-sm text-gray-400 mb-4">{t('cart.zionQrSubtitle')}</p>
                <img
                  src={orderResult.zion.qrCode}
                  alt={t('cart.zionQrAlt')}
                  className="w-56 h-56 mx-auto mb-4 bg-white p-2 rounded-xl"
                />
                <div className="space-y-2 text-sm text-left bg-white/5 p-4 rounded-xl mb-4">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500 shrink-0">{t('cart.zionAddress')}</span>
                    <strong className="font-mono text-[11px] break-all text-right">{orderResult.zion.address}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('cart.zionAmount')}</span>
                    <strong className="text-gradient-gold">{orderResult.zion.amountZion} ZION</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('cart.zionMemo')}</span>
                    <strong className="font-mono text-xs break-all text-right">{orderResult.zion.memo}</strong>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mb-3 text-left">{t('cart.zionCliHint')}</p>
                <code className="block text-[10px] font-mono bg-black/40 border border-white/10 rounded-lg p-2 mb-4 text-left break-all text-gray-400 select-all">
                  {orderResult.zion.cliHint}
                </code>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mb-4">
                  <span className="w-3 h-3 border-2 border-rasta-gold/30 border-t-rasta-gold rounded-full animate-spin" />
                  {t('cart.zionWaiting')}
                </div>
                <button onClick={closeZionQr} className="zion-button-secondary w-full">
                  {t('cart.zionPayLater')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
