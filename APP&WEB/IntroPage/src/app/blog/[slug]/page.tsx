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

  let fullContent: string | undefined;
  let fullPage = false;

  if (post.file) {
    const extracted = extractFullPostContent(post.file);
    if (extracted) {
      fullContent = extracted.html;
      fullPage = extracted.fullPage;
    }
  }

  return (
    <BlogPostClient
      slug={params.slug}
      fullContent={fullContent}
      fullPage={fullPage}
    />
  );
}
