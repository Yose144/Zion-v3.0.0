// ─── ZION Dashboard v2 — Logs Tab (v2.9 glass aesthetic) ────────────────────
import React, { useCallback, useRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Search, Trash2, ArrowDown } from 'lucide-react';
import { useLogStore, type LogLine } from '../../stores/logStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { ServiceName } from '../../types/api';

const SERVICES: Array<ServiceName | 'all'> = [
  'all', 'node1', 'node2', 'pool', 'pool-edge', 'miner',
  'bridge', 'dao', 'swap', 'warp', 'hiran', 'hiranyagarbha',
];

function logClass(line: string): string {
  const l = line.toLowerCase();
  if (l.includes('error') || l.includes('err]') || l.includes('fatal')) return 'log-error';
  if (l.includes('warn'))  return 'log-warn';
  if (l.includes('info'))  return 'log-info';
  if (l.includes('debug')) return 'log-debug';
  if (l.includes('ok') || l.includes('success') || l.includes('accepted')) return 'log-success';
  return 'text-slate-500';
}

function LogRow({ line, showTs }: { line: LogLine; showTs: boolean }) {
  return (
    <div
      className="flex gap-2 px-4 py-0.5 font-mono text-xs leading-5 select-text"
      style={{ transition: 'background 80ms' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
    >
      {showTs && (
        <span className="shrink-0 text-slate-600 w-20">
          {new Date(line.ts).toLocaleTimeString('en', { hour12: false })}
        </span>
      )}
      <span className="shrink-0 text-cyan-700 w-16 truncate">{line.service}</span>
      <span className={`flex-1 break-all whitespace-pre-wrap ${logClass(line.line)}`}>
        {line.line}
      </span>
    </div>
  );
}

export default function LogsTab() {
  const activeService = useLogStore(s => s.activeService);
  const searchQuery   = useLogStore(s => s.searchQuery);
  const setActive     = useLogStore(s => s.setActiveService);
  const setSearch     = useLogStore(s => s.setSearchQuery);
  const clearService  = useLogStore(s => s.clearService);
  const clearAll      = useLogStore(s => s.clearAll);
  const getFiltered   = useLogStore(s => s.getFiltered);

  const showTs     = useSettingsStore(s => s.showTimestamps);
  const autoScroll = useSettingsStore(s => s.autoScroll);

  const lines = getFiltered();
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: lines.length - 1, behavior: 'smooth' });
  }, [lines.length]);

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <div
        className="shrink-0 flex items-center gap-2 px-4 py-2.5 flex-wrap"
        style={{
          background: 'rgba(5,7,16,0.8)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Service selector pills */}
        <div className="flex gap-1 flex-wrap overflow-x-auto">
          {SERVICES.map(svc => (
            <button
              key={svc}
              onClick={() => setActive(svc)}
              className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium transition-all whitespace-nowrap"
              style={activeService === svc ? {
                background: 'rgba(147,51,234,0.2)',
                border: '1px solid rgba(147,51,234,0.4)',
                color: 'rgb(196,181,253)',
              } : {
                background: 'transparent',
                border: '1px solid transparent',
                color: 'rgb(100,116,139)',
              }}
              onMouseEnter={e => {
                if (activeService !== svc) {
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgb(203,213,225)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                }
              }}
              onMouseLeave={e => {
                if (activeService !== svc) {
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgb(100,116,139)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }
              }}
            >
              {svc}
            </button>
          ))}
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl ml-auto"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Search size={11} className="text-slate-500" />
          <input
            type="text"
            placeholder="Search logs…"
            value={searchQuery}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent outline-none text-xs text-slate-200 w-36 placeholder:text-slate-600"
          />
        </div>

        {/* Actions */}
        <button
          onClick={scrollToBottom}
          title="Scroll to bottom"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          <ArrowDown size={14} />
        </button>
        <button
          onClick={() => activeService === 'all' ? clearAll() : clearService(activeService as ServiceName)}
          title="Clear logs"
          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Status bar */}
      <div
        className="shrink-0 px-4 py-1 text-[10px] text-slate-600 font-medium flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-live" />
        {lines.length.toLocaleString()} lines
        {searchQuery && (
          <span className="text-yellow-600/60"> · filter: "{searchQuery}"</span>
        )}
      </div>

      {/* Virtualized list */}
      {lines.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Search size={20} className="text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">No logs yet</p>
          <p className="text-xs text-slate-700">Start a service to see output here</p>
        </div>
      ) : (
        <Virtuoso
          ref={virtuosoRef}
          className="flex-1"
          data={lines}
          followOutput={autoScroll ? 'smooth' : false}
          itemContent={(_, line) => <LogRow key={line.id} line={line} showTs={showTs} />}
        />
      )}
    </div>
  );
}
