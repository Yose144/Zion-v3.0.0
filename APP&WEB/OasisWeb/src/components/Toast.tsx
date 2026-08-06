'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { useToastStore } from '../store/toastStore';

const ICONS = {
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

const COLORS = {
  success: 'border-rasta-green/30 bg-rasta-green/10 text-rasta-green',
  info: 'border-oasis-cyan/30 bg-oasis-cyan/10 text-oasis-cyan',
  warning: 'border-oasis-gold/30 bg-oasis-gold/10 text-oasis-gold',
  error: 'border-rasta-red/30 bg-rasta-red/10 text-rasta-red',
};

export default function ToastContainer() {
  const { toasts, remove } = useToastStore();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-full max-w-xs flex-col gap-2 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={remove} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ReturnType<typeof useToastStore.getState>['toasts'][number]; onRemove: (id: string) => void }) {
  const Icon = ICONS[toast.type];

  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), toast.duration ?? 3000);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3 shadow-lg backdrop-blur-md ${COLORS[toast.type]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 text-sm text-white">{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} className="text-white/60 hover:text-white">
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
