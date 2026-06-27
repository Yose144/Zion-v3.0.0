"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Box, X } from "lucide-react";

interface Toast {
  id: number;
  height: number;
  hash: string;
}

export default function LiveToast({ currentHeight }: { currentHeight: number }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastHeight, setLastHeight] = useState(currentHeight);

  useEffect(() => {
    if (currentHeight > lastHeight && lastHeight > 0) {
      const newToasts: Toast[] = [];
      for (let h = lastHeight + 1; h <= currentHeight; h++) {
        newToasts.push({ id: Date.now() + h, height: h, hash: "" });
      }
      setToasts((prev) => [...newToasts, ...prev].slice(0, 5));
    }
    setLastHeight(currentHeight);
  }, [currentHeight, lastHeight]);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            className="pointer-events-auto zion-rainbow-sub backdrop-blur-xl px-4 py-3 shadow-xl flex items-center gap-3"
            style={{ '--rc': '255, 215, 0' } as React.CSSProperties}
          >
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </div>
            <Box className="h-4 w-4 text-zion-gold" />
            <Link
              href={`/explorer/block?id=${t.height}`}
              className="text-sm font-semibold text-white hover:text-zion-cyan transition"
            >
              New Block #{t.height.toLocaleString()}
            </Link>
            <button onClick={() => remove(t.id)} className="text-gray-500 hover:text-white transition">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
