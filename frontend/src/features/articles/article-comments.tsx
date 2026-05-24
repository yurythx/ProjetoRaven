"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { MessageSquare, Trash2, Send, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/rv-confirm-dialog"
import { RvSheet } from "@/components/rv-sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"

interface Comment {
    id: string
    content: string
    author_name: string
    created_at: string
    is_approved: boolean
    is_public?: boolean
}

interface ArticleCommentsProps {
    articleId: string
}

export function ArticleComments({ articleId }: ArticleCommentsProps) {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const [isOpen, setIsOpen] = React.useState(false)
    const [content, setContent] = React.useState("")
    const [commentToDelete, setCommentToDelete] = React.useState<Comment | null>(null)
    const { user } = useAuth()

    const canManageComments = Boolean(
        (user as { is_blog_editor?: boolean; is_staff?: boolean; is_superuser?: boolean } | null)?.is_blog_editor ||
        (user as { is_blog_editor?: boolean; is_staff?: boolean; is_superuser?: boolean } | null)?.is_staff ||
        (user as { is_blog_editor?: boolean; is_staff?: boolean; is_superuser?: boolean } | null)?.is_superuser
    )

    const { data: comments, isLoading } = useQuery({
        queryKey: ['article-comments', articleId],
        queryFn: async () => {
            const res = await fetch(`/api/blog-admin/comments/?article=${articleId}`)
            if (!res.ok) throw new Error(`Erro ${res.status}`)
            const data = await res.json() as Comment[] | { results: Comment[] }
            return Array.isArray(data) ? data : (data.results || [])
        },
        enabled: isOpen
    })

    const createMutation = useMutation({
        mutationFn: async (content: string) => {
            const res = await fetch('/api/blog-admin/comments/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article: articleId, content }),
            })
            if (!res.ok) throw new Error(`Erro ${res.status}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['article-comments', articleId] })
            setContent("")
            toast({ title: "Comentário adicionado" })
        },
        onError: () => {
            toast({ title: "Erro ao adicionar comentário", variant: "destructive" })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/blog-admin/comments/${id}/`, { method: 'DELETE' })
            if (!res.ok) throw new Error(`Erro ${res.status}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['article-comments', articleId] })
            toast({ title: "Comentário removido" })
        },
        onError: () => {
            toast({ title: "Erro ao remover", variant: "destructive" })
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim()) return
        createMutation.mutate(content)
    }

    return (
        <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                Comentários
            </Button>

            <RvSheet
                open={isOpen}
                onClose={() => setIsOpen(false)}
                title="Comentários do Post"
                description="Gerencie os comentários e interações deste post."
            >
                <div className="min-h-0 flex flex-col">
                    <div className="mb-4">
                        {/* Bug 10: formulário visível apenas para quem tem permissão article_manage */}
                        {canManageComments ? (
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <Textarea
                                    placeholder="Adicione um comentário..."
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="resize-none min-h-[80px]"
                                />
                                <Button type="submit" size="icon" className="h-[80px] w-[80px]" disabled={createMutation.isPending} aria-label="Enviar comentário">
                                    <Send className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </form>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg border border-dashed">
                                <Lock className="h-4 w-4 shrink-0" />
                                <span>Você não tem permissão para adicionar comentários.</span>
                            </div>
                        )}
                    </div>

                    <ScrollArea className="flex-1 pr-4 -mr-4">
                        {isLoading ? (
                            <div className="text-center py-4 text-muted-foreground" role="status" aria-live="polite">Carregando...</div>
                        ) : comments?.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">Nenhum comentário ainda.</div>
                        ) : (
                            <div className="space-y-4 pb-4">
                                {comments?.map((comment: Comment) => (
                                    <div key={comment.id} className="flex gap-4 p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback>{comment.author_name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm">{comment.author_name || 'Anônimo'}</span>
                                                    {comment.is_public && (
                                                        <Badge variant="outline" className="text-[10px]">
                                                            Comentário público
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(new Date(comment.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                    onClick={() => setCommentToDelete(comment)}
                                                    aria-label="Excluir comentário"
                                                >
                                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                </Button>
                                            </div>
                                            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comment.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </RvSheet>

            <ConfirmDialog
                open={!!commentToDelete}
                onClose={() => setCommentToDelete(null)}
                title="Remover comentário"
                description="Esta ação não pode ser desfeita. O comentário será removido permanentemente."
                confirmLabel="Remover"
                onConfirm={() => {
                    if (!commentToDelete) return
                    deleteMutation.mutate(commentToDelete.id)
                    setCommentToDelete(null)
                }}
                isPending={deleteMutation.isPending}
                variant="danger"
            />
        </>
    )
}
