import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Projeto Raven",
    short_name: "Raven",
    description: "Blog, fórum e comunidade.",
    start_url: "/",
    display: "standalone",
    background_color: "#060606",
    theme_color: "#092e20",
    orientation: "portrait-primary",
    scope: "/",
    lang: "pt-BR",
    categories: ["news", "social"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Blog",
        short_name: "Blog",
        url: "/blog",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Fórum",
        short_name: "Fórum",
        url: "/forum",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
