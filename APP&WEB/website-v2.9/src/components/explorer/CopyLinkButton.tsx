"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

export default function CopyLinkButton() {
  const [ok, setOk] = useState(false);

  const handleCopy = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-gray-400 hover:text-white hover:bg-white/10 transition"
      title="Copy link"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Link2 className="h-3.5 w-3.5" />}
      {ok ? "Copied" : "Copy Link"}
    </button>
  );
}
