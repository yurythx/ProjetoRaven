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
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const u = new URL(url);
      // If it's a MEDIA_URL resource, always force a relative path so it goes
      // through Next.js /media/* rewrite (works across envs and avoids remotePatterns drift).
      if (u.pathname.startsWith("/media/")) return `${u.pathname}${u.search}`;
      return url;
    } catch {
      return url;
    }
  }
  // Relative paths stay as-is — Next.js rewrites handle /media/* server-side.
  return url.startsWith("/") ? url : `/${url}`;
}
