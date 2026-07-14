import { useState, useEffect, useCallback } from 'react';
import { Vote, ExternalLink, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { apiFetchExternal, EDGE_WEB } from '../lib/api';

interface DaoProposal {
  id?: string | number;
  title?: string;
  description?: string;
  status?: string;
  yes?: number;
  no?: number;
  abstain?: number;
  start_block?: number;
  end_block?: number;
  proposer?: string;
}

interface DaoResponse {
  success?: boolean;
  proposals?: DaoProposal[];
  data?: { proposals?: DaoProposal[] };
  note?: string;
  source?: string;
}

export default function DaoPanel() {
  const [proposals, setProposals] = useState<DaoProposal[]>([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await apiFetchExternal<DaoResponse>('/api/dao/proposals?limit=10&status=Active', { timeout: 8000 });
      if (!d) { setOffline(true); return; }
      if (d.note && !d.proposals && !d.data?.proposals) {
        setOffline(true);
        setProposals([]);
        return;
      }
      setOffline(false);
      const list = d.proposals ?? d.data?.proposals ?? (Array.isArray(d) ? d : []);
      setProposals(list);
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const activeCount = proposals.length;

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Vote className="h-4 w-4 text-purple-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">DAO Proposals</h3>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded-full border ${
          offline
            ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        }`}>
          {offline ? 'offline' : `${activeCount} active`}
        </span>
      </div>

      {offline ? (
        <div className="py-6 text-center">
          <Vote className="mx-auto h-6 w-6 text-gray-700 mb-2" />
          <p className="text-[10px] text-gray-600">
            DAO API offline — governance service not running
          </p>
          <a
            href={`${EDGE_WEB}/dao`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[9px] text-purple-400 hover:text-white"
          >
            Open DAO <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      ) : proposals.length === 0 ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400/50 mb-2" />
          <p className="text-[10px] text-gray-500">No active proposals</p>
        </div>
      ) : (
        <div className="space-y-2">
          {proposals.slice(0, 5).map((p, i) => {
            const yes = p.yes ?? 0;
            const no = p.no ?? 0;
            const total = yes + no + (p.abstain ?? 0);
            const yesPct = total > 0 ? (yes / total) * 100 : 0;
            const noPct = total > 0 ? (no / total) * 100 : 0;
            return (
              <div key={p.id ?? i} className="p-2 rounded-lg border border-white/5 bg-white/2">
                <p className="text-[10px] font-semibold text-white truncate">
                  {p.title ?? `Proposal #${p.id ?? i + 1}`}
                </p>
                {p.description && (
                  <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2">{p.description}</p>
                )}
                {/* Vote bar */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden flex">
                    <div className="bg-emerald-500" style={{ width: `${yesPct}%` }} />
                    <div className="bg-red-500" style={{ width: `${noPct}%` }} />
                  </div>
                  <span className="text-[8px] font-mono text-gray-400">{total} votes</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[8px]">
                  <span className="text-emerald-400">✓ {yes}</span>
                  <span className="text-red-400">✗ {no}</span>
                  {p.end_block && (
                    <span className="text-gray-500">ends @ #{p.end_block}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[9px] text-gray-500">ZION DAO · on-chain governance</span>
        <a
          href={`${EDGE_WEB}/dao`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[9px] text-purple-400 hover:text-white"
        >
          Open <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {loading && proposals.length === 0 && !offline && (
        <p className="mt-2 text-[9px] text-gray-600">Loading…</p>
      )}
    </div>
  );
}
