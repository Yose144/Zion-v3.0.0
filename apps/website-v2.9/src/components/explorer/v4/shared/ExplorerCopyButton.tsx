"use client";

import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";

interface ExplorerCopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  iconSize?: number;
  stopPropagation?: boolean;
  title?: string;
}

/**
 * Compact copy-to-clipboard button used across explorer detail and list views.
 * Shows a cyan checkmark for 1.5s after a successful copy, with a non-secure
 * context fallback for local / HTTP development.
 */
export default function ExplorerCopyButton({
  text,
  label,
  className = "",
  iconSize = 14,
  stopPropagation = false,
  title,
}: ExplorerCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e?: React.MouseEvent) => {
      if (stopPropagation && e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const ok = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      };

      if (!text) return;

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(ok).catch(() => {
          fallbackCopy(text, ok);
        });
      } else {
        fallbackCopy(text, ok);
      }
    },
    [text, stopPropagation]
  );

  if (!text) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-gray-500 hover:text-zion-cyan transition-colors focus:outline-none ${className}`}
      title={title || (copied ? "Copied" : (label ? `Copy ${label}` : "Copy to clipboard"))}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <Check className="text-zion-cyan" style={{ width: iconSize, height: iconSize }} />
      ) : (
        <Copy style={{ width: iconSize, height: iconSize }} />
      )}
      {label && !copied && <span className="text-xs">{label}</span>}
      {label && copied && <span className="text-xs text-zion-cyan">{label}</span>}
    </button>
  );
}

function fallbackCopy(value: string, onDone: () => void) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.setAttribute("aria-hidden", "true");
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (document.execCommand("copy")) onDone();
  } catch {
    /* ignore */
  }
  document.body.removeChild(textarea);
}
