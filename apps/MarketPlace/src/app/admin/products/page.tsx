'use client';

import { useEffect, useMemo, useState } from 'react';
import { isAuthenticated } from '@/lib/admin-auth';

type Product = {
  id: string;
  externalId: string;
  name: string;
  category: string;
  priceCzk: number;
  stock: number;
  inStock: boolean;
  active: boolean;
  digital: boolean;
};

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString('cs-CZ')} Kč`;
}

function ProductRow({
  product,
  onSaved,
}: {
  product: Product;
  onSaved: (next: Product) => void;
}) {
  const [stock, setStock] = useState(product.stock);
  const [inStock, setInStock] = useState(product.inStock);
  const [active, setActive] = useState(product.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStock(product.stock);
    setInStock(product.inStock);
    setActive(product.active);
    setError('');
  }, [product]);

  const dirty = stock !== product.stock || inStock !== product.inStock || active !== product.active;

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          ...(product.digital ? {} : { stock }),
          inStock,
          active,
        }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error ?? 'Uložení selhalo');
      const saved = Array.isArray(json.data) ? json.data[0] : null;
      if (saved) onSaved(saved as Product);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení selhalo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="py-3 pr-4 align-top">
        <div className="font-semibold text-white text-sm">{product.name}</div>
        <div className="mt-0.5 font-mono text-[10px] text-white/35">{product.externalId}</div>
        {error && <div className="mt-1 text-[10px] text-red-300">{error}</div>}
      </td>
      <td className="py-3 pr-4 align-top text-xs text-white/55">{product.category}</td>
      <td className="py-3 pr-4 align-top text-xs font-mono text-rasta-gold whitespace-nowrap">
        {formatPrice(product.priceCzk)}
      </td>
      <td className="py-3 pr-4 align-top">
        {product.digital ? (
          <span className="text-xs text-white/40">bez skladu</span>
        ) : (
          <input
            type="number"
            min={0}
            step={1}
            value={stock}
            onChange={(e) => setStock(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white focus:border-rasta-gold focus:outline-none"
            aria-label={`Sklad ${product.name}`}
          />
        )}
      </td>
      <td className="py-3 pr-4 align-top">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setInStock(e.target.checked)}
            className="h-4 w-4 accent-rasta-gold"
          />
          {inStock ? 'Dostupné' : 'Zamčeno'}
        </label>
      </td>
      <td className="py-3 pr-4 align-top">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-rasta-gold"
          />
          {active ? 'Zobrazit' : 'Skryto'}
        </label>
      </td>
      <td className="py-3 align-top text-right">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-lg border border-rasta-gold/30 bg-rasta-gold/10 px-3 py-1.5 text-xs font-bold text-rasta-gold transition hover:bg-rasta-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
      </td>
    </tr>
  );
}

function Section({
  title,
  subtitle,
  items,
  onSaved,
}: {
  title: string;
  subtitle: string;
  items: Product[];
  onSaved: (next: Product) => void;
}) {
  return (
    <section className="zion-section p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          <p className="text-xs text-white/45">{subtitle}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60">
          {items.length} položek
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-white/40">Žádné produkty.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
                <th className="pb-2 pr-4 font-semibold">Produkt</th>
                <th className="pb-2 pr-4 font-semibold">Kategorie</th>
                <th className="pb-2 pr-4 font-semibold">Cena</th>
                <th className="pb-2 pr-4 font-semibold">Sklad</th>
                <th className="pb-2 pr-4 font-semibold">Dostupnost</th>
                <th className="pb-2 pr-4 font-semibold">Viditelnost</th>
                <th className="pb-2 text-right font-semibold">Akce</th>
              </tr>
            </thead>
            <tbody>
              {items.map((product) => (
                <ProductRow key={product.id} product={product} onSaved={onSaved} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) return;
    fetch('/api/admin/products')
      .then((res) => res.json())
      .then((json) => {
        if (!json?.success) throw new Error(json?.error ?? 'Načtení selhalo');
        setProducts(json.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Načtení selhalo'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.externalId.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, search]);

  const virtual = filtered.filter((p) => p.digital);
  const physical = filtered.filter((p) => !p.digital);
  const locked = products.filter((p) => !p.inStock).length;

  function replaceProduct(next: Product) {
    setProducts((prev) => prev.map((p) => (p.id === next.id ? { ...p, ...next } : p)));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-rasta-gold">Administrace</p>
          <h1 className="mt-1 text-3xl font-black text-white">Sklad a dostupnost</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Virtuální produkty mají jen dostupnost — nepočítá se u nich sklad. Fyzické
            produkty mají sklad v kusech/baleních. Změny se ukládají po řádcích a
            catalog seed je už nepřepíše.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/60">
            Celkem {products.length}
          </span>
          <span className="rounded-full border border-rasta-gold/25 bg-rasta-gold/10 px-3 py-1.5 text-rasta-gold">
            Zamčeno {locked}
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat produkt, ID nebo kategorii…"
          className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-rasta-gold focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-white/45">Načítání produktů…</p>
      ) : (
        <>
          <Section
            title="💾 Virtuální produkty"
            subtitle="Digitální doručení — knihy, passy, licence, služby. Sklad se nepočítá."
            items={virtual}
            onSaved={replaceProduct}
          />
          <Section
            title="📦 Fyzické produkty"
            subtitle="Fyzické kusy a balení — semínka, lampiony, dřevo, stíhačky."
            items={physical}
            onSaved={replaceProduct}
          />
        </>
      )}
    </div>
  );
}
