'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n';

const REFRESH_MS = 10_000;

interface MinerProc {
  pid?: string;
  etime?: string;
  cmd?: string;
  algo?: string;
  pool?: string;
  worker?: string | null;
  hashrate?: { rate?: number; unit?: string; a?: number; r?: number };
}

interface VastRig {
  id: number;
  gpu_name?: string;
  status?: string;
  dph?: number;
  geo?: string;
  gpu?: { util?: string; power?: string; temp?: string; mem?: string };
  miners?: MinerProc[];
}

interface FleetSheet {
  miner?: string;
  pool?: string;
  coin?: string;
  duty?: Record<string, number>;
  autopilot?: string[];
}

interface AgentRig {
  rig_id: string;
  hostname?: string;
  enrolled?: boolean;
  group?: string;
  desired?: FleetSheet & { hash?: string };
  applied_sheet?: string;
  last_seen?: number;
  age_s?: number | null;
  uptime_s?: number;
  load1?: number;
  miners?: string[];
  gpus?: { name?: string; temp?: number | string; util?: number | string; power?: number | string }[];
  pending?: number;
  results?: number;
  offline_alert?: boolean;
  miner_alert?: string | null;
  temp_alerts?: string[];
  hps_alert?: boolean;
}

interface FleetEvent {
  ts: number;
  kind: string;
  rig_id?: string;
  detail?: string;
}

interface Status {
  ts?: string;
  total_dph?: number;
  rigs?: VastRig[];
}

interface Fleet {
  rigs?: AgentRig[];
  sheets?: { rigs?: Record<string, FleetSheet & { hash?: string }>; groups?: Record<string, FleetSheet> };
  catalog?: Record<string, FleetSheet>;
  bench?: Record<string, Record<string, { hps?: number; usd_day?: number }>>;
  profit_mode?: string;
  events?: FleetEvent[];
}

const L = {
  title: { cs: 'MultiRig · Ops Control', en: 'MultiRig · Ops Control' },
  sub: {
    cs: 'Interní řídicí centrum fleetu — vast.ai rigy, flight sheets, agenty, alerty.',
    en: 'Internal fleet control center — vast.ai rigs, flight sheets, agents, alerts.',
  },
  needAuth: {
    cs: 'Vyžadováno ops přihlášení (auth_basic). Obnov stránku a přihlas se.',
    en: 'Ops login required (auth_basic). Reload and sign in.',
  },
  rigsOnline: { cs: 'Rigy online', en: 'Rigs online' },
  costDay: { cs: 'Náklady / den', en: 'Cost / day' },
  minersRunning: { cs: 'Běžící minery', en: 'Miners running' },
  agentRigs: { cs: 'Agent rigy', en: 'Agent rigs' },
  vastRigs: { cs: 'Vast.ai rigy', en: 'Vast.ai rigs' },
  fleetAgents: { cs: 'ZION agenti + flight sheets', en: 'ZION agents + flight sheets' },
  catalog: { cs: 'Katalog presetů', en: 'Preset catalog' },
  events: { cs: 'Události', en: 'Events' },
  assign: { cs: 'Přiřadit sheet…', en: 'Assign sheet…' },
  clear: { cs: '(zrušit)', en: '(clear)' },
  assigned: { cs: 'Přiřazeno ✓', en: 'Assigned ✓' },
  exec: { cs: 'exec', en: 'exec' },
  execPh: { cs: 'příkaz na rigu…', en: 'command on rig…' },
  allRigs: { cs: 'všem rigům', en: 'all rigs' },
  removeRig: { cs: 'odebrat', en: 'remove' },
  setGroup: { cs: 'group…', en: 'group…' },
  queued: { cs: 'Zařazeno ✓', en: 'Queued ✓' },
  noAgents: {
    cs: 'Zatím žádní agenti nepřipojeni — nasaď vast-agent na rig.',
    en: 'No agents enrolled yet — deploy vast-agent to a rig.',
  },
  updated: { cs: 'Aktualizováno', en: 'Updated' },
  offline: { cs: 'offline', en: 'offline' },
} as const;

type Key = keyof typeof L;
const t = (lang: 'cs' | 'en', k: Key) => L[k][lang];

function fmtUsd(n?: number, digits = 2) {
  return n == null || Number.isNaN(n) ? '—' : `$${n.toFixed(digits)}`;
}
function fmtAge(ts?: number) {
  if (!ts) return '—';
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}
function shortPool(p?: string) {
  if (!p) return '—';
  return p.replace(/^stratum\+(tcp|ssl|tls):\/\//, '');
}
function sheetLabel(s?: FleetSheet): string {
  if (!s?.miner) return '—';
  return s.miner === 'none' ? 'stop-all' : `${s.miner}${s.coin ? ` · ${s.coin}` : ''}`;
}

export default function OpsClient() {
  const { lang } = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [fleet, setFleet] = useState<Fleet | null>(null);
  const [unauth, setUnauth] = useState(false);
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [assignMsg, setAssignMsg] = useState('');

  const postOps = async (path: string, payload: unknown) => {
    const r = await fetch(`/ops-api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    setAssignMsg(t(lang, 'assigned'));
    setTimeout(() => setAssignMsg(''), 3000);
    const f = await fetch('/ops-api/agent/fleet', { cache: 'no-store' });
    if (f.ok) setFleet(await f.json());
  };
  const assignSheet = (target: Record<string, string>, catalog: string) =>
    postOps('/agent/sheet', catalog ? { ...target, catalog } : { ...target, sheet: { miner: 'none' } });

  const SheetPicker = ({ target }: { target: Record<string, string> }) => (
    <select
      defaultValue=""
      onChange={(e) => {
        const v = e.target.value;
        e.target.value = '';
        if (!v) return;
        (v === '__clear__' ? postOps('/agent/sheet/clear', target) : assignSheet(target, v))
          .catch((err) => { setAssignMsg(String(err)); setTimeout(() => setAssignMsg(''), 4000); });
      }}
      style={{ background: 'rgba(0,0,0,.45)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 6, color: 'inherit', padding: '.25rem .4rem', fontSize: '.78rem' }}
    >
      <option value="">{t(lang, 'assign')}</option>
      {Object.keys(catalog).map((n) => <option key={n} value={n}>{n}</option>)}
      <option value="__clear__">{t(lang, 'clear')}</option>
    </select>
  );

  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const [s, f] = await Promise.all([
          fetch('/ops-api/status', { cache: 'no-store' }),
          fetch('/ops-api/agent/fleet', { cache: 'no-store' }),
        ]);
        if (dead) return;
        if (s.status === 401 || f.status === 401) { setUnauth(true); return; }
        if (s.ok) setStatus(await s.json());
        if (f.ok) setFleet(await f.json());
      } catch {
        /* keep last good */
      }
    };
    load();
    const id = setInterval(() => { setTick((x) => x + 1); load(); }, REFRESH_MS);
    return () => { dead = true; clearInterval(id); };
  }, []);

  const rigs = status?.rigs ?? [];
  const online = rigs.filter((r) => r.status === 'running');
  const miners = rigs.flatMap((r) => r.miners ?? []);
  const agents = fleet?.rigs ?? [];
  const groups = fleet?.sheets?.groups ?? {};
  const catalog = fleet?.catalog ?? {};
  const bench = fleet?.bench ?? {};
  const events = useMemo(
    () => [...(fleet?.events ?? [])].sort((a, b) => b.ts - a.ts).slice(0, 15),
    [fleet],
  );
  const alertKinds = /alert_|_down|_drop/;
  const openAlerts = events.filter((e) => alertKinds.test(e.kind) && !/recover/.test(e.kind)).length;

  if (unauth) {
    return (
      <section className="section-wrap">
        <div className="pool-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.4rem' }}>{t(lang, 'title')}</h1>
          <p className="text-muted">{t(lang, 'needAuth')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section-wrap" style={{ paddingTop: '6.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{t(lang, 'title')}</h1>
          <p className="text-muted" style={{ margin: '.25rem 0 0' }}>{t(lang, 'sub')}</p>
        </div>
        <div className="text-muted" style={{ fontSize: '.8rem' }}>
          {t(lang, 'updated')} {status?.ts ?? '—'} · {fleet?.profit_mode ? `profit:${fleet.profit_mode}` : 'profit:off'}
          {openAlerts > 0 && <span style={{ color: 'var(--bad, #ff6b6b)', marginLeft: '.5rem' }}>⚠ {openAlerts}</span>}
          {assignMsg && <span style={{ color: 'var(--good, #3ddc84)', marginLeft: '.5rem' }}>{assignMsg}</span>}
          <span className="text-muted"> · {tick}</span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-grid" style={{ marginTop: '1rem' }}>
        <div className="kpi-tile"><div className="stat-value">{online.length}/{rigs.length}</div><div className="stat-label">{t(lang, 'rigsOnline')}</div></div>
        <div className="kpi-tile"><div className="stat-value">{fmtUsd((status?.total_dph ?? 0) * 24, 2)}</div><div className="stat-label">{t(lang, 'costDay')}</div></div>
        <div className="kpi-tile"><div className="stat-value">{miners.length}</div><div className="stat-label">{t(lang, 'minersRunning')}</div></div>
        <div className="kpi-tile"><div className="stat-value">{agents.length}</div><div className="stat-label">{t(lang, 'agentRigs')}</div></div>
      </div>

      {/* Vast.ai rigs */}
      <div className="pool-card" style={{ marginTop: '1.25rem', padding: 0 }}>
        <h2 style={{ padding: '1rem 1rem .5rem', fontSize: '1.05rem', margin: 0 }}>{t(lang, 'vastRigs')}</h2>
        <div className="table-scroll">
          <table className="pool-table">
            <thead>
              <tr>
                <th>Rig</th><th>GPU</th><th>Status</th><th>T/P</th>
                <th>Mining</th><th>Shares</th><th>$/h</th>
              </tr>
            </thead>
            <tbody>
              {rigs.map((r) => {
                const ms = r.miners ?? [];
                const acc = ms.reduce((a, m) => a + (m.hashrate?.a ?? 0), 0);
                const rej = ms.reduce((a, m) => a + (m.hashrate?.r ?? 0), 0);
                const down = r.status !== 'running';
                return (
                  <>
                    <tr key={r.id} onClick={() => setExpanded(expanded === r.id ? null : r.id)} style={{ cursor: 'pointer' }}>
                      <td><b>#{r.id}</b> <span className="text-muted">{expanded === r.id ? '▾' : '▸'}</span><br /><span className="text-muted" style={{ fontSize: '.75rem' }}>{r.geo ?? ''}</span></td>
                      <td>{r.gpu_name ?? '—'}<br /><span className="text-muted" style={{ fontSize: '.75rem' }}>{r.gpu?.util ?? ''} {r.gpu?.mem ?? ''}</span></td>
                      <td><span style={{ color: down ? 'var(--bad, #ff6b6b)' : 'var(--good, #3ddc84)' }}>{down ? t(lang, 'offline') : (r.status ?? '—')}</span></td>
                      <td>{r.gpu?.temp ?? '—'}°<br /><span className="text-muted" style={{ fontSize: '.75rem' }}>{r.gpu?.power ?? ''}</span></td>
                      <td>
                        {ms.length === 0 && <span className="text-muted">—</span>}
                        {ms.map((m, i) => (
                          <div key={i} style={{ fontSize: '.8rem', lineHeight: 1.5 }}>
                            <b>{m.algo ?? '?'}</b> {m.hashrate?.rate != null && <span>{m.hashrate.rate} {m.hashrate.unit}</span>}
                            <br /><span className="text-muted">{shortPool(m.pool)}{m.worker ? ` · ${m.worker}` : ''}</span>
                          </div>
                        ))}
                      </td>
                      <td>{acc}<span className="text-muted">/{rej}</span></td>
                      <td>{fmtUsd(r.dph, 3)}</td>
                    </tr>
                    {expanded === r.id && (
                      <tr key={`${r.id}-x`}>
                        <td colSpan={7} style={{ fontFamily: 'monospace', fontSize: '.75rem', background: 'rgba(255,255,255,.02)' }}>
                          {ms.map((m, i) => (
                            <div key={i} style={{ padding: '.3rem 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                              <b>pid {m.pid}</b> · uptime {m.etime ?? '—'} · <span className="text-muted">{m.cmd}</span>
                            </div>
                          ))}
                          {ms.length === 0 && <span className="text-muted">no miners</span>}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {rigs.length === 0 && (
                <tr><td colSpan={7} className="text-muted" style={{ textAlign: 'center', padding: '1.5rem' }}>—</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent fleet + flight sheets */}
      <div className="pool-card" style={{ marginTop: '1.25rem', padding: 0 }}>
        <h2 style={{ padding: '1rem 1rem .5rem', fontSize: '1.05rem', margin: 0 }}>{t(lang, 'fleetAgents')}</h2>
        <div className="table-scroll">
          <table className="pool-table">
            <thead>
              <tr><th>Rig / group</th><th>Flight sheet</th><th>Applied</th><th>Seen</th><th>GPUs</th><th>Miners</th><th>{t(lang, 'assign')}</th><th>{t(lang, 'exec')}</th></tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const badges = [
                  a.offline_alert && 'offline',
                  a.miner_alert && `miner:${a.miner_alert}`,
                  (a.temp_alerts ?? []).length ? `temp:${(a.temp_alerts ?? []).length}` : null,
                  a.hps_alert && 'hps',
                ].filter(Boolean);
                const applied = a.desired?.hash
                  ? (a.desired.hash === a.applied_sheet ? '✓' : '⟳ pending')
                  : '—';
                return (
                  <tr key={a.rig_id}>
                    <td>
                      <b>{a.hostname ?? a.rig_id}</b>
                      {a.group && <span className="text-muted"> · {a.group}</span>}
                      {(a.pending ?? 0) > 0 && <span className="text-muted"> · ⧗{a.pending}</span>}
                      {badges.length > 0 && <div style={{ color: 'var(--bad, #ff6b6b)', fontSize: '.72rem' }}>⚠ {badges.join(' ')}</div>}
                    </td>
                    <td>{sheetLabel(a.desired)}</td>
                    <td>{applied}</td>
                    <td>{a.age_s != null ? fmtAge(a.last_seen) : '—'}<br /><span className="text-muted" style={{ fontSize: '.72rem' }}>{a.load1 != null ? `load ${a.load1}` : ''}</span></td>
                    <td>{(a.gpus ?? []).map((g) => `${g.name ?? '?'} ${g.temp ?? ''}°`).join(', ') || '—'}</td>
                    <td>{(a.miners ?? []).join(', ') || '—'}</td>
                    <td>
                      <SheetPicker target={{ rig_id: a.rig_id }} />
                      <div style={{ marginTop: '.3rem', display: 'flex', gap: '.3rem' }}>
                        <button onClick={() => {
                          const g = prompt(`${t(lang, 'setGroup')} (${a.rig_id})`, a.group ?? '');
                          if (g != null) postOps('/agent/group', { rig_id: a.rig_id, group: g || null }).catch((e) => setAssignMsg(String(e)));
                        }} className="ops-mini-btn">{t(lang, 'setGroup')}</button>
                        <button onClick={() => {
                          if (confirm(`${t(lang, 'removeRig')} ${a.rig_id}?`))
                            postOps('/agent/rig/remove', { rig_id: a.rig_id }).catch((e) => setAssignMsg(String(e)));
                        }} className="ops-mini-btn ops-mini-danger">{t(lang, 'removeRig')}</button>
                      </div>
                    </td>
                    <td>
                      <input
                        placeholder={t(lang, 'execPh')}
                        className="ops-exec-input"
                        onKeyDown={(e) => {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (e.key === 'Enter' && v) {
                            (e.target as HTMLInputElement).value = '';
                            postOps('/agent/enqueue', { rig_id: a.rig_id, op: 'exec', args: { cmd: v } })
                              .then(() => setAssignMsg(t(lang, 'queued')))
                              .catch((err) => setAssignMsg(String(err)));
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
              {Object.entries(groups).map(([g, s]) => (
                <tr key={`g-${g}`}>
                  <td><b>{g}</b> <span className="text-muted">(group)</span></td>
                  <td>{sheetLabel(s)}</td><td colSpan={4} className="text-muted">—</td>
                  <td><SheetPicker target={{ group: g }} /></td><td></td>
                </tr>
              ))}
              {agents.length > 0 && (
                <tr>
                  <td><b>∗ {t(lang, 'allRigs')}</b></td>
                  <td colSpan={5} className="text-muted">bulk</td>
                  <td>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value;
                        e.target.value = '';
                        if (v && confirm(`bulk → ${v} (${agents.length} rigs)?`))
                          postOps('/agent/bulk', { target: { all: true }, action: { catalog: v } })
                            .catch((err) => setAssignMsg(String(err)));
                      }}
                      style={{ background: 'rgba(0,0,0,.45)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 6, color: 'inherit', padding: '.25rem .4rem', fontSize: '.78rem' }}
                    >
                      <option value="">{t(lang, 'assign')}</option>
                      {Object.keys(catalog).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                  <td></td>
                </tr>
              )}
              {agents.length === 0 && Object.keys(groups).length === 0 && (
                <tr><td colSpan={8} className="text-muted" style={{ textAlign: 'center', padding: '1.25rem' }}>{t(lang, 'noAgents')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Catalog + bench */}
      <div className="pool-card" style={{ marginTop: '1.25rem', padding: 0 }}>
        <h2 style={{ padding: '1rem 1rem .5rem', fontSize: '1.05rem', margin: 0 }}>{t(lang, 'catalog')}</h2>
        <div className="table-scroll">
          <table className="pool-table">
            <thead><tr><th>Preset</th><th>Miner</th><th>Coin</th><th>Pool</th><th>Duty</th><th>Bench $/day</th></tr></thead>
            <tbody>
              {Object.entries(catalog).map(([name, s]) => {
                const benchRows = Object.entries(bench)
                  .map(([gpu, coins]) => coins[s.coin ?? ''] ? `${gpu.replace(/_/g, ' ')}: ${fmtUsd(coins[s.coin!]?.usd_day, 2)}` : null)
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <tr key={name}>
                    <td><b>{name}</b></td>
                    <td>{s.miner ?? '—'}</td>
                    <td>{s.coin ?? '—'}</td>
                    <td style={{ fontSize: '.8rem' }}>{shortPool(s.pool)}</td>
                    <td>{s.duty ? Object.entries(s.duty).map(([c, p]) => `${c}:${p}%`).join(' ') : '—'}</td>
                    <td style={{ fontSize: '.8rem' }}>{benchRows || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Events */}
      <div className="pool-card" style={{ marginTop: '1.25rem', padding: '1rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 .5rem' }}>{t(lang, 'events')}</h2>
        <div style={{ fontFamily: 'monospace', fontSize: '.78rem', lineHeight: 1.7, maxHeight: '16rem', overflowY: 'auto' }}>
          {events.map((e, i) => (
            <div key={i} style={{ color: /alert_|_down|_drop/.test(e.kind) && !/recover/.test(e.kind) ? 'var(--bad, #ff6b6b)' : undefined }}>
              <span className="text-muted">{new Date(e.ts * 1000).toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-GB')}</span>{' '}
              <b>{e.kind}</b> {e.rig_id && <span>[{e.rig_id}]</span>} {e.detail}
            </div>
          ))}
          {events.length === 0 && <span className="text-muted">—</span>}
        </div>
      </div>
    </section>
  );
}
