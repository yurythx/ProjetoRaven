import type { Metadata } from "next";
import { getApiBaseUrl } from "@/lib/env";
import { PublicProfileClient } from "./public-profile-client";

type Props = { params: Promise<{ username: string }> };

async function fetchProfileMeta(username: string) {
  try {
    const base = getApiBaseUrl().replace(/\/+$/, "");
    const res = await fetch(`${base}/api/v1/accounts/public/${encodeURIComponent(username)}/`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as { display_name?: string; bio?: string; avatar?: string | null };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await fetchProfileMeta(username);

  const title = profile?.display_name
    ? `${profile.display_name} (@${username}) | RAVEN`
    : `@${username} | RAVEN`;
  const description = profile?.bio ?? `Veja o perfil público de @${username} na plataforma RAVEN.`;

  return {
    title,
    description,
    alternates: { canonical: `/u/${username}` },
    openGraph: {
      title,
      description,
      type: "profile",
      url: `/u/${username}`,
      ...(profile?.avatar ? { images: [{ url: profile.avatar }] } : {}),
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  return <PublicProfileClient username={username} />;
}
