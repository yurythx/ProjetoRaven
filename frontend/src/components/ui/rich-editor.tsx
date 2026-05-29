"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import CharacterCount from '@tiptap/extension-character-count'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'

import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    Heading1,
    Heading2,
    Heading3,
    Quote,
    Undo,
    Redo,
    ImageIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Code,
    Table as TableIcon,
    Plus,
    Type,
    FileText,
    Save,
    Trash2
} from 'lucide-react'
import { MediaDialog } from "@/features/media/media-dialog"
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cleanPastedHtml, parsePlainTextToHtml } from "@/lib/editor-paste"
import { notify } from "@/lib/notifications"

const lowlight = createLowlight(common)

interface RichEditorProps {
    content: string
    onChange: (content: string) => void
    placeholder?: string
    className?: string
    id?: string // Identificador único para auto-save
}

type ToolbarButtonProps = {
    onClick: () => void
    isActive?: boolean
    icon: React.ComponentType<{ className?: string }>
    tooltip: string
    disabled?: boolean
}

function ToolbarButton({
    onClick,
    isActive,
    icon: Icon,
    tooltip,
    disabled = false
}: ToolbarButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Toggle
                    size="sm"
                    pressed={isActive}
                    onPressedChange={onClick}
                    disabled={disabled}
                    className="h-8 w-8 p-0"
                >
                    <Icon className="h-4 w-4" />
                </Toggle>
            </TooltipTrigger>
            <TooltipContent>
                <p>{tooltip}</p>
            </TooltipContent>
        </Tooltip>
    )
}

export function RichEditor({ content, onChange, placeholder, className, id }: RichEditorProps) {
    const editorRef = useRef<Editor | null>(null)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)

    const extensions = useMemo(() => [
        StarterKit.configure({
            heading: {
                levels: [1, 2, 3],
            },
            codeBlock: false, // Desabilitar o padrão para usar lowlight
        }),
        Image.configure({
            HTMLAttributes: {
                class: 'rounded-lg border border-border shadow-sm max-w-full h-auto my-4',
            },
        }),
        TextAlign.configure({
            types: ['heading', 'paragraph'],
        }),
        Placeholder.configure({
            placeholder: placeholder || 'Comece a escrever a magia...',
            emptyEditorClass: 'is-editor-empty before:text-muted-foreground before:content-[attr(data-placeholder)] before:float-left before:h-0 before:pointer-events-none',
        }),
        TextStyle,
        Color,
        Table.configure({
            resizable: true,
            HTMLAttributes: {
                class: 'rv-editor-table border-collapse table-fixed w-full my-4',
            },
        }),
        TableRow,
        TableHeader,
        TableCell,
        CharacterCount,
        CodeBlockLowlight.configure({
            lowlight,
            HTMLAttributes: {
                class: 'rounded-md bg-muted p-4 font-mono text-sm my-4 overflow-x-auto',
            },
        }),
    ], [placeholder])

    const editor = useEditor({
        extensions,
        content: content,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML()
            onChange(html)

            // Auto-save logic
            if (id) {
                localStorage.setItem(`rv-editor-draft-${id}`, html)
                setLastSaved(new Date())
            }
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-6 py-8 scroll-smooth selection:bg-primary/20',
            },
            handlePaste(_view, event) {
                const text = event.clipboardData?.getData('text/plain')
                const html = event.clipboardData?.getData('text/html')
                if (html?.trim()) return false
                if (!text?.trim()) return false
                const ed = editorRef.current
                if (!ed) return false
                ed.commands.insertContent(parsePlainTextToHtml(text), {
                    parseOptions: { preserveWhitespace: false },
                })
                return true
            },
            transformPastedHTML(html) {
                return cleanPastedHtml(html)
            },
            handleDrop: (view, event, _slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
                    const file = event.dataTransfer.files[0]
                    const isImage = file.type.startsWith('image/')
                    if (!isImage) return false

                    const formData = new FormData()
                    formData.append('image', file)

                    // Mostrar estado de upload
                    notify.success("Enviando imagem...")

                    fetch('/api/media/files', {
                        method: 'POST',
                        body: formData
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.url) {
                            const { schema } = view.state
                            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
                            const node = schema.nodes.image.create({ src: data.url })
                            const transaction = view.state.tr.insert(coordinates?.pos ?? view.state.selection.from, node)
                            view.dispatch(transaction)
                            notify.success("Imagem inserida")
                        } else {
                            notify.error("Erro no upload", data.error || "Não foi possível enviar a imagem.")
                        }
                    })
                    .catch(() => notify.error("Erro de conexão", "Falha ao enviar imagem."))

                    return true
                }
                return false
            },
        },
        immediatelyRender: false,
    })

    useEffect(() => {
        editorRef.current = editor ?? null

        // Recuperar rascunho se existir
        if (editor && id && !content) {
            const saved = localStorage.getItem(`rv-editor-draft-${id}`)
            if (saved && saved !== '<p></p>') {
                editor.commands.setContent(saved)
                notify.success("Rascunho recuperado", "Continuando de onde você parou.")
            }
        }
    }, [editor, id, content])

    if (!editor) {
        return null
    }

    const wordCount = editor.storage.characterCount.words()
    const charCount = editor.storage.characterCount.characters()

    return (
        <TooltipProvider delayDuration={400}>
            <div className={`flex flex-col border rounded-xl bg-background shadow-sm overflow-hidden transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 ${className}`}>
                
                <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-muted/20 backdrop-blur-sm sticky top-0 z-10">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-8 px-2 flex items-center gap-1.5 text-xs font-medium hover:bg-muted rounded transition-colors">
                                <Type className="h-4 w-4" />
                                Estilos
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
                                <FileText className="h-4 w-4 mr-2" /> Parágrafo
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                                <Heading1 className="h-4 w-4 mr-2" /> Título 1
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                                <Heading2 className="h-4 w-4 mr-2" /> Título 2
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                                <Heading3 className="h-4 w-4 mr-2" /> Título 3
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Separator orientation="vertical" className="h-6 mx-1 bg-border/60" />

                    <ToolbarButton
                        icon={Bold}
                        tooltip="Negrito"
                        isActive={editor.isActive('bold')}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                    />
                    <ToolbarButton
                        icon={Italic}
                        tooltip="Itálico"
                        isActive={editor.isActive('italic')}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                    />
                    <ToolbarButton
                        icon={UnderlineIcon}
                        tooltip="Sublinhado"
                        isActive={editor.isActive('underline')}
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                    />
                    <ToolbarButton
                        icon={Code}
                        tooltip="Código Inline"
                        isActive={editor.isActive('code')}
                        onClick={() => editor.chain().focus().toggleCode().run()}
                    />

                    <Separator orientation="vertical" className="h-6 mx-1 bg-border/60" />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded">
                                <TableIcon className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                                <Plus className="h-4 w-4 mr-2" /> Inserir Tabela 3x3
                            </DropdownMenuItem>
                            <Separator className="my-1" />
                            <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()} disabled={!editor.isActive('table')}>
                                Adicionar Coluna (Antes)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.isActive('table')}>
                                Adicionar Coluna (Depois)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()} disabled={!editor.isActive('table')}>
                                Deletar Coluna
                            </DropdownMenuItem>
                            <Separator className="my-1" />
                            <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()} disabled={!editor.isActive('table')}>
                                Adicionar Linha (Antes)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.isActive('table')}>
                                Adicionar Linha (Depois)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()} disabled={!editor.isActive('table')}>
                                Deletar Linha
                            </DropdownMenuItem>
                            <Separator className="my-1" />
                            <DropdownMenuItem onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.isActive('table')} className="text-red-500">
                                <Trash2 className="h-4 w-4 mr-2" /> Deletar Tabela
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Separator orientation="vertical" className="h-6 mx-1 bg-border/60" />

                    <ToolbarButton
                        icon={AlignLeft}
                        tooltip="Esquerda"
                        isActive={editor.isActive({ textAlign: 'left' })}
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    />
                    <ToolbarButton
                        icon={AlignCenter}
                        tooltip="Centro"
                        isActive={editor.isActive({ textAlign: 'center' })}
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    />
                    <ToolbarButton
                        icon={AlignRight}
                        tooltip="Direita"
                        isActive={editor.isActive({ textAlign: 'right' })}
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    />

                    <Separator orientation="vertical" className="h-6 mx-1 bg-border/60" />

                    <ToolbarButton
                        icon={List}
                        tooltip="Lista"
                        isActive={editor.isActive('bulletList')}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                    />
                    <ToolbarButton
                        icon={Quote}
                        tooltip="Citação"
                        isActive={editor.isActive('blockquote')}
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    />

                    <Separator orientation="vertical" className="h-6 mx-1 bg-border/60" />

                    <MediaDialog
                        onSelect={(url) => {
                            editor.chain().focus().setImage({ src: url }).run()
                        }}
                        trigger={
                            <div className="contents">
                                <ToolbarButton
                                    icon={ImageIcon}
                                    tooltip="Inserir Mídia"
                                    onClick={() => { }}
                                />
                            </div>
                        }
                    />

                    <div className="ml-auto flex items-center gap-2">
                        {lastSaved && (
                            <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground animate-in fade-in slide-in-from-right-1">
                                <Save className="h-3 w-3" />
                                Salvo às {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        <Separator orientation="vertical" className="h-6 bg-border/60" />
                        <ToolbarButton
                            icon={Undo}
                            tooltip="Desfazer"
                            disabled={!editor.can().undo()}
                            onClick={() => editor.chain().focus().undo().run()}
                        />
                        <ToolbarButton
                            icon={Redo}
                            tooltip="Refazer"
                            disabled={!editor.can().redo()}
                            onClick={() => editor.chain().focus().redo().run()}
                        />
                    </div>
                </div>

                <div className="flex-1 relative overflow-auto p-4 bg-gradient-to-b from-transparent to-muted/5 min-h-[450px]">
                    <EditorContent editor={editor} />
                </div>

                <div className="px-4 py-2 border-t bg-muted/10 flex items-center justify-between text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                    <div className="flex gap-4">
                        <span>{wordCount} palavras</span>
                        <span>{charCount} caracteres</span>
                    </div>
                    {editor.isActive('table') && (
                        <span className="text-primary animate-pulse">Modo Tabela Ativo</span>
                    )}
                </div>
            </div>
        </TooltipProvider>
    )
}
