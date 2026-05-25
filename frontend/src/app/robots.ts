import type { MetadataRoute } from "next";

import { getSiteBaseUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/me/", "/api/", "/auth/", "/verify-email/", "/reset-password/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
