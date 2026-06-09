'use client';

import Link from 'next/link';
import { Newspaper, ArrowRight, Calendar, ArrowLeft } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { NEWS_ARTICLES } from './NewsFeed';
import { tr } from '@/lib/translations';

export default function NewsArchive() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <div className="py-20 px-4">
      <div className="zion-container">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {tr('APP_WEB_website_v2_9_src_components_News', 'back_to_homepage', lang)}
          </Link>

          <div className="flex items-center gap-3 mb-3">
            <Newspaper className="w-5 h-5 text-zion-gold" />
            <span className="text-sm uppercase tracking-[0.4em] text-gray-400">
              {tr('APP_WEB_website_v2_9_src_components_News', 'news_archive', lang)}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            <span className="text-gradient">
              {tr('APP_WEB_website_v2_9_src_components_News', 'news', lang)}
            </span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl">
            {cs
              ? 'Všechny zprávy z vývoje ZION ekosystému — DeFi, těžba, benchmarky, síť a releases.'
              : 'All updates from the ZION ecosystem — DeFi, mining, benchmarks, network, and releases.'}
          </p>
        </div>

        {/* All articles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {NEWS_ARTICLES.map((article) => (
            <div key={article.slug}>
              <Link
                href={article.href}
                target={article.external ? '_blank' : undefined}
                rel={article.external ? 'noopener noreferrer' : undefined}
                className="group relative block h-full rounded-3xl border border-white/10 bg-white/3 hover:bg-white/6 transition-all duration-300 overflow-hidden"
              >
                {/* Gradient accent top */}
                <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-zion-gold/30 to-transparent" />

                <div className="p-6">
                  {/* Meta row */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full border border-white/10 bg-white/5 ${article.tagColor}`}>
                      {cs ? article.tag.cs : article.tag.en}
                    </span>
                    <span className="text-[11px] text-white/30 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {article.date}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-white group-hover:text-zion-gold transition-colors mb-3 leading-snug">
                    {cs ? article.title.cs : article.title.en}
                  </h3>

                  {/* Summary */}
                  <p className="text-sm text-white/45 leading-relaxed mb-4">
                    {cs ? article.summary.cs : article.summary.en}
                  </p>

                  {/* Read more */}
                  <div className="flex items-center gap-1.5 text-xs text-zion-gold/60 group-hover:text-zion-gold transition-colors">
                    <span>{tr('APP_WEB_website_v2_9_src_components_News', 'read_more', lang)}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
