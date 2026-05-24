"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

export function ForumHeaderActions({ newTopicHref }: { newTopicHref: string }) {
  const { user, isLoading } = useAuth();
  const isLoggedIn = Boolean(user) && !isLoading;

  if (!isLoggedIn) return null;

  return (
    <Link href={newTopicHref} className="rv-btn rv-btn-primary text-xs px-8 h-11 gap-2">
      <span>+</span> Novo Tópico
    </Link>
  );
}
