import { NewTopicClient } from "./new-topic-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Criar tópico | Fórum | Projeto Raven",
  robots: { index: false, follow: false },
};

export default async function NewTopicPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const category = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  return <NewTopicClient initialCategorySlug={typeof category === "string" ? category : ""} />;
}
