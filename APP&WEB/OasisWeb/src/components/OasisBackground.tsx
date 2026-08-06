'use client';

import { motion } from 'framer-motion';

export default function OasisBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-oasis-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(7,137,48,0.10),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(228,30,43,0.10),transparent_50%)]" />
      <motion.div
        animate={{
          x: [0, 40, 0],
          y: [0, -30, 0],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-oasis-cyan/15 blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -30, 0],
          y: [0, 40, 0],
          opacity: [0.15, 0.22, 0.15],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-oasis-purple/15 blur-3xl"
      />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxjaXJjbGUgY3g9IjEiIGN5PSIxIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+Cjwvc3ZnPg==')] opacity-20" />
    </div>
  );
}
