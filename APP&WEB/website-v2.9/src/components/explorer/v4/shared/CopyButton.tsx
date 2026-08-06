"use client";

import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  iconSize?: number;
}

/**
 * Copy-to-clipboard button with visual feedback.
 * Shows a checkmark for 1.5s after successful copy.
 */
export default function CopyButton({ text, label, className = "", iconSize = 14 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Fallback for non-secure contexts
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
      document.body.removeChild(textarea);
    });
  }, [text]);

  if (!text) return null;

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 text-gray-400 hover:text-zion-gold transition-colors ${className}`}
      title={label || "Copy to clipboard"}
      type="button"
    >
      {copied ? (
        <Check className="text-zion-cyan-400" style={{ width: iconSize, height: iconSize }} />
      ) : (
        <Copy style={{ width: iconSize, height: iconSize }} />
      )}
      {label && <span className="text-xs">{label}</span>}
    </button>
  );
}
