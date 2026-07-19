"use client";

import { type ReactNode } from "react";

export interface ZionDataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  width?: string;
}

interface ZionDataTableProps<T> {
  columns: ZionDataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  keyExtractor: (row: T, index: number) => string;
  className?: string;
}

/**
 * Generic responsive table wrapper with glass styling.
 * Horizontally scrollable on small screens.
 * Supports loading skeletons and empty states.
 */
export default function ZionDataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = "No data",
  onRowClick,
  keyExtractor,
  className = "",
}: ZionDataTableProps<T>) {
  const alignClass = (align?: string) => {
    switch (align) {
      case "right": return "text-right";
      case "center": return "text-center";
      default: return "text-left";
    }
  };

  if (loading) {
    return (
      <div className={`zion-panel-soft rounded-2xl overflow-hidden ${className}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                {columns.map((col) => (
                  <th key={col.key} className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${alignClass(col.align)}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${alignClass(col.align)}`}>
                      <div className="h-4 bg-white/5 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={`zion-panel-soft rounded-2xl p-8 text-center text-gray-500 ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`zion-panel-soft rounded-2xl overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${alignClass(col.align)} ${col.className || ""}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={keyExtractor(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-white/5 hover:bg-white/5 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm ${alignClass(col.align)} ${col.className || ""}`}>
                    {col.render(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
