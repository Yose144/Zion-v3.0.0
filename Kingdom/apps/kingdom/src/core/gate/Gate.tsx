import Link from 'next/link';
import type { Locale } from '@zion/contract';
import { text } from '@zion/contract';
import { fmtNumber, t } from '@zion/i18n';
import { api, EXTERNAL } from '@/core/api';
import { Icon } from '@/core/shell/Icon';
import { gateReads, hero, intro, layers, paths } from './content';
import { Rich } from './Rich';

interface ChainStats {
  block_height?: number;
  difficulty?: number;
  network_hashrate_formatted?: string;
  avg_block_time?: number;
}

interface CoinsPayload {
  coins: Array<{ legs?: Array<{ connected: boolean; enabled: boolean }> }>;
}

/**
 * Brána — vstup do ekosystému.
 *
 * Server komponenta: obsah je typovaná data, živá čísla jdou přes @zion/api
 * s cache z manifestu. Do prohlížeče nejde nic než HTML a jediný přepínač jazyka.
 */
export async function Gate({ locale }: { locale: Locale }) {
  const [chain, pool] = await Promise.all([
    api.tryRead<ChainStats>(gateReads.chain),
    api.tryRead<CoinsPayload>(gateReads.pool),
  ]);

  const coins = pool?.coins ?? [];
  const connected = coins.filter((coin) =>
    coin.legs?.some((leg) => leg.connected && leg.enabled),
  ).length;

  return (
    <div className="k-gate-page">
      <section className="k-gate">
        <div className="k-gate-bg" aria-hidden="true" />
        <div className="k-gate-ring" aria-hidden="true" />

        <div className="k-gate-inner">
          <span className="k-badge" data-tone="live">
            {t(locale, 'gateSub')}
          </span>

          <h1 className="k-gate-title">{t(locale, 'brand')}</h1>

          <p className="k-hero-line">{text(hero.line, locale)}</p>
          <p className="k-hero-lead">{text(hero.lead, locale)}</p>

          <div className="k-gate-links">
            <Link href="/room" className="k-btn">
              {t(locale, 'enter')}
              <Icon name="arrow" size={15} />
            </Link>
            <a
              className="k-ghost"
              href="https://oasis.zionterranova.com"
              target="_blank"
              rel="noreferrer"
            >
              {t(locale, 'gatePreview')}
            </a>
            <a
              className="k-ghost"
              href="https://app.zionterranova.com/explorer"
              target="_blank"
              rel="noreferrer"
            >
              {t(locale, 'gateExplorer')}
            </a>
          </div>
        </div>

        <div className="k-gate-foot">
          <span>{text(hero.note, locale)}</span>
        </div>
      </section>

      <section className="k-live" aria-label={t(locale, 'gateLive')}>
        <div className="k-live-inner">
          <p className="k-live-note">{t(locale, 'gateVerify')}</p>
          <div className="k-live-items">
            <LiveItem label={t(locale, 'height')} value={fmtNumber(locale, chain?.block_height ?? 0)} />
            <LiveItem label={t(locale, 'difficulty')} value={fmtNumber(locale, chain?.difficulty ?? 0)} />
            <LiveItem label={t(locale, 'hashrate')} value={chain?.network_hashrate_formatted ?? '—'} />
            <LiveItem
              label={t(locale, 'blockTime')}
              value={chain?.avg_block_time ? `${fmtNumber(locale, chain.avg_block_time, 1)} s` : '—'}
            />
            <LiveItem
              label={t(locale, 'coins')}
              value={`${connected} / ${coins.length}`}
            />
          </div>
        </div>
      </section>

      <section id="why" className="k-section">
        <header className="k-section-head">
          <h2 className="k-section-title">{t(locale, 'gateWhy')}</h2>
        </header>
        <div className="k-prose">
          {intro.map((paragraph, index) => (
            <p key={index}>
              <Rich text={text(paragraph, locale)} />
            </p>
          ))}
        </div>
      </section>

      <section id="paths" className="k-section">
        <header className="k-section-head">
          <h2 className="k-section-title">{t(locale, 'gatePaths')}</h2>
        </header>
        <div className="k-paths">
          {paths.map((path) => (
            <a
              key={path.id}
              href={path.href}
              className="k-path"
              {...(path.href.startsWith('http')
                ? { target: '_blank', rel: 'noreferrer' }
                : {})}
            >
              <span className="k-path-index">{path.index}</span>
              <span className="k-path-title">{text(path.title, locale)}</span>
              <p className="k-path-body">
                <Rich text={text(path.body, locale)} />
              </p>
              <span className="k-path-cta">
                {text(path.cta, locale)} <Icon name="arrow" size={13} />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section id="layers" className="k-section">
        <header className="k-section-head">
          <h2 className="k-section-title">{t(locale, 'gateLayers')}</h2>
        </header>
        <div className="k-layers">
          {layers.map((layer) => (
            <a
              key={layer.id}
              href={layer.href}
              className="k-layer"
              {...(layer.href.startsWith('http')
                ? { target: '_blank', rel: 'noreferrer' }
                : {})}
            >
              <span className="k-layer-code">{layer.code}</span>
              <span className="k-layer-title">{text(layer.title, locale)}</span>
              <span className="k-layer-body">{text(layer.body, locale)}</span>
            </a>
          ))}
        </div>
      </section>

      <footer className="k-site-foot">
        <span className="k-brand">
          <span className="k-brand-dot" />
          {t(locale, 'brand')}
        </span>
        <span className="k-topbar-spacer" />
        <a href="https://github.com/Zion-TerraNova/" target="_blank" rel="noreferrer">
          {t(locale, 'github')}
        </a>
        <a href="https://app.zionterranova.com/whitepapers" target="_blank" rel="noreferrer">
          {t(locale, 'docs')}
        </a>
        <a href="https://market.zionterranova.com" target="_blank" rel="noreferrer">
          {t(locale, 'market')}
        </a>
        <a href="https://pool.zionterranova.com" target="_blank" rel="noreferrer">
          {t(locale, 'pool')}
        </a>
        <a href={EXTERNAL.ops} target="_blank" rel="noreferrer">
          {t(locale, 'ops')}
        </a>
      </footer>
    </div>
  );
}

function LiveItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="k-live-item">
      <span className="k-live-label">{label}</span>
      <span className="k-live-value">{value}</span>
    </div>
  );
}
