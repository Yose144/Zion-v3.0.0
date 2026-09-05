"use client";

import Link from "next/link";
import { Box, ArrowLeft } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

interface ExplorerEmptyStateProps {
  title?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
}

const copy = {
  en: {
    back: "Back to Explorer",
  },
  cs: {
    back: "Zpět do exploreru",
  },
};

/**
 * Consistent empty / not-found state for explorer detail pages.
 */
export default function ExplorerEmptyState({
  title,
  message,
  backHref = "/explorer",
  backLabel,
}: ExplorerEmptyStateProps) {
  const { lang } = useLang();
  const cs = lang === "cs";
  const c = copy[cs ? "cs" : "en"];

  return (
    <div className="relative min-h-screen pb-24 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <Box className="h-16 w-16 text-zion-purple/50 mx-auto mb-4" />
        {title && <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>}
        {message && <p className="text-gray-500 text-sm mb-6">{message}</p>}
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel || c.back}
        </Link>
      </div>
    </div>
  );
}
