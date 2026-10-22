"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import { truncateHash } from "@/lib/explorer/format";

interface HashChipProps {
  hash: string;
  head?: number;
  tail?: number;
  href?: string;
  className?: string;
  mono?: boolean;
  showCopy?: boolean;
}

/**
 * Truncated hash display with optional copy button and link.
 * Shows full hash in a tooltip on hover.
 */
export default function HashChip({
  hash,
  head = 12,
  tail = 8,
  href,
  className = "",
  mono = true,
  showCopy = true,
}: HashChipProps) {
  const [showFull, setShowFull] = useState(false);
  if (!hash) return <span className="text-gray-500">—</span>;

  const display = showFull ? hash : truncateHash(hash, head, tail);
  const fontClass = mono ? "font-mono" : "";

  const content = (
    <span
      className={`${fontClass} ${className}`}
      title={hash}
      onClick={(e) => {
        // Click to toggle full view (only if no href)
        if (!href && e.detail === 1) setShowFull(!showFull);
      }}
      style={{ cursor: href ? "pointer" : "text" }}
    >
      {display}
    </span>
  );

  return (
    <span className="inline-flex items-center gap-1.5">
      {href ? (
        <a href={href} className="text-zion-cyan hover:text-zion-gold transition-colors break-all">
          {content}
        </a>
      ) : (
        content
      )}
      {showCopy && <CopyButton text={hash} />}
    </span>
  );
}
