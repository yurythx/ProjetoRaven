import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function stripHtml(value: string) {
  return (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function fixImageUrl(url: string | null | undefined) {
  if (!url) return null;
  // Strip any server-internal or localhost origin so browsers get a relative
  // path that goes through the Next.js /media/* rewrite to Django.
  if (/^https?:\/\/(django|localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
    try { return new URL(url).pathname; } catch { return url; }
  }
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Relative paths stay as-is — Next.js rewrites handle /media/* server-side.
  return url.startsWith("/") ? url : `/${url}`;
}
