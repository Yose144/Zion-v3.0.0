"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PageLayout from "../../components/PageLayout";
import HeroImage from "../../components/HeroImage";
import LucideIcon from "../../components/LucideIcon";
import blogData from "../../data/blog-posts.json";

const { posts, categories } = blogData;

const monthNames = {
  cs: ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

function formatDate(dateStr: string, lang: "cs" | "en") {
  const d = new Date(dateStr);
  return `${d.getDate()}. ${monthNames[lang][d.getMonth()]} ${d.getFullYear()}`;
}

type BlogPostClientProps = {
  slug: string;
  fullContent?: string;
};

export default function BlogPostClient({
  slug,
  fullContent,
}: BlogPostClientProps) {
  const [lang, setLang] = useState<"cs" | "en">("cs");

  const index = posts.findIndex((p) => p.slug === slug);
  const post = posts[index];

  if (!post) return null;

  const category = categories[post.category as keyof typeof categories] as any;
  const title = lang === "en" ? post.titleEn || post.title : post.title;
  const excerpt = lang === "en" ? post.excerptEn || post.excerpt : post.excerpt;
  const content =
    lang === "en"
      ? post.contentEn || fullContent || post.content
      : fullContent || post.content;

  const fixImage = (src?: string) => {
    if (!src) return "";
    return src.replace(/^\.\//, "/legacy/");
  };

  const prev = index < posts.length - 1 ? posts[index + 1] : null;
  const next = index > 0 ? posts[index - 1] : null;

  const postTitle = (p: typeof posts[0]) => (lang === "en" ? p.titleEn || p.title : p.title);

  const handleHref = (p: typeof posts[0]) => (p.content ? `/blog/${p.slug}` : `/legacy/${p.file}`);

  return (
    <PageLayout lang={lang} setLang={setLang}>
      <HeroImage
        src={post.image ? fixImage(post.image) : "/legacy/img/org1.jpg"}
        alt={title}
        className="py-20 md:py-24"
      >
        <span
          className="rounded-full border px-4 py-1 text-sm font-semibold text-black"
          style={{ backgroundColor: category?.color || "#fcd116" }}
        >
          {lang === "cs" ? category?.label : category?.labelEn}
        </span>
        <h1 className="max-w-3xl text-3xl font-extrabold text-white md:text-5xl">
          {title}
        </h1>
        <p className="text-white/70">
          <LucideIcon name="fa-calendar" size={16} className="mr-1" /> {formatDate(post.date, lang)}
        </p>
      </HeroImage>

      <article className="active">
        <section>
          {post.image && (
            <div className="mb-6 overflow-hidden rounded-xl border border-white/10">
              <Image
                src={fixImage(post.image)}
                alt={title}
                width={1200}
                height={540}
                sizes="(max-width: 768px) 100vw, 46rem"
                decoding="async"
                className="h-auto w-full object-cover"
              />
            </div>
          )}

          <p className="lead text-center text-lg italic text-[#fcd116]">
            {excerpt}
          </p>

          {content ? (
            <div
              className="article mx-auto mt-6 max-w-none"
              dangerouslySetInnerHTML={{
                __html: content
                  .replace(/src="\.\.\/\.\.\/img\//g, 'src="/legacy/img/')
                  .replace(/src='\.\.\/\.\.\/img\//g, "src='/legacy/img/")
                  .replace(/src="\.\/img\//g, 'src="/legacy/img/')
                  .replace(/src='\.\/img\//g, "src='/legacy/img/")
                  .replace(/href="\.\.\/\.\.\/\.\.\//g, 'href="/legacy/')
                  .replace(/href="\.\.\/\.\.\//g, 'href="/legacy/')
                  .replace(/href="\.\.\//g, 'href="/legacy/')
                  .replace(/href="\.\//g, 'href="/legacy/'),
              }}
            />
          ) : post.file ? (
            <div className="my-10 rounded-xl border border-[#fcd116]/20 bg-white/[0.03] p-8 text-center">
              <LucideIcon name="fa-file-lines" size={48} className="mb-3 text-[#fcd116]" />
              <p className="mb-4">
                {lang === "cs"
                  ? "Tento příspěvek je dostupný v plné HTML verzi v archivu."
                  : "This post is available as a full HTML version in the archive."}
              </p>
              <a
                href={`/legacy/${post.file}`}
                className="button primary small rasta-gold"
              >
                <LucideIcon name="fa-arrow-up-right-from-square" size={16} className="mr-2" />
                {lang === "cs" ? "Zobrazit plnou verzi" : "View full version"}
              </a>
            </div>
          ) : (
            <p className="text-center text-white/50">
              {lang === "cs" ? "Obsah brzy doplníme." : "Content will be added soon."}
            </p>
          )}
        </section>

        <section className="border-t border-white/10 pt-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            {prev ? (
              <Link
                href={handleHref(prev)}
                className="button primary small rasta-green"
              >
                <LucideIcon name="fa-arrow-left" size={16} />
                <span className="ml-2 line-clamp-1 max-w-[180px] text-left">
                  {postTitle(prev)}
                </span>
              </Link>
            ) : (
              <span></span>
            )}
            <Link
              href="/blog"
              className="button primary small rasta-green"
            >
              <LucideIcon name="fa-list" size={16} className="mr-2" /> {lang === "cs" ? "Zpět do archivu" : "Back to archive"}
            </Link>
            {next ? (
              <Link
                href={handleHref(next)}
                className="button primary small rasta-gold"
              >
                <span className="mr-2 line-clamp-1 max-w-[180px] text-right">
                  {postTitle(next)}
                </span>
                <LucideIcon name="fa-arrow-right" size={16} />
              </Link>
            ) : (
              <span></span>
            )}
          </div>
        </section>
      </article>
    </PageLayout>
  );
}
