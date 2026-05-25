'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { fixImageUrl } from '@/lib/utils';

export interface AuthorInfo {
    id?: string | number;
    username: string;
    full_name: string;
    avatar_url?: string | null;
    bio?: string | null;
}

interface AboutAuthorProps {
    author: AuthorInfo | null | undefined;
}

export function AboutAuthor({ author }: AboutAuthorProps) {
    if (!author) return null;

    const initials = (author.full_name || author.username || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .join('');

    const bio = (author.bio || '').trim();

    return (
        <section className="mt-16 pt-10 border-t border-border/50" aria-label="Sobre o autor">
            <div className="rounded-3xl border border-primary/10 bg-background/95 backdrop-blur p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <Avatar className="h-16 w-16 ring-2 ring-primary/10">
                        <AvatarImage src={fixImageUrl(author.avatar_url) || undefined} alt={author.full_name || author.username} />
                        <AvatarFallback className="text-sm font-bold">{initials || 'AU'}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold leading-tight truncate">Sobre o Autor</h2>
                            <Link
                                href={`/u/${author.username}`}
                                className="text-base font-semibold text-foreground hover:text-primary transition-colors truncate"
                            >
                                {author.full_name || author.username}
                            </Link>
                        </div>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {bio ? bio : 'Este autor ainda não adicionou uma bio.'}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
