import { NextResponse, type NextRequest } from "next/server";

import { getApiBaseUrl, getSiteBaseUrl } from "@/lib/env";

type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

type PostItem = {
  title: string;
  slug: string;
  excerpt?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  author_name?: string | null;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdataSafe(value: string): string {
  return value.replaceAll("]]>", "]]]]><![CDATA[>");
}

function toRfc822(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toUTCString();
}

function nextPath(nextUrl: string | null): string | null {
  if (!nextUrl) return null;
  try {
    const u = new URL(nextUrl);
    return `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

async function fetchPosts(params: { category?: string; tag?: string }): Promise<PostItem[]> {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const qs = new URLSearchParams({
    page: "1",
    page_size: "50",
    ordering: "-published_at",
  });
  if (params.category) qs.set("category", params.category);
  if (params.tag) qs.set("tag", params.tag);

  const all: PostItem[] = [];
  let path: string | null = `/api/v1/blog/public/posts/?${qs.toString()}`;
  for (let i = 0; i < 5 && path; i++) {
    const res = await fetch(`${base}${path}`, { cache: "no-store" });
    if (!res.ok) break;
    const data = (await res.json()) as Paginated<PostItem>;
    all.push(...(data.results ?? []));
    path = nextPath(data.next);
  }
  return all;
}

function buildRssXml(opts: {
  title: string;
  description: string;
  link: string;
  items: Array<{ title: string; link: string; guid: string; pubDate?: string | null; description?: string }>;
}): string {
  const channelItems = opts.items
    .map((it) => {
      const pubDate = it.pubDate ? `<pubDate>${escapeXml(it.pubDate)}</pubDate>` : "";
      const description = it.description ? `<description><![CDATA[${it.description}]]></description>` : "";
      return [
        "<item>",
        `<title>${escapeXml(it.title)}</title>`,
        `<link>${escapeXml(it.link)}</link>`,
        `<guid isPermaLink="true">${escapeXml(it.guid)}</guid>`,
        pubDate,
        description,
        "</item>",
      ].filter(Boolean).join("");
    })
    .join("");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0">`,
    `<channel>`,
    `<title>${escapeXml(opts.title)}</title>`,
    `<link>${escapeXml(opts.link)}</link>`,
    `<description>${escapeXml(opts.description)}</description>`,
    channelItems,
    `</channel>`,
    `</rss>`,
  ].join("");
}

function buildAtomXml(opts: {
  title: string;
  link: string;
  updated: string;
  entries: Array<{ title: string; link: string; id: string; updated: string; summary?: string }>;
}): string {
  const entries = opts.entries
    .map((e) => {
      const summary = e.summary ? `<summary type="html"><![CDATA[${e.summary}]]></summary>` : "";
      return [
        "<entry>",
        `<title>${escapeXml(e.title)}</title>`,
        `<link href="${escapeXml(e.link)}" />`,
        `<id>${escapeXml(e.id)}</id>`,
        `<updated>${escapeXml(e.updated)}</updated>`,
        summary,
        "</entry>",
      ].filter(Boolean).join("");
    })
    .join("");

  return [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<feed xmlns="http://www.w3.org/2005/Atom">`,
    `<title>${escapeXml(opts.title)}</title>`,
    `<link href="${escapeXml(opts.link)}" />`,
    `<updated>${escapeXml(opts.updated)}</updated>`,
    `<id>${escapeXml(opts.link)}</id>`,
    entries,
    `</feed>`,
  ].join("");
}

export async function GET(req: NextRequest) {
  const site = getSiteBaseUrl().replace(/\/+$/, "");
  const url = new URL(req.url);
  const category = (url.searchParams.get("category") || "").trim();
  const tag = (url.searchParams.get("tag") || "").trim();
  const format = (url.searchParams.get("format") || "").trim().toLowerCase();

  const titleSuffix = category ? ` — Categoria: ${category}` : tag ? ` — Tag: ${tag}` : "";
  const title = `Projeto Raven — Blog${titleSuffix}`;
  const description = `Últimos artigos publicados no blog.${titleSuffix ? ` (${titleSuffix.replace(/^ — /, "")})` : ""}`;

  try {
    const posts = await fetchPosts({ category: category || undefined, tag: tag || undefined });
    const feedLink = `${site}/api/blog/rss${url.search ? url.search : ""}`;
    const nowIso = new Date().toISOString();

    if (format === "atom") {
      const atom = buildAtomXml({
        title,
        link: feedLink,
        updated: nowIso,
        entries: posts.map((p) => {
          const link = `${site}/blog/${encodeURIComponent(p.slug)}`;
          const updated = p.updated_at || p.published_at || p.created_at || nowIso;
          return {
            title: p.title,
            link,
            id: link,
            updated,
            summary: p.excerpt ? cdataSafe(p.excerpt) : undefined,
          };
        }),
      });
      return new NextResponse(atom, {
        status: 200,
        headers: {
          "Content-Type": "application/atom+xml; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    const rss = buildRssXml({
      title,
      description,
      link: `${site}/blog`,
      items: posts.map((p) => {
        const link = `${site}/blog/${encodeURIComponent(p.slug)}`;
        const pubDate = toRfc822(p.published_at || p.created_at || null);
        const descriptionHtml = p.excerpt ? `<p>${cdataSafe(p.excerpt)}</p>` : "";
        return {
          title: p.title,
          link,
          guid: link,
          pubDate,
          description: descriptionHtml,
        };
      }),
    });

    return new NextResponse(rss, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    try {
      const base = (process.env.INTERNAL_API_BASE_URL || process.env.API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
      const res = await fetch(`${base}/api/v1/blog/rss/`, { cache: "no-store" });
      const xml = await res.text();
      return new NextResponse(xml, {
        status: res.status,
        headers: {
          "Content-Type": "application/rss+xml; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    } catch {
      return new NextResponse("Feed unavailable", { status: 502 });
    }
  }
}
