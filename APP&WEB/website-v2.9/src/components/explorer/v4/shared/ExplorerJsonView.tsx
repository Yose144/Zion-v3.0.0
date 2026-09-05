"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Code, FileDown } from "lucide-react";
import ExplorerCopyButton from "./ExplorerCopyButton";

interface ExplorerJsonViewProps {
  title?: string;
  json: string | null;
  fileName?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Lightweight JSON syntax highlighter for explorer raw data views.
 * Highlights keys (purple), strings (emerald), numbers (cyan),
 * booleans (gold) and null / punctuation (gray).
 */
function highlightJson(json: string): string {
  const token =
    /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|([{}[\],:])/g;

  return json.replace(token, (match, key, str, bool, num, punc) => {
    const escaped = escapeHtml(match);
    if (key) return `<span class="text-zion-purple">${escaped}</span>`;
    if (str) return `<span class="text-emerald-400">${escaped}</span>`;
    if (bool) return `<span class="text-zion-gold">${escaped}</span>`;
    if (num) return `<span class="text-zion-cyan">${escaped}</span>`;
    if (punc) return `<span class="text-gray-500">${escaped}</span>`;
    return `<span class="text-gray-300">${escaped}</span>`;
  });
}

export default function ExplorerJsonView({
  title = "Raw JSON",
  json,
  fileName = "zion-data.json",
}: ExplorerJsonViewProps) {
  const highlighted = useMemo(() => (json ? highlightJson(json) : ""), [json]);

  const handleDownload = () => {
    if (!json) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!json) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="zion-rainbow-card rounded-[28px] bg-black/60 overflow-hidden"
      style={{ "--rc": "228, 30, 43" } as React.CSSProperties}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-zion-purple" />
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <ExplorerCopyButton text={json} iconSize={14} label="JSON" />
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>
      <div className="p-4">
        <pre
          className="bg-black/60 border border-white/10 rounded-xl p-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-gray-300 max-h-[600px] overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </div>
    </motion.div>
  );
}
