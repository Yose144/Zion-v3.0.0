'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Loader2,
  LogOut,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Users,
} from 'lucide-react';

interface AdminOrderItem {
  externalId: string;
  slug: string;
  name: { cs: string; en: string; de: string };
  quantity: number;
  unitPriceCzk: number;
  lineTotalCzk: number;
}

interface AdminOrder {
  orderId: string;
  status: string;
  paymentStatus: string;
  payment: string;
  shipping: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: { street: string; city: string; zip: string } | null;
  pickupPoint: string | null;
  note: string | null;
  items: AdminOrderItem[];
  subtotalCzk: number;
  shippingCzk: number;
  codCzk: number;
  totalCzk: number;
  invoiceNumber: string | null;
  trackingNumber: string | null;
  createdAt: string;
  companyName?: string | null;
  buyerIco?: string | null;
  buyerDic?: string | null;
  fireConsentName?: string | null;
  fireConsentVersion?: string | null;
}

interface Inquiry {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  eventDate: string | null;
  quantity: number | null;
  message: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface ProductRow {
  externalId: string;
  slug: string;
  priceCzk: number;
  stock: number;
  active: boolean;
  name: { cs: string; en: string; de: string };
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Čeká na platbu',
  paid: 'Zaplaceno',
  processing: 'Ve výrobě',
  shipped: 'Odesláno',
  completed: 'Dokončeno',
  cancelled: 'Zrušeno',
};

const INQUIRY_STATUS: Record<string, string> = {
  new: 'Nová',
  contacted: 'Kontaktováno',
  won: 'Získáno',
  lost: 'Ztraceno',
};

function czk(value: number) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(value);
}

function date(value: string) {
  return new Intl.DateTimeFormat('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function AdminApp() {
  const [auth, setAuth] = useState<'loading' | 'no' | 'yes'>('loading');
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('admin');
  const [loginError, setLoginError] = useState('');

  const [tab, setTab] = useState<'orders' | 'inquiries' | 'products'>('orders');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [meta, setMeta] = useState({ total: 0, pending: 0, paid: 0, shipped: 0, revenueCzk: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(false);

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/session', { cache: 'no-store' });
      const json = await response.json();
      setConfigured(Boolean(json?.data?.configured));
      setAuth(json?.data?.authenticated ? 'yes' : 'no');
    } catch {
      setAuth('no');
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('q', search.trim());
      const response = await fetch(`/api/admin/orders?${params.toString()}`, { cache: 'no-store' });
      const json = await response.json();
      if (json?.success) {
        setOrders(json.data);
        setMeta(json.meta);
        setSelected((current) => (current ? json.data.find((order: AdminOrder) => order.orderId === current.orderId) ?? null : null));
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  const loadInquiries = useCallback(async () => {
    const response = await fetch('/api/admin/inquiries', { cache: 'no-store' });
    const json = await response.json();
    if (json?.success) setInquiries(json.data);
  }, []);

  const loadProducts = useCallback(async () => {
    const response = await fetch('/api/admin/products', { cache: 'no-store' });
    const json = await response.json();
    if (json?.success) setProducts(json.data);
  }, []);

  useEffect(() => {
    if (auth !== 'yes') return;
    if (tab === 'orders') void loadOrders();
    if (tab === 'inquiries') void loadInquiries();
    if (tab === 'products') void loadProducts();
  }, [auth, tab, loadOrders, loadInquiries, loadProducts]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoginError('');
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await response.json();
    if (json?.success) {
      setPassword('');
      setAuth('yes');
    } else {
      setLoginError(json?.error || 'Přihlášení selhalo.');
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuth('no');
    setOrders([]);
    setSelected(null);
  }

  async function updateOrder(patch: Record<string, unknown>) {
    if (!selected) return;
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(selected.orderId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await response.json();
    if (json?.success) {
      await loadOrders();
    }
  }

  async function updateInquiry(id: string, status: string) {
    await fetch('/api/admin/inquiries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await loadInquiries();
  }

  async function saveProduct(row: ProductRow) {
    await fetch('/api/admin/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalId: row.externalId, priceCzk: row.priceCzk, stock: row.stock, active: row.active }),
    });
    await loadProducts();
  }

  const tabs = useMemo(
    () => [
      { id: 'orders' as const, label: 'Objednávky', icon: ShoppingBag, count: meta.total },
      { id: 'inquiries' as const, label: 'Poptávky', icon: Users, count: inquiries.filter((item) => item.status === 'new').length },
      { id: 'products' as const, label: 'Produkty', icon: Package, count: products.length },
    ],
    [meta.total, inquiries, products.length],
  );

  if (auth === 'loading') {
    return (
      <div className="container-lumi py-20 text-center text-sm text-muted">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (auth === 'no') {
    return (
      <div className="container-lumi py-20">
        <form onSubmit={login} className="card-warm mx-auto max-w-sm p-8">
          <h1 className="h3">Administrace Lumi</h1>
          <p className="mt-2 text-sm text-ink-soft">Přihlaste se heslem.</p>
          {!configured && (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              Admin není nakonfigurován. Nastavte <code>LUMI_ADMIN_PASSWORD</code> a <code>LUMI_SESSION_SECRET</code>.
            </p>
          )}
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="input mt-5"
            placeholder="Uživatel"
            autoComplete="username"
            disabled={!configured}
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input mt-2"
            placeholder="Heslo"
            autoComplete="current-password"
            disabled={!configured}
          />
          {loginError && <p className="mt-2 text-sm text-red-700">{loginError}</p>}
          <button type="submit" className="btn-primary mt-4 w-full" disabled={!configured}>
            Přihlásit
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="container-lumi py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Administrace</p>
          <h1 className="h2 mt-1">Lumi</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => (tab === 'orders' ? loadOrders() : tab === 'inquiries' ? loadInquiries() : loadProducts())} className="btn-outline !px-4 !py-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Obnovit
          </button>
          <button type="button" onClick={logout} className="btn-ghost border border-line text-xs">
            <LogOut className="h-3.5 w-3.5" /> Odhlásit
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Objednávky', value: meta.total },
          { label: 'Čeká na platbu', value: meta.pending },
          { label: 'Zaplaceno', value: meta.paid },
          { label: 'Tržby (zaplaceno)', value: czk(meta.revenueCzk) },
        ].map((card) => (
          <div key={card.label} className="card-warm p-4">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">{card.label}</p>
            <p className="h-display mt-1 text-2xl font-semibold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-line pb-3">
        {tabs.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tab === entry.id ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-ink/5'
              }`}
            >
              <Icon className="h-4 w-4" /> {entry.label}
              {entry.id === 'inquiries' && entry.count > 0 && (
                <span className="rounded-full bg-amber-600 px-1.5 text-[10px] font-bold text-white">{entry.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'orders' && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Hledat číslo, e-mail, jméno…"
                  className="input pl-9"
                />
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input max-w-[180px]">
                <option value="all">Všechny stavy</option>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="card-warm mt-3 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-parchment-deep/60 text-left text-[0.65rem] uppercase tracking-[0.1em] text-muted">
                  <tr>
                    <th className="px-3 py-2">Objednávka</th>
                    <th className="px-3 py-2">Zákazník</th>
                    <th className="px-3 py-2">Stav</th>
                    <th className="px-3 py-2 text-right">Celkem</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading && orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </td>
                    </tr>
                  )}
                  {orders.map((order) => (
                    <tr
                      key={order.orderId}
                      className={`cursor-pointer border-t border-line hover:bg-ink/[0.02] ${selected?.orderId === order.orderId ? 'bg-ink/[0.04]' : ''}`}
                      onClick={() => setSelected(order)}
                    >
                      <td className="px-3 py-3">
                        <p className="font-mono text-[11px] text-ink">{order.orderId}</p>
                        <p className="text-[11px] text-muted">{date(order.createdAt)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-ink">{order.customerName}</p>
                        <p className="text-[11px] text-muted">{order.customerEmail}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px]">{STATUS_LABEL[order.status] ?? order.status}</span>
                        {order.paymentStatus === 'paid' && <span className="ml-1 text-[11px] text-emerald-800">●</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-medium">{czk(order.totalCzk)}</td>
                      <td className="px-2 py-3 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-muted" />
                      </td>
                    </tr>
                  ))}
                  {!loading && orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted">
                        Žádné objednávky.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            {selected ? (
              <div className="card-warm space-y-4 p-5">
                <div>
                  <p className="font-mono text-xs text-muted">{selected.orderId}</p>
                  <h2 className="h3 mt-1">{selected.customerName}</h2>
                  <p className="text-sm text-ink-soft">
                    {selected.customerEmail}
                    <br />
                    {selected.customerPhone}
                  </p>
                  {selected.companyName && (
                    <p className="mt-1 text-sm text-ink-soft">
                      {selected.companyName} · IČO {selected.buyerIco}
                      {selected.buyerDic ? ` · DIČ ${selected.buyerDic}` : ''}
                    </p>
                  )}
                  {selected.address && (
                    <p className="mt-1 text-sm text-ink-soft">
                      {selected.address.street}, {selected.address.zip} {selected.address.city}
                    </p>
                  )}
                  {selected.pickupPoint && <p className="mt-1 text-sm text-ink-soft">Výdejní místo: {selected.pickupPoint}</p>}
                </div>

                <div className="border-t border-line pt-3">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">Položky</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {selected.items.map((item) => (
                      <li key={item.externalId} className="flex justify-between gap-2">
                        <span>
                          {item.name.cs} × {item.quantity}
                        </span>
                        <span className="font-medium">{czk(item.lineTotalCzk)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-semibold">
                    <span>Celkem</span>
                    <span>{czk(selected.totalCzk)}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {selected.payment} · {selected.shipping}
                    {selected.invoiceNumber ? ` · ${selected.invoiceNumber}` : ''}
                  </p>
                </div>

                {selected.note && (
                  <div className="rounded-lg bg-parchment-deep/60 p-3 text-sm text-ink-soft">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">Poznámka</p>
                    <p className="mt-1 whitespace-pre-wrap">{selected.note}</p>
                  </div>
                )}

                {selected.fireConsentName && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    Podpis: <strong>{selected.fireConsentName}</strong> ({selected.fireConsentVersion})
                  </div>
                )}

                <div className="space-y-2 border-t border-line pt-3">
                  <label className="block">
                    <span className="label">Stav</span>
                    <select
                      value={selected.status}
                      onChange={(event) => updateOrder({ status: event.target.value })}
                      className="input"
                    >
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateOrder({ paymentStatus: 'paid' })}
                      disabled={selected.paymentStatus === 'paid'}
                      className="btn-outline flex-1 !px-3 !py-2 text-xs disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Označit zaplaceno
                    </button>
                    <a
                      href={`/api/invoice/${encodeURIComponent(selected.orderId)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost border border-line text-xs"
                    >
                      Faktura
                    </a>
                  </div>
                  <label className="block">
                    <span className="label">Sledovací číslo</span>
                    <div className="flex gap-2">
                      <input
                        defaultValue={selected.trackingNumber ?? ''}
                        onBlur={(event) => {
                          if (event.target.value !== (selected.trackingNumber ?? '')) {
                            void updateOrder({ trackingNumber: event.target.value });
                          }
                        }}
                        className="input"
                        placeholder="např. 1234567890"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="label">Interní poznámka</span>
                    <textarea
                      defaultValue={selected.note ?? ''}
                      onBlur={(event) => {
                        if (event.target.value !== (selected.note ?? '')) {
                          void updateOrder({ note: event.target.value });
                        }
                      }}
                      rows={2}
                      className="input"
                    />
                  </label>
                </div>

                <button type="button" onClick={() => setSelected(null)} className="btn-ghost w-full text-xs">
                  Zavřít detail
                </button>
              </div>
            ) : (
              <div className="card-warm p-6 text-sm text-muted">Vyberte objednávku v seznamu.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'inquiries' && (
        <div className="mt-5 space-y-3">
          {inquiries.length === 0 && <p className="card-warm p-6 text-sm text-muted">Žádné poptávky.</p>}
          {inquiries.map((inquiry) => (
            <div key={inquiry.id} className="card-warm p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">
                    {inquiry.type} · {date(inquiry.createdAt)}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-ink">{inquiry.name}</h3>
                  <p className="text-sm text-ink-soft">
                    {inquiry.email}
                    {inquiry.phone ? ` · ${inquiry.phone}` : ''}
                  </p>
                  {inquiry.company && <p className="text-sm text-ink-soft">{inquiry.company}</p>}
                  {(inquiry.eventDate || inquiry.quantity) && (
                    <p className="text-sm text-ink-soft">
                      {inquiry.eventDate ? `Termín: ${inquiry.eventDate}` : ''}
                      {inquiry.quantity ? ` · ${inquiry.quantity} ks` : ''}
                    </p>
                  )}
                </div>
                <select
                  value={inquiry.status}
                  onChange={(event) => updateInquiry(inquiry.id, event.target.value)}
                  className="input max-w-[160px]"
                >
                  {Object.entries(INQUIRY_STATUS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">{inquiry.message}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'products' && (
        <div className="card-warm mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-parchment-deep/60 text-left text-[0.65rem] uppercase tracking-[0.1em] text-muted">
              <tr>
                <th className="px-4 py-2">Produkt</th>
                <th className="px-4 py-2">Cena (Kč)</th>
                <th className="px-4 py-2">Sklad</th>
                <th className="px-4 py-2">Aktivní</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => (
                <tr key={product.externalId} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{product.name.cs}</p>
                    <p className="text-[11px] text-muted">{product.externalId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={product.priceCzk}
                      onChange={(event) => {
                        const next = [...products];
                        next[index] = { ...product, priceCzk: Number(event.target.value) };
                        setProducts(next);
                      }}
                      className="input max-w-[110px]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={product.stock}
                      onChange={(event) => {
                        const next = [...products];
                        next[index] = { ...product, stock: Number(event.target.value) };
                        setProducts(next);
                      }}
                      className="input max-w-[110px]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={product.active}
                      onChange={(event) => {
                        const next = [...products];
                        next[index] = { ...product, active: event.target.checked };
                        setProducts(next);
                      }}
                      className="h-4 w-4 accent-amber-700"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => saveProduct(product)} className="btn-outline !px-3 !py-1.5 text-xs">
                      Uložit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
