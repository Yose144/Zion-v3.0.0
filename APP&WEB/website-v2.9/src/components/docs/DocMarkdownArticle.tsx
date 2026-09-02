'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function DocMarkdownArticle({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <article className={className || 'prose prose-invert prose-lg max-w-none'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
