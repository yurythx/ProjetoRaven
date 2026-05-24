import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/backend";
import { getSiteBaseUrl } from "@/lib/env";

type Paginated<T> = {
  results: T[];
};

type BlogPostListItem = {
  title: string;
  slug: string;
  excerpt: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toRfc2822(dateIso: string) {
  const d = new Date(dateIso);
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export async function GET() {
  const base = getSiteBaseUrl();
  const res = await backendFetch<Paginated<BlogPostListItem>>("/api/blog/public/posts/?page=1&page_size=50&ordering=-published_at", {
    method: "GET",
    cache: "force-cache",
    next: { revalidate: 300, tags: ["blog:posts"] },
  });

  const items = res.ok ? res.data.results ?? [] : [];
  const updated = items[0]?.updated_at || items[0]?.published_at || items[0]?.created_at || new Date().toISOString();

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0">` +
    `<channel>` +
    `<title>${escapeXml("Projeto Raven - Blog")}</title>` +
    `<link>${escapeXml(`${base}/blog`)}</link>` +
    `<description>${escapeXml("Notícias e posts do Projeto Raven.")}</description>` +
    `<lastBuildDate>${escapeXml(toRfc2822(updated))}</lastBuildDate>` +
    items
      .map((p) => {
        const link = `${base}/blog/${encodeURIComponent(p.slug)}`;
        const pub = p.published_at || p.created_at;
        return (
          `<item>` +
          `<title>${escapeXml(p.title)}</title>` +
          `<link>${escapeXml(link)}</link>` +
          `<guid isPermaLink="true">${escapeXml(link)}</guid>` +
          `<pubDate>${escapeXml(toRfc2822(pub))}</pubDate>` +
          `<description>${escapeXml(p.excerpt || "")}</description>` +
          `</item>`
        );
      })
      .join("") +
    `</channel>` +
    `</rss>`;

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300",
    },
  });
}
