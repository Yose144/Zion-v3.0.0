import type { Locale } from '@zion/contract';
import { readSpec } from '@zion/contract';
import { t } from '@zion/i18n';
import { api, assetExists, assetUrl, EXTERNAL } from '@/core/api';
import { manifest } from './manifest';

interface Product {
  id: string;
  name: string;
  category: string;
  priceCzk: number;
  image?: string;
  badge?: string | null;
  inStock: boolean;
}

interface ProductsPayload {
  data: Product[];
  total: number;
}

const CZK = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });

export default async function MarketPortal({ locale }: { locale: Locale }) {
  const payload = await api.tryRead<ProductsPayload>(readSpec(manifest, 'products'));

  if (!payload?.data?.length) {
    return <div className="k-empty">{t(locale, 'unavailable')}</div>;
  }

  /* Obrázky ověřené paralelně a cachované — rozbitý asset se nevykreslí. */
  const products = await Promise.all(
    payload.data.map(async (product) => {
      const url = assetUrl('market', product.image);
      return { product, src: (await assetExists(url)) ? url : null };
    }),
  );

  return (
    <>
      <div className="k-meta" style={{ marginBottom: 12 }}>
        <span>
          {payload.data.length} / {payload.total} {t(locale, 'products').toLowerCase()}
        </span>
        <a href={EXTERNAL.shop} target="_blank" rel="noreferrer" style={{ color: 'var(--rasta-gold)' }}>
          {t(locale, 'openShop')} →
        </a>
      </div>

      <div className="k-grid">
        {products.map(({ product, src }) => {
          return (
            <a
              key={product.id}
              className="k-card"
              data-link="true"
              href={`${EXTERNAL.shop}?category=${encodeURIComponent(product.category)}`}
              target="_blank"
              rel="noreferrer"
            >
              <div className="k-thumb">
                {src ? (
                  <img src={src} alt="" loading="lazy" decoding="async" width={320} height={128} />
                ) : null}
              </div>

              <div className="k-card-title">{product.name}</div>

              <div className="k-meta">
                <span>{CZK.format(product.priceCzk)} Kč</span>
                <span>{product.inStock ? t(locale, 'inStock') : '—'}</span>
                {product.badge ? (
                  <span className="k-badge" data-tone="soon">
                    {product.badge}
                  </span>
                ) : null}
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}
