// ─── ZION Dashboard v2 — Logs Tab (virtualized) ─────────────────────────────
import React, { useCallback, useRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Search, Trash2, ArrowDown } from 'lucide-react';
import { useLogStore, type LogLine } from '../../stores/logStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Card } from '../ui/Card';
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
  return 'text-(--color-text-dim)';
}

function LogRow({ line, showTs }: { line: LogLine; showTs: boolean }) {
  return (
    <div className="flex gap-2 px-4 py-0.5 font-mono text-xs leading-5 hover:bg-(--color-bg-hover)/30 select-text">
      {showTs && (
        <span className="shrink-0 text-(--color-text-muted) w-20">
          {new Date(line.ts).toLocaleTimeString('en', { hour12: false })}
        </span>
      )}
      <span className="shrink-0 text-(--color-zion-cyan)/60 w-16 truncate">{line.service}</span>
      <span className={`flex-1 break-all whitespace-pre-wrap ${logClass(line.line)}`}>
        {line.line}
      </span>
    </div>
  );
}

export default function LogsTab() {
  const activeService  = useLogStore(s => s.activeService);
  const searchQuery    = useLogStore(s => s.searchQuery);
  const setActive      = useLogStore(s => s.setActiveService);
  const setSearch      = useLogStore(s => s.setSearchQuery);
  const clearService   = useLogStore(s => s.clearService);
  const clearAll       = useLogStore(s => s.clearAll);
  const getFiltered    = useLogStore(s => s.getFiltered);

  const showTs   = useSettingsStore(s => s.showTimestamps);
  const autoScroll = useSettingsStore(s => s.autoScroll);

  const lines = getFiltered();
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: lines.length - 1, behavior: 'smooth' });
  }, [lines.length]);

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-(--color-border) bg-(--color-bg-panel)">
        {/* Service selector */}
        <div className="flex gap-1 overflow-x-auto flex-wrap">
          {SERVICES.map(svc => (
            <button
              key={svc}
              onClick={() => setActive(svc)}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-all whitespace-nowrap
                ${activeService === svc
                  ? 'bg-(--color-zion-purple)/30 text-(--color-zion-purple) border border-(--color-zion-purple)/50'
                  : 'text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-bg-hover)'
                }`}
            >
              {svc}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-1.5 bg-(--color-bg-card) border border-(--color-border) rounded px-2 py-1 ml-auto">
          <Search size={12} className="text-(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent outline-none text-xs text-(--color-text) w-40 placeholder:text-(--color-text-muted)"
          />
        </div>

        {/* Actions */}
        <button
          onClick={scrollToBottom}
          title="Scroll to bottom"
          className="p-1.5 rounded hover:bg-(--color-bg-hover) text-(--color-text-muted) hover:text-(--color-text)"
        >
          <ArrowDown size={14} />
        </button>
        <button
          onClick={() => activeService === 'all' ? clearAll() : clearService(activeService as ServiceName)}
          title="Clear logs"
          className="p-1.5 rounded hover:bg-(--color-bg-hover) text-(--color-text-muted) hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Log line count */}
      <div className="shrink-0 px-4 py-1 text-[10px] text-(--color-text-muted) border-b border-(--color-border-dim)">
        {lines.length.toLocaleString()} lines
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Virtualized list */}
      {lines.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-(--color-text-muted) text-sm">
          No logs yet — start a service to see output here
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
