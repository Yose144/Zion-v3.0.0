'use client';

import MarkdownDoc from './MarkdownDoc';

export default function DocMarkdownArticle({
  content,
  className,
  sourceFile,
  bookSlugs,
}: {
  content: string;
  className?: string;
  /** Path relative to public/docs — enables corpus link resolution. */
  sourceFile?: string;
  bookSlugs?: Set<string>;
}) {
  return (
    <MarkdownDoc
      content={content}
      sourceFile={sourceFile}
      bookSlugs={bookSlugs}
      className={className}
    />
  );
}
