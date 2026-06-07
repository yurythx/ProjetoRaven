import type { MetadataRoute } from "next";

import { backendFetch } from "@/lib/backend";
import { getSiteBaseUrl } from "@/lib/env";

type Paginated<T> = {
  next: string | null;
  results: T[];
};

type BlogPostListItem = {
  slug: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type ForumCategoryListItem = {
  slug: string;
};

type ForumTopicListItem = {
  slug: string;
  created_at: string;
  updated_at: string;
};

type BlogCategoryListItem = {
  slug: string;
  updated_at?: string;
};

type BlogTagListItem = {
  slug: string;
  updated_at?: string;
};

function nextPath(nextUrl: string | null): string | null {
  if (!nextUrl) return null;
  try {
    const u = new URL(nextUrl);
    return `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

async function fetchAllBlogPosts(): Promise<BlogPostListItem[]> {
  const all: BlogPostListItem[] = [];
  let path: string | null = "/api/v1/blog/public/posts/?page=1&page_size=100&ordering=-published_at";
  for (let i = 0; i < 200 && path; i++) {
    const res = await backendFetch<Paginated<BlogPostListItem>>(path, {
      method: "GET",
      cache: "force-cache",
      next: { revalidate: 300, tags: ["blog:posts"] },
    });
    if (!res.ok) break;
    all.push(...(res.data.results ?? []));
    path = nextPath(res.data.next);
  }
  return all;
}

async function fetchAllForumCategories(): Promise<ForumCategoryListItem[]> {
  const all: ForumCategoryListItem[] = [];
  let path: string | null = "/api/v1/forum/public/categories/?page=1&page_size=100";
  for (let i = 0; i < 50 && path; i++) {
    const res = await backendFetch<Paginated<ForumCategoryListItem>>(path, {
      method: "GET",
      cache: "force-cache",
      next: { revalidate: 300, tags: ["forum:categories"] },
    });
    if (!res.ok) break;
    all.push(...(res.data.results ?? []));
    path = nextPath(res.data.next);
  }
  return all;
}

async function fetchAllForumTopics(): Promise<ForumTopicListItem[]> {
  const all: ForumTopicListItem[] = [];
  let path: string | null = "/api/v1/forum/public/topics/?page=1&page_size=100";
  for (let i = 0; i < 200 && path; i++) {
    const res = await backendFetch<Paginated<ForumTopicListItem>>(path, {
      method: "GET",
      cache: "force-cache",
      next: { revalidate: 300, tags: ["forum:topics"] },
    });
    if (!res.ok) break;
    all.push(...(res.data.results ?? []));
    path = nextPath(res.data.next);
  }
  return all;
}

async function fetchAllBlogCategories(): Promise<BlogCategoryListItem[]> {
  const all: BlogCategoryListItem[] = [];
  let path: string | null = "/api/v1/blog/public/categories/?page=1&page_size=100";
  for (let i = 0; i < 50 && path; i++) {
    const res = await backendFetch<Paginated<BlogCategoryListItem>>(path, {
      method: "GET",
      cache: "force-cache",
      next: { revalidate: 300, tags: ["blog:categories"] },
    });
    if (!res.ok) break;
    all.push(...(res.data.results ?? []));
    path = nextPath(res.data.next);
  }
  return all;
}

async function fetchAllBlogTags(): Promise<BlogTagListItem[]> {
  const all: BlogTagListItem[] = [];
  let path: string | null = "/api/v1/blog/public/tags/?page=1&page_size=200";
  for (let i = 0; i < 50 && path; i++) {
    const res = await backendFetch<Paginated<BlogTagListItem>>(path, {
      method: "GET",
      cache: "force-cache",
      next: { revalidate: 300, tags: ["blog:tags"] },
    });
    if (!res.ok) break;
    all.push(...(res.data.results ?? []));
    path = nextPath(res.data.next);
  }
  return all;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteBaseUrl();
  const [posts, blogCategories, blogTags, forumCategories, forumTopics] = await Promise.all([
    fetchAllBlogPosts(),
    fetchAllBlogCategories(),
    fetchAllBlogTags(),
    fetchAllForumCategories(),
    fetchAllForumTopics(),
  ]);

  const items: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/forum`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/search`, changeFrequency: "weekly", priority: 0.6 },
  ];

  for (const c of blogCategories) {
    items.push({
      url: `${base}/blog?category=${encodeURIComponent(c.slug)}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const t of blogTags) {
    items.push({
      url: `${base}/blog?tag=${encodeURIComponent(t.slug)}`,
      changeFrequency: "weekly",
      priority: 0.55,
    });
  }

  for (const p of posts) {
    const last = p.updated_at || p.published_at || p.created_at;
    items.push({
      url: `${base}/blog/${encodeURIComponent(p.slug)}`,
      lastModified: last ? new Date(last) : undefined,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const c of forumCategories) {
    items.push({
      url: `${base}/forum/c/${encodeURIComponent(c.slug)}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const t of forumTopics) {
    const last = t.updated_at || t.created_at;
    items.push({
      url: `${base}/forum/t/${encodeURIComponent(t.slug)}`,
      lastModified: last ? new Date(last) : undefined,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return items;
}
