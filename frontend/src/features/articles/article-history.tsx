"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { RotateCcw, Clock, User, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { RvSheet } from "@/components/rv-sheet"
import { ConfirmDialog } from "@/components/rv-confirm-dialog"

interface Version {
    id: number
    created_at: string
    user: string
    comment: string
}

interface ArticleHistoryProps {
    articleSlug: string
}

export function ArticleHistory({ articleSlug }: ArticleHistoryProps) {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const [selectedVersion, setSelectedVersion] = React.useState<Version | null>(null)
    const [isOpen, setIsOpen] = React.useState(false)

    const { data: versions, isLoading } = useQuery({
        queryKey: ['article-history', articleSlug],
        queryFn: async () => {
            const res = await fetch(`/api/blog-admin/articles/${encodeURIComponent(articleSlug)}/history/`)
            if (!res.ok) throw new Error(`Erro ${res.status}`)
            return await res.json() as Version[]
        },
        enabled: isOpen
    })

    const revertMutation = useMutation({
        mutationFn: async (versionId: number) => {
            const res = await fetch(`/api/blog-admin/articles/${encodeURIComponent(articleSlug)}/revert/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version_id: versionId }),
            })
            if (!res.ok) throw new Error(`Erro ${res.status}`)
        },
        onSuccess: () => {
            toast({
                title: "Versão restaurada",
                description: "O artigo foi revertido com sucesso.",
            })
            // I4: usa queryKey sem parâmetros extras para invalidar todas as variantes da query de artigos
            queryClient.invalidateQueries({ queryKey: ['articles'] })
            queryClient.invalidateQueries({ queryKey: ['article-history', articleSlug] })
            setSelectedVersion(null)
            setIsOpen(false)
        },
        onError: () => {
            toast({
                title: "Erro",
                description: "Não foi possível restaurar a versão.",
                variant: "destructive"
            })
        }
    })

    return (
        <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
                <Clock className="h-4 w-4" aria-hidden="true" />
                Histórico
            </Button>

            <RvSheet
                open={isOpen}
                onClose={() => setIsOpen(false)}
                title="Histórico de Versões"
                description="Visualize e restaure versões anteriores deste artigo."
            >
                <ScrollArea className="h-full px-4 py-4">
                    {isLoading ? (
                        <div className="text-center py-4 text-muted-foreground" role="status" aria-live="polite" aria-label="Carregando histórico do artigo">Carregando...</div>
                    ) : versions?.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">Sem histórico disponível.</div>
                    ) : (
                        <div className="space-y-4">
                            {versions?.map((version) => (
                                <div
                                    key={version.id}
                                    className="flex flex-col gap-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Clock className="h-3 w-3" aria-hidden="true" />
                                            <span>
                                                {format(new Date(version.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:text-primary"
                                            onClick={() => setSelectedVersion(version)}
                                            title="Restaurar esta versão"
                                            aria-label="Restaurar esta versão"
                                        >
                                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <User className="h-3 w-3" aria-hidden="true" />
                                        <span>{version.user}</span>
                                    </div>

                                    <div className="flex items-start gap-2 text-sm bg-muted p-2 rounded text-muted-foreground">
                                        <MessageCircle className="h-3 w-3 mt-0.5 shrink-0" aria-hidden="true" />
                                        <span>{version.comment || "Sem comentário"}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </RvSheet>

            <ConfirmDialog
                open={!!selectedVersion}
                onClose={() => setSelectedVersion(null)}
                title="Restaurar Versão?"
                description={
                    selectedVersion
                        ? `Isso irá reverter o artigo para a versão de ${format(new Date(selectedVersion.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}. Uma nova versão será criada com o estado atual antes da reversão.`
                        : undefined
                }
                confirmLabel={revertMutation.isPending ? "Restaurando..." : "Sim, restaurar"}
                onConfirm={() => selectedVersion && revertMutation.mutate(selectedVersion.id)}
                isPending={revertMutation.isPending}
            />
        </>
    )
}
