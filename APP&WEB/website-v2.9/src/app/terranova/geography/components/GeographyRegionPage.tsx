'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

type Insert = {
  id: string;
  titleCs: string;
  titleEn: string;
  descCs: string;
  descEn: string;
};

type RegionData = {
  titleCs: string;
  titleEn: string;
  subtitleCs: string;
  subtitleEn: string;
  inserts: Insert[];
};

export default function GeographyRegionPage({ data }: { data: RegionData }) {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <div className="zion-page">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/3 h-[600px] w-[600px] rounded-full blur-[240px] bg-violet-500/8" />
        <div className="absolute -right-40 top-2/3 h-[500px] w-[500px] rounded-full blur-[200px] bg-purple-500/6" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-violet-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {cs ? 'Zpět na Terra Nova' : 'Back to Terra Nova'}
          </Link>
        </motion.div>

        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-16"
        >
          <div className="zion-rainbow-card rounded-3xl md:rounded-4xl p-8 md:p-12 border border-violet-500/20 relative overflow-hidden" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/30 via-purple-900/10 to-transparent" />
            <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full blur-[100px] bg-violet-500/15" />
            <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full blur-[80px] bg-purple-500/10" />
            <div className="relative z-10 space-y-3">
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold tracking-[0.3em] text-violet-400 uppercase">
                {cs ? 'Kulturní vložky' : 'Cultural inserts'}
              </span>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                {cs ? data.titleCs : data.titleEn}
              </h1>
              <p className="text-lg text-violet-400 font-medium">
                {cs ? data.subtitleCs : data.subtitleEn}
              </p>
            </div>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-16"
        >
          <div className="text-center mb-8">
            <p className="text-[10px] uppercase tracking-[0.45em] text-gray-500 mb-2">
              {cs ? 'Dostupné vložky' : 'Available inserts'}
            </p>
            <h2 className="text-2xl font-bold text-white">
              {cs ? 'Regionální sbírka' : 'Regional collection'}
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.inserts.map((insert, i) => (
              <motion.div
                key={insert.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07, duration: 0.5 }}
                className="relative zion-rainbow-sub p-5 space-y-3 overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
                style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
              >
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-[50px] opacity-20 group-hover:opacity-35 transition-opacity duration-500 bg-violet-500" />
                <div className="flex items-start justify-between relative z-10 gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center zion-tile">
                    <FolderOpen className="h-5 w-5 text-violet-300" />
                  </span>
                </div>
                <h3 className="font-bold relative z-10 text-violet-200">
                  {cs ? insert.titleCs : insert.titleEn}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                  {cs ? insert.descCs : insert.descEn}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
