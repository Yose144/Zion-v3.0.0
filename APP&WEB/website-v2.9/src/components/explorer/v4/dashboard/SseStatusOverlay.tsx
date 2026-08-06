"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useExplorerSSE } from "../hooks";
import { useLang } from "@/contexts/LanguageContext";
import { formatAge } from "@/lib/explorer/format";

/**
 * SSE status overlay — shows a small indicator when SSE is active.
 * Displays the latest block height and connection state.
 * Can be placed anywhere on the explorer pages.
 */
export default function SseStatusOverlay() {
  const { lang } = useLang();
  const cs = lang === "cs";
  const { stats, connected, blockCount } = useExplorerSSE({ interval: 15 });

  if (!connected && blockCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed bottom-4 right-4 z-50 pointer-events-none"
      >
        <div className="zion-panel-soft rounded-xl px-3 py-2 flex items-center gap-2">
          <motion.span
            className="flex h-2 w-2"
            animate={{ opacity: connected ? [1, 0.4, 1] : 0.3 }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className={`inline-flex h-2 w-2 rounded-full ${connected ? "bg-zion-cyan-400" : "bg-gray-500"}`} />
          </motion.span>
          <span className="text-xs text-gray-400">
            {connected
              ? (cs ? "SSE živé" : "SSE live")
              : (cs ? "SSE připojuje…" : "SSE connecting…")}
          </span>
          {stats && (
            <>
              <span className="text-xs text-gray-600">|</span>
              <span className="text-xs font-mono text-zion-cyan">
                #{stats.height}
              </span>
              {stats.mempool_size > 0 && (
                <>
                  <span className="text-xs text-gray-600">|</span>
                  <span className="text-xs text-zion-gold-400">
                    {stats.mempool_size} TX
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
