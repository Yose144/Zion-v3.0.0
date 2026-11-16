import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BlogPostClient from "./BlogPostClient";
import blogData from "../../data/blog-posts.json";
import { extractFullPostContent } from "./fullContent";

const { posts } = blogData;

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return { title: "Kronika — ZION TerraNova" };
  return {
    title: `${post.title} | ZION TerraNova`,
    description: post.excerpt,
    alternates: { canonical: `/blog/${slug}/` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `/blog/${slug}/`,
      type: "article",
      images: post.image ? [{ url: post.image }] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return notFound();

  const extracted = post.file ? extractFullPostContent(post.file) : null;
  const fullContent = extracted ?? undefined;

  return <BlogPostClient slug={slug} fullContent={fullContent} />;
}
