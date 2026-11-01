import type { Locale } from '@zion/contract';
import { readSpec } from '@zion/contract';
import { t } from '@zion/i18n';
import { api } from '@/core/api';
import { manifest } from './manifest';

interface Health {
  success?: boolean;
  data?: string;
}

export default async function IssobellaPortal({ locale }: { locale: Locale }) {
  const health = await api.tryRead<Health>(readSpec(manifest, 'health'));

  return (
    <>
      <div className="k-stats">
        <div className="k-stat">
          <div className="k-stat-label">L6</div>
          <div className="k-stat-value" style={{ fontSize: 15 }}>
            {health?.data === 'ok' ? 'online' : 'offline'}
          </div>
        </div>
        <div className="k-stat">
          <div className="k-stat-label">{t(locale, 'papers')}</div>
          <div className="k-stat-value">—</div>
        </div>
      </div>

      <div className="k-empty" style={{ textAlign: 'left' }}>
        <strong>{t(locale, 'comingSoon')}</strong>
        <br />
        {locale === 'cs'
          ? 'Repo papers (6.B4) je hotové, ale na EDGE2 ještě není nasazené — proxy zatím vrací 404. Jakmile se nasadí, portál si papers a důkazy kotvy přečte sám; manifest už na čtení ukazuje.'
          : 'The papers repo (6.B4) exists but is not deployed on EDGE2 yet — the proxy returns 404. Once deployed, this portal will read papers and anchor proofs on its own; the manifest already points at the read.'}
      </div>
    </>
  );
}
