import { notFound } from "next/navigation";
import BlogPostClient from "./BlogPostClient";
import blogData from "../../data/blog-posts.json";
import { extractFullPostContent } from "./fullContent";

const { posts } = blogData;

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) return notFound();

  const extracted = post.file ? extractFullPostContent(post.file) : null;
  const fullContent = extracted ?? undefined;

  return <BlogPostClient slug={params.slug} fullContent={fullContent} />;
}
