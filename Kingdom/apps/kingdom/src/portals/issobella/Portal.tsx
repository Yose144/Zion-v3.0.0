import type { Locale } from '@zion/contract';
import { readSpec } from '@zion/contract';
import { t } from '@zion/i18n';
import { api, EXTERNAL } from '@/core/api';
import { manifest } from './manifest';

interface Health {
  success?: boolean;
  data?: string;
}

interface Paper {
  id: string;
  title: string;
  /* Daemon drží autory jako JSON text v TEXT sloupci — serializuje se jako string. */
  authors: string | string[];
  abstract_text?: string | null;
  content_url?: string | null;
  content_sha256: string;
  status: string;
  anchor_txid?: string | null;
  anchor_height?: number | null;
  anchor_mode?: string | null;
  anchored_at?: string | null;
  submitted_by?: string | null;
}

interface PaperProof {
  paper_id: string;
  content_sha256: string;
  status: string;
  anchor_txid?: string | null;
  anchor_height?: number | null;
  anchor_mode?: string | null;
  merkle_path?: unknown;
  anchored_at?: string | null;
  verify_hint?: string;
}

interface ApiPayload<T> {
  success?: boolean;
  data?: T | null;
  error?: string | null;
}

function shortHash(value: string | undefined): string {
  if (!value) return '—';
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function parseAuthors(raw: Paper['authors']): string[] {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === 'string') : [];
  } catch {
    return raw.trim() ? [raw.trim()] : [];
  }
}

export default async function IssobellaPortal({
  locale,
  search,
}: {
  locale: Locale;
  search?: Record<string, string | string[] | undefined>;
}) {
  const rawId = typeof search?.id === 'string' ? search.id.trim() : '';

  const [health, papers] = await Promise.all([
    api.tryRead<Health>(readSpec(manifest, 'health')),
    api.tryRead<ApiPayload<Paper[]> | Paper[]>(readSpec(manifest, 'papers')),
  ]);

  const paperList: Paper[] = Array.isArray(papers)
    ? (papers as Paper[])
    : (papers as ApiPayload<Paper[]> | null)?.data ?? [];

  /* Detail paperu je vstup od člověka — stejně jako adresa v Řetězu. */
  const safeId = encodeURIComponent(rawId);
  const paperSpec = rawId
    ? { ...readSpec(manifest, 'paper'), path: `${readSpec(manifest, 'paper').path}/${safeId}` }
    : null;
  const proofSpec = rawId
    ? { ...readSpec(manifest, 'proof'), path: `${readSpec(manifest, 'proof').path}/${safeId}/proof` }
    : null;

  const [paperDetailRes, paperProofRes] = await Promise.all([
    paperSpec ? api.tryRead<ApiPayload<Paper> | Paper>(paperSpec) : Promise.resolve(null),
    proofSpec ? api.tryRead<ApiPayload<PaperProof> | PaperProof>(proofSpec) : Promise.resolve(null),
  ]);

  /* Daemon odpovídá obálkou {success,data,error} — tryRead ji nerozbaluje. */
  const paperDetail =
    paperDetailRes && 'data' in paperDetailRes
      ? (paperDetailRes.data ?? null)
      : (paperDetailRes as Paper | null);
  const paperProof =
    paperProofRes && 'data' in paperProofRes
      ? (paperProofRes.data ?? null)
      : (paperProofRes as PaperProof | null);

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
          <div className="k-stat-value">{paperList.length}</div>
        </div>
      </div>

      {paperList.length > 0 ? (
        <>
          <div className="k-stage-head" style={{ marginTop: 20 }}>
            <h2 className="k-section-title">
              {locale === 'cs' ? 'Publikované papers' : 'Published papers'}
            </h2>
          </div>
          <div className="k-grid">
            {paperList.map((paper) => (
              <a
                key={paper.id}
                className="k-card"
                data-link="true"
                href={`/portal/issobella?id=${encodeURIComponent(paper.id)}`}
              >
                <div className="k-card-title">{paper.title}</div>
                <div className="k-meta">
                  <span className="k-badge" data-tone={paper.status === 'published' ? 'live' : 'soon'}>
                    {paper.status}
                  </span>
                  {paper.anchor_txid ? (
                    <span className="k-badge" data-tone="live">
                      {locale === 'cs' ? 'kotva' : 'anchored'}
                    </span>
                  ) : (
                    <span className="k-badge" data-tone="soon">
                      {locale === 'cs' ? 'čeká' : 'pending'}
                    </span>
                  )}
                </div>
                {parseAuthors(paper.authors).length > 0 ? (
                  <p className="k-sub" style={{ marginTop: 6 }}>
                    {parseAuthors(paper.authors).join(', ')}
                  </p>
                ) : null}
                {paper.abstract_text ? (
                  <p className="k-card-desc" style={{ marginTop: 6 }}>
                    {paper.abstract_text.length > 160
                      ? `${paper.abstract_text.slice(0, 160)}…`
                      : paper.abstract_text}
                  </p>
                ) : null}
              </a>
            ))}
          </div>
        </>
      ) : (
        <div className="k-empty" style={{ textAlign: 'left', marginTop: 18 }}>
          {t(locale, 'noData')}
        </div>
      )}

      {rawId && paperDetail ? (
        <div className="k-card" style={{ marginTop: 24, maxWidth: 720 }}>
          <div className="k-card-title">{paperDetail.title}</div>
          {paperDetail.abstract_text ? (
            <p className="k-card-desc" style={{ marginTop: 8 }}>{paperDetail.abstract_text}</p>
          ) : null}
          <div className="k-stats" style={{ marginTop: 12 }}>
            <Stat label={t(locale, 'status')} value={paperDetail.status} />
            <Stat label="sha256" value={shortHash(paperDetail.content_sha256)} />
            <Stat
              label={locale === 'cs' ? 'kotva' : 'anchor'}
              value={paperDetail.anchor_txid ? shortHash(paperDetail.anchor_txid) : '—'}
            />
            <Stat
              label={locale === 'cs' ? 'výška' : 'height'}
              value={paperDetail.anchor_height ? String(paperDetail.anchor_height) : '—'}
            />
          </div>
          {paperProof?.anchor_txid ? (
            <p style={{ marginTop: 10 }}>
              <a
                href={`${EXTERNAL.explorer}/tx?hash=${encodeURIComponent(paperProof.anchor_txid)}`}
                target="_blank"
                rel="noreferrer"
                className="k-sub"
              >
                {locale === 'cs' ? 'Ověřit kotvu v eXploreru' : 'Verify anchor in eXplorer'} →
              </a>
            </p>
          ) : null}
          {paperDetail.content_url ? (
            <p style={{ marginTop: 6 }}>
              <a
                href={paperDetail.content_url}
                target="_blank"
                rel="noreferrer"
                className="k-sub"
              >
                {locale === 'cs' ? 'Otevřít paper' : 'Open paper'} →
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {rawId && !paperDetail ? (
        <div className="k-empty" style={{ marginTop: 18 }}>
          {t(locale, 'noData')}
        </div>
      ) : null}

      <div className="k-card" style={{ marginTop: 26, maxWidth: 640 }}>
        <div className="k-card-title">
          {locale === 'cs' ? 'O Issobelle' : 'About Issobella'}
        </div>
        <p className="k-card-desc">
          {locale === 'cs'
            ? 'L6 — orbitální stanice a DeSci papers s on-chain kotvou. Papers se kotví do ZION řetězu přes ISSPAPER/ISSANCHOR memo a lze je ověřit v eXploreru.'
            : 'L6 — orbital stations and DeSci papers with an on-chain anchor. Papers are anchored into the ZION chain via ISSPAPER/ISSANCHOR memo and can be verified in the eXplorer.'}
        </p>
        <a
          className="k-btn"
          href="https://app.zionterranova.com/l6-issobella/papers"
          target="_blank"
          rel="noreferrer"
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        >
          {locale === 'cs' ? 'Otevřít plnou verzi' : 'Open full version'} →
        </a>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="k-stat">
      <div className="k-stat-label">{label}</div>
      <div className="k-stat-value">{value}</div>
    </div>
  );
}
