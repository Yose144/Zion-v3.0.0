import { useEffect, useState, useCallback } from 'react';
import { Coins, Power, RotateCw, Settings2, Zap } from 'lucide-react';
import {
  fetchAuxPowConfig,
  updateAuxPowConfig,
  restartAuxPowPool,
  type AuxPowConfig,
  type AuxPowConfigResponse,
} from '../lib/api';

const REFRESH_MS = 10000;

export default function AuxPowPanel() {
  const [cfg, setCfg] = useState<AuxPowConfigResponse | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<AuxPowConfig | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await fetchAuxPowConfig();
    if (data?.ok) {
      setCfg(data);
      if (!draft) setDraft(data.config);
    }
  }, [draft]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const c = editMode ? draft : cfg?.config;

  const doUpdate = async (payload: Partial<AuxPowConfig> & Record<string, unknown>, label: string) => {
    setBusy(label);
    setMsg(`Running ${label}…`);
    try {
      const res = await updateAuxPowConfig(payload);
      if (res?.ok) {
        setMsg(`✓ ${label}`);
        if (res.config) {
          setDraft(res.config);
          setCfg({ ...cfg!, config: res.config });
        }
      } else {
        setMsg(`✗ ${label}: ${res?.error || 'failed'}`);
      }
    } catch (e: any) {
      setMsg(`✗ ${label}: ${e.message || 'error'}`);
    } finally {
      setBusy(null);
    }
  };

  const doRestart = async () => {
    setBusy('restart');
    setMsg('Restarting AuxPow pool…');
    try {
      const res = await restartAuxPowPool();
      setMsg(res?.ok ? '✓ AuxPow pool restarted' : `✗ ${res?.error || 'failed'}`);
    } catch (e: any) {
      setMsg(`✗ restart: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const saveAll = async () => {
    if (!draft) return;
    await doUpdate({ ...draft } as Record<string, unknown>, 'Save config');
    setEditMode(false);
  };

  if (!c) {
    return (
      <div className="zion-card">
        <div className="flex items-center gap-2 mb-2">
          <Coins size={16} className="text-violet-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">AuxPow Config</h3>
        </div>
        <div className="text-[10px] text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="zion-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-violet-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">AuxPow Config</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${c.enabled ? 'bg-emerald-700/40 text-emerald-300' : 'bg-gray-700/40 text-gray-400'}`}>
            {c.enabled ? 'ENABLED' : 'DISABLED'}
          </span>
          <button
            onClick={() => setEditMode((v) => !v)}
            className="p-1 rounded bg-white/5 hover:bg-white/10 transition"
            title="Toggle edit mode"
          >
            <Settings2 size={12} className={editMode ? 'text-amber-400' : 'text-gray-400'} />
          </button>
        </div>
      </div>

      {/* Mode + Enabled */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <div className="text-[9px] text-gray-400 mb-1">Mode</div>
          <div className="flex gap-1">
            {(['zion', 'auto', 'force'] as const).map((m) => (
              <button
                key={m}
                onClick={() => editMode ? setDraft({ ...draft!, mode: m }) : doUpdate({ mode: m }, `Mode→${m}`)}
                disabled={!!busy}
                className={`flex-1 py-1 rounded text-[9px] font-semibold border transition disabled:opacity-40 ${
                  c.mode === m
                    ? 'bg-violet-700/40 text-violet-300 border-violet-500/30'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-gray-400 mb-1">Enabled</div>
          <button
            onClick={() => editMode ? setDraft({ ...draft!, enabled: !c.enabled }) : doUpdate({ enabled: !c.enabled }, c.enabled ? 'Disable' : 'Enable')}
            disabled={!!busy}
            className={`w-full py-1 rounded text-[10px] font-bold border transition disabled:opacity-40 ${
              c.enabled
                ? 'bg-emerald-700/40 text-emerald-300 border-emerald-500/30'
                : 'bg-red-700/40 text-red-300 border-red-500/30'
            }`}
          >
            <Power size={10} className="inline mr-1" />
            {c.enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Coin selector */}
      <div className="mb-3">
        <div className="text-[9px] text-gray-400 mb-1">Coin</div>
        {editMode ? (
          <select
            value={c.coin}
            onChange={(e) => setDraft({ ...draft!, coin: e.target.value })}
            className="w-full text-[10px] bg-black/30 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-white/30"
          >
            {(cfg?.supported_coins ?? []).map((coin) => (
              <option key={coin} value={coin}>{coin}</option>
            ))}
          </select>
        ) : (
          <div className="flex flex-wrap gap-1">
            {(cfg?.supported_coins ?? []).slice(0, 14).map((coin) => (
              <button
                key={coin}
                onClick={() => doUpdate({ coin }, `Coin→${coin}`)}
                disabled={!!busy}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition disabled:opacity-40 ${
                  c.coin === coin
                    ? 'bg-cyan-700/40 text-cyan-300 border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
              >
                {coin}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pool preference */}
      <div className="mb-3">
        <div className="text-[9px] text-gray-400 mb-1">Pool Preference</div>
        <div className="flex gap-1">
          {(cfg?.supported_preferences ?? ['default', 'nicehash', 'herominers', 'zpool']).map((p) => (
            <button
              key={p}
              onClick={() => editMode ? setDraft({ ...draft!, pool_preference: p }) : doUpdate({ pool_preference: p }, `Pool→${p}`)}
              disabled={!!busy}
              className={`flex-1 py-1 rounded text-[9px] font-semibold border transition disabled:opacity-40 ${
                c.pool_preference === p
                  ? 'bg-amber-700/40 text-amber-300 border-amber-500/30'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Split */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <div className="text-[9px] text-gray-400 mb-1">Split ZION %</div>
          <input
            type="number"
            value={c.split_zion}
            onChange={(e) => editMode && setDraft({ ...draft!, split_zion: +e.target.value })}
            disabled={!editMode || !!busy}
            className="w-full text-[10px] bg-black/30 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-white/30 disabled:opacity-60"
          />
        </div>
        <div>
          <div className="text-[9px] text-gray-400 mb-1">Split External %</div>
          <input
            type="number"
            value={c.split_external}
            onChange={(e) => editMode && setDraft({ ...draft!, split_external: +e.target.value })}
            disabled={!editMode || !!busy}
            className="w-full text-[10px] bg-black/30 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-white/30 disabled:opacity-60"
          />
        </div>
      </div>

      {/* Stream profit */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[9px] text-gray-400 flex items-center gap-1">
            <Zap size={9} /> Stream Profit
          </div>
          <button
            onClick={() => editMode ? setDraft({ ...draft!, stream_profit_enabled: !c.stream_profit_enabled }) : doUpdate({ stream_profit_enabled: !c.stream_profit_enabled }, c.stream_profit_enabled ? 'Stream OFF' : 'Stream ON')}
            disabled={!!busy}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition disabled:opacity-40 ${
              c.stream_profit_enabled
                ? 'bg-emerald-700/40 text-emerald-300 border-emerald-500/30'
                : 'bg-gray-700/40 text-gray-400 border-white/10'
            }`}
          >
            {c.stream_profit_enabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {c.stream_profit_enabled && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[8px] text-gray-500">Provider</div>
              <select
                value={c.stream_profit_provider}
                onChange={(e) => editMode ? setDraft({ ...draft!, stream_profit_provider: e.target.value }) : doUpdate({ stream_profit_provider: e.target.value }, 'Provider')}
                disabled={!editMode || !!busy}
                className="w-full text-[9px] bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white disabled:opacity-60"
              >
                {(cfg?.supported_stream_providers ?? []).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[8px] text-gray-500">Sources</div>
              <select
                value={c.stream_profit_sources}
                onChange={(e) => editMode ? setDraft({ ...draft!, stream_profit_sources: e.target.value }) : doUpdate({ stream_profit_sources: e.target.value }, 'Sources')}
                disabled={!editMode || !!busy}
                className="w-full text-[9px] bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white disabled:opacity-60"
              >
                {(cfg?.supported_stream_sources ?? []).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[8px] text-gray-500">Interval</div>
              <input
                type="text"
                value={c.stream_profit_interval}
                onChange={(e) => editMode && setDraft({ ...draft!, stream_profit_interval: e.target.value })}
                disabled={!editMode || !!busy}
                className="w-full text-[9px] bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white font-mono disabled:opacity-60"
              />
            </div>
            <div>
              <div className="text-[8px] text-gray-500">Hysteresis</div>
              <input
                type="text"
                value={c.stream_profit_hysteresis}
                onChange={(e) => editMode && setDraft({ ...draft!, stream_profit_hysteresis: e.target.value })}
                disabled={!editMode || !!busy}
                className="w-full text-[9px] bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white font-mono disabled:opacity-60"
              />
            </div>
          </div>
        )}
      </div>

      {/* Wallet + worker */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <div className="text-[9px] text-gray-400 mb-1">Wallet</div>
          <input
            type="text"
            value={c.wallet}
            onChange={(e) => editMode && setDraft({ ...draft!, wallet: e.target.value })}
            disabled={!editMode || !!busy}
            className="w-full text-[9px] bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white font-mono truncate disabled:opacity-60"
          />
        </div>
        <div>
          <div className="text-[9px] text-gray-400 mb-1">Worker</div>
          <input
            type="text"
            value={c.worker_name}
            onChange={(e) => editMode && setDraft({ ...draft!, worker_name: e.target.value })}
            disabled={!editMode || !!busy}
            className="w-full text-[9px] bg-black/30 border border-white/10 rounded px-1 py-0.5 text-white font-mono disabled:opacity-60"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {editMode ? (
          <button
            onClick={saveAll}
            disabled={!!busy}
            className="flex-1 py-1.5 rounded bg-emerald-700/40 hover:bg-emerald-700/60 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 transition disabled:opacity-40"
          >
            Save Config
          </button>
        ) : (
          <button
            onClick={doRestart}
            disabled={!!busy}
            className="flex-1 py-1.5 rounded bg-amber-700/40 hover:bg-amber-700/60 border border-amber-500/30 text-[10px] font-bold text-amber-300 transition disabled:opacity-40 flex items-center justify-center gap-1"
          >
            <RotateCw size={10} className={busy === 'restart' ? 'animate-spin' : ''} /> Restart AuxPow
          </button>
        )}
      </div>

      {msg && <div className="mt-2 text-[9px] font-mono text-gray-400 truncate">{msg}</div>}
      {cfg?.env_file && (
        <div className="mt-1 text-[8px] text-gray-500 truncate" title={cfg.env_file}>
          env: {cfg.env_file}
        </div>
      )}
    </div>
  );
}
