"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import ExplorerCopyButton from "./ExplorerCopyButton";
import { truncateHash } from "@/lib/explorer/format";

export interface ExplorerDetailRowProps {
  label: string;
  value?: string | number | null;
  copyValue?: string;
  children?: ReactNode;
  copy?: boolean;
  link?: string;
  mono?: boolean;
  color?: string;
  badge?: ReactNode;
  truncate?: boolean;
  title?: string;
  className?: string;
  empty?: string;
}

/**
 * Consistent key/value row used across block, transaction and address detail pages.
 * Handles truncation, copy-to-clipboard, internal links, badges and custom children.
 */
export default function ExplorerDetailRow({
  label,
  value,
  copyValue,
  children,
  copy,
  link,
  mono,
  color = "text-white",
  badge,
  truncate = false,
  title,
  className = "",
  empty = "—",
}: ExplorerDetailRowProps) {
  const displayValue = value === undefined || value === null || value === "" ? empty : String(value);
  const clipboardValue = copyValue || displayValue;
  const displayTitle = title ?? (truncate ? displayValue : undefined);

  const valueNode = (() => {
    if (children) return children;
    if (displayValue === empty) {
      return <span className="text-sm text-gray-600">{empty}</span>;
    }

    const text = truncate ? truncateHash(displayValue, 16, 10) : displayValue;
    const sharedClasses = `text-sm ${mono ? "font-mono" : ""} ${color} hover:text-white transition min-w-0`;

    if (link) {
      return (
        <Link
          href={link}
          title={displayTitle}
          className={`${sharedClasses} break-all sm:truncate sm:text-right`}
        >
          {text}
        </Link>
      );
    }

    return (
      <span
        title={displayTitle}
        className={`${sharedClasses} ${truncate ? "truncate text-right" : "break-all"}`}
      >
        {text}
      </span>
    );
  })();

  return (
    <div
      className={`group flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-white/[0.04] last:border-0 gap-1.5 sm:gap-3 ${className}`}
    >
      <span className="text-[11px] uppercase tracking-[0.12em] text-gray-500 font-medium flex-shrink-0 pt-0.5">
        {label}
      </span>
      <div className="flex items-center gap-2 min-w-0 sm:justify-end">
        {badge && <div className="flex-shrink-0">{badge}</div>}
        {valueNode}
        {copy && clipboardValue !== empty && (
          <ExplorerCopyButton
            text={clipboardValue}
            iconSize={14}
            stopPropagation
            className="opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0"
          />
        )}
      </div>
    </div>
  );
}
