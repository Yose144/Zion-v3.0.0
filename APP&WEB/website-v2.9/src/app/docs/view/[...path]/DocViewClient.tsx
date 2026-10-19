'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ChevronRight, FileText, Library, ExternalLink } from 'lucide-react';
import MarkdownDoc from '@/components/docs/MarkdownDoc';
import { useLang } from '@/contexts/LanguageContext';
import { DOC_PATH_ALIASES } from '@/lib/docLinks';
import { DOC_FILE_TO_ID } from '@/lib/docs-manifest';

const Copy = {
  notFoundTitle: { cs: 'Dokument nebyl nalezen', en: 'Document not found' },
  notFoundBody: {
    cs: 'Tento dokument není ve veřejné knihovně publikovaný — odkaz ukazuje na interní nebo přesunutý materiál.',
    en: 'This document is not published in the public library — the link points to internal or moved material.',
  },
  backToLibrary: { cs: 'Zpět do knihovny', en: 'Back to the library' },
  openInLibrary: { cs: 'Otevřít v knihovně', en: 'Open in the library' },
  rawFile: { cs: 'Zdrojový soubor', en: 'Source file' },
};

function extractTitle(md: string): string | null {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].replace(/[*_`]/g, '').trim() : null;
}

export default function DocViewClient() {
  const params = useParams<{ path?: string[] }>();
  const { lang } = useLang();
  const cs = lang === 'cs';
  const rawPath = (params?.path ?? []).join('/');

  // Friendly alias → real file (e.g. view/whitepaper/zion-oasis)
  const file = useMemo(() => {
    const decoded = decodeURIComponent(rawPath);
    return DOC_PATH_ALIASES[decoded] ?? decoded;
  }, [rawPath]);

  const [content, setContent] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setContent(null);
    fetch(`/docs/${file}`)
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (cancelled) return;
        if (text === null) setStatus('missing');
        else {
          setContent(text);
          setStatus('ok');
        }
      })
      .catch(() => !cancelled && setStatus('missing'));
    return () => {
      cancelled = true;
    };
  }, [file]);

  const title = useMemo(() => (content ? extractTitle(content) : null), [content]);
  const libId = DOC_FILE_TO_ID[file];
  const crumbs = file.split('/');

  return (
    <div className="zion-container py-12 md:py-16">
      <div className="max-w-3xl xl:max-w-4xl mx-auto">
        {/* Breadcrumbs */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 mb-8">
          <Link href="/docs" className="inline-flex items-center gap-1.5 text-zion-cyan hover:text-white transition-colors">
            <BookOpen className="w-4 h-4" /> Docs
          </Link>
          {crumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-gray-600" />
              <span className={i === crumbs.length - 1 ? 'text-zion-gold' : 'text-gray-500'}>{c}</span>
            </span>
          ))}
        </nav>

        {status === 'loading' && (
          <div className="space-y-6 py-12">
            <div className="h-10 w-2/3 rounded-lg bg-white/10 animate-pulse" />
            <div className="h-px w-full bg-white/5" />
            <div className="h-5 w-full rounded bg-white/5 animate-pulse" />
            <div className="h-5 w-5/6 rounded bg-white/5 animate-pulse" />
          </div>
        )}

        {status === 'missing' && (
          <div className="zion-rainbow-card p-10 text-center" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
            <FileText className="w-10 h-10 mx-auto mb-4 text-gray-600" />
            <h1 className="text-2xl font-bold text-white mb-3">{cs ? Copy.notFoundTitle.cs : Copy.notFoundTitle.en}</h1>
            <p className="text-gray-400 mb-2">{cs ? Copy.notFoundBody.cs : Copy.notFoundBody.en}</p>
            <code className="text-xs bg-white/5 px-2 py-1 rounded text-gray-500 block w-fit mx-auto mb-8">{file}</code>
            <Link href="/docs" className="zion-button-primary inline-flex items-center gap-2">
              <Library className="w-4 h-4" /> {cs ? Copy.backToLibrary.cs : Copy.backToLibrary.en}
            </Link>
          </div>
        )}

        {status === 'ok' && content !== null && (
          <>
            <div className="mb-10 pb-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
              {title ? (
                <h1 className="text-3xl md:text-4xl font-bold text-gradient leading-tight">{title}</h1>
              ) : (
                <h1 className="text-2xl font-bold text-white">{crumbs[crumbs.length - 1]}</h1>
              )}
              <div className="flex items-center gap-3">
                {libId && (
                  <Link href={`/docs#${libId}`} className="zion-button-secondary inline-flex items-center gap-2 text-sm">
                    <Library className="w-4 h-4" /> {cs ? Copy.openInLibrary.cs : Copy.openInLibrary.en}
                  </Link>
                )}
                <a
                  href={`/docs/${file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zion-button-secondary inline-flex items-center gap-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4" /> {cs ? Copy.rawFile.cs : Copy.rawFile.en}
                </a>
              </div>
            </div>
            <div className="zion-docs-prose">
              <MarkdownDoc content={content} sourceFile={file} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
