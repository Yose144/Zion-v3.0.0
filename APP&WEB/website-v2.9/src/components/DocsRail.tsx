'use client';

import Link from 'next/link';
import { Book, Compass, Github, Route, ScrollText } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

export default function DocsRail() {
  const { lang } = useLang();

  const resources = [
    {
      title: tr('docsRail', 'res_docs_title', lang),
      description: tr('docsRail', 'res_docs_body', lang),
      icon: Book,
      href: '/docs#live-index',
      accent: 'from-zion-gold/20 to-zion-purple/10',
    },
    {
      title: tr('docsRail', 'res_download_title', lang),
      description: tr('docsRail', 'res_download_body', lang),
      icon: ScrollText,
      href: '/download',
      accent: 'from-zion-cyan/20 to-blue-500/10',
    },
    {
      title: tr('docsRail', 'res_explorer_title', lang),
      description: tr('docsRail', 'res_explorer_body', lang),
      icon: Compass,
      href: '/explorer',
      accent: 'from-rose-500/20 to-orange-400/10',
    },
  ];

  const ctas = [
    {
      title: tr('docsRail', 'cta_roadmap_title', lang),
      description: tr('docsRail', 'cta_roadmap_body', lang),
      icon: Route,
      href: '/roadmap',
    },
    {
      title: tr('docsRail', 'cta_github_title', lang),
      description: tr('docsRail', 'cta_github_body', lang),
      icon: Github,
      href: 'https://github.com/Zion-TerraNova',
      external: true,
    },
  ];

  return (
    <section className="py-8 px-4">
      <div className="zion-container space-y-4">
        <div className="flex flex-col md:flex-row md:items-end gap-2">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{tr('docsRail', 'nav_kicker', lang)}</p>
            <h2 className="text-2xl font-bold text-white">
              {tr('docsRail', 'headline_open', lang)}<span className="text-gradient">{tr('docsRail', 'headline_gradient', lang)}</span>
            </h2>
          </div>
          <p className="text-sm text-gray-300 max-w-2xl">
            {tr('docsRail', 'blurb', lang)}
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          {resources.map((resource) => (
            <div
              key={resource.title}
              className="zion-rainbow-card p-4 backdrop-blur relative overflow-hidden"
              style={{ '--rc': '59, 130, 246' } as React.CSSProperties}
            >
              <div className={`absolute inset-0 bg-linear-to-br ${resource.accent} opacity-80 pointer-events-none`} />
              <div className="relative space-y-3">
                <resource.icon className="w-5 h-5 text-white" />
                <div>
                  <h3 className="text-lg font-semibold text-white">{resource.title}</h3>
                  <p className="text-xs text-gray-200 mt-1">{resource.description}</p>
                </div>
                <Link href={resource.href} className="text-xs text-zion-gold font-semibold inline-flex items-center gap-2">
                  {tr('docsRail', 'card_open', lang)}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {ctas.map((cta) => (
            <Link
              key={cta.title}
              href={cta.href}
              target={cta.external ? '_blank' : undefined}
              rel={cta.external ? 'noreferrer' : undefined}
              className="zion-rainbow-card p-4 flex items-center gap-3"
              style={{ '--rc': '59, 130, 246' } as React.CSSProperties}
            >
              <cta.icon className="w-5 h-5 text-zion-cyan" />
              <div>
                <p className="text-base font-semibold text-white">{cta.title}</p>
                <p className="text-xs text-gray-300">{cta.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
