'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

const OPEN = new Set(['pending', 'under_review', 'approved', 'on_dao']);
const FLOWERS = 1_000_000;

interface GrantName {
  id: string;
  title: string;
}

interface FundView {
  accumulated: number;
  disbursed: number;
}

function unwrap(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

function readHarbor(payload: unknown): { grants: GrantName[]; fund: FundView | null } {
  if (!payload || typeof payload !== 'object') return { grants: [], fund: null };
  const rec = payload as { grants?: unknown; fund?: unknown };
  const grantList = unwrap(rec.grants);
  const grants = Array.isArray(grantList)
    ? grantList.flatMap((row) => {
        if (!row || typeof row !== 'object') return [];
        const item = row as { id?: unknown; title?: unknown; status?: unknown };
        if (typeof item.title !== 'string' || typeof item.id !== 'string') return [];
        if (typeof item.status === 'string' && !OPEN.has(item.status)) return [];
        return [{ id: item.id, title: item.title }];
      })
    : [];
  const fundRaw = unwrap(rec.fund);
  let fund: FundView | null = null;
  if (fundRaw && typeof fundRaw === 'object') {
    const row = fundRaw as { total_accumulated?: unknown; total_disbursed?: unknown };
    if (typeof row.total_accumulated === 'number') {
      fund = {
        accumulated: row.total_accumulated / FLOWERS,
        disbursed: typeof row.total_disbursed === 'number' ? row.total_disbursed / FLOWERS : 0,
      };
    }
  }
  return { grants, fund };
}

export function HarborPortal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const [grants, setGrants] = useState<GrantName[] | null>(null);
  const [fund, setFund] = useState<FundView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/harbor', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<unknown>;
      })
      .then((body) => {
        if (!live) return;
        const parsed = readHarbor(body);
        setGrants(parsed.grants);
        setFund(parsed.fund);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const title = lang === 'cs' ? 'Přístav' : 'Harbor';

  return (
    <aside className="portal" role="dialog" aria-label={title}>
      <header className="portal-head">
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      {failed && <p>{t('harborEmpty')}</p>}
      {!failed && grants == null && <p>…</p>}
      {fund && (
        <p>
          {t('fund')} <strong>{fund.accumulated.toLocaleString(lang)} ZION</strong>
        </p>
      )}
      {grants && (
        <>
          <p className="muted">{t('grants')}</p>
          {grants.length === 0 ? (
            <p className="muted">—</p>
          ) : (
            <ul>
              {grants.map((grant) => (
                <li key={grant.id}>{grant.title}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
