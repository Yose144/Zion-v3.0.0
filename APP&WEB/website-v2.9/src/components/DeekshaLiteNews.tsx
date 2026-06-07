'use client';

import Link from 'next/link';
import { ArrowRight, Calendar, Newspaper } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { NEWS_ARTICLES } from './NewsFeed';

const LITE_LIMIT = 6;

export default function DeekshaLiteNews() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const articles = NEWS_ARTICLES.slice(0, LITE_LIMIT);

  return (
    <section className="py-12 px-4">
      <div className="zion-container">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Newspaper className="w-4 h-4 text-zion-gold" />
            <span className="text-xs uppercase tracking-[0.4em] text-gray-400">
              {cs ? 'Deeksha Lite — Novinky' : 'Deeksha Lite — News'}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            {cs ? 'Novinky (Lite)' : 'News (Lite)'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {cs
              ? 'Rychlý přehled bez animací — ideální pro starší zařízení.'
              : 'Quick overview without animations — ideal for older devices.'}
          </p>
        </div>

        {/* Simple list */}
        <div className="space-y-3">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={article.href}
              target={article.external ? '_blank' : undefined}
              rel={article.external ? 'noopener noreferrer' : undefined}
              className="group flex items-start gap-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors p-4"
            >
              {/* Date block */}
              <div className="flex-none w-14 text-center">
                <div className="text-[10px] uppercase tracking-wider text-gray-500">
                  {article.date.split('-')[1]}/{article.date.split('-')[0].slice(2)}
                </div>
                <div className="text-xs text-gray-300 mt-0.5">{article.date.split('-')[2]}</div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] uppercase tracking-wider ${article.tagColor}`}>
                    {cs ? article.tag.cs : article.tag.en}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-white group-hover:text-zion-gold transition-colors truncate">
                  {cs ? article.title.cs : article.title.en}
                </h3>
              </div>

              {/* Arrow */}
              <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-zion-gold transition-colors flex-none mt-1" />
            </Link>
          ))}
        </div>

        {/* View all */}
        <div className="mt-6 text-center">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {cs ? `Všechny novinky (${NEWS_ARTICLES.length})` : `All news (${NEWS_ARTICLES.length})`}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
