import { notFound } from "next/navigation";
import BlogPostClient from "./BlogPostClient";
import blogData from "../../data/blog-posts.json";

const { posts } = blogData;

export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

export default function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = posts.find((p) => p.slug === params.slug);
  if (!post) return notFound();

  return <BlogPostClient slug={params.slug} />;
}
