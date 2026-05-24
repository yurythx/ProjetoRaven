"use client";

import React, { useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import { Bold, Code, Italic, List, ListOrdered, Quote, Redo, Underline as UnderlineIcon, Undo } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ToolbarButtonProps = {
  onClick: () => void;
  isActive?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  disabled?: boolean;
};

function ToolbarButton({ onClick, isActive, icon: Icon, tooltip, disabled = false }: ToolbarButtonProps) {
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
  );
}

export function ForumRichEditor({
  content,
  onChange,
  placeholder,
  className,
  disabled,
}: {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Escreva sua mensagem…",
        emptyEditorClass:
          "is-editor-empty before:text-muted-foreground before:content-[attr(data-placeholder)] before:float-left before:h-0 before:pointer-events-none",
      }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    extensions,
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editable: !disabled,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        class:
          "prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[160px] px-4 py-4 scroll-smooth selection:bg-primary/20",
      },
    },
    immediatelyRender: false,
  });

  if (!editor) return null;

  const isDisabled = Boolean(disabled);

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className={[
          "flex flex-col overflow-hidden rounded-xl border border-foreground/15 bg-background shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20",
          isDisabled ? "opacity-60" : "",
          className ?? "",
        ].join(" ")}
      >
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-muted/20 p-1.5 backdrop-blur-sm">
          <ToolbarButton
            icon={Bold}
            tooltip="Negrito"
            isActive={editor.isActive("bold")}
            disabled={isDisabled}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            icon={Italic}
            tooltip="Itálico"
            isActive={editor.isActive("italic")}
            disabled={isDisabled}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            icon={UnderlineIcon}
            tooltip="Sublinhado"
            isActive={editor.isActive("underline")}
            disabled={isDisabled}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            icon={Code}
            tooltip="Código"
            isActive={editor.isActive("code")}
            disabled={isDisabled}
            onClick={() => editor.chain().focus().toggleCode().run()}
          />

          <Separator orientation="vertical" className="mx-1 h-6 bg-border/60" />

          <ToolbarButton
            icon={List}
            tooltip="Lista com marcadores"
            isActive={editor.isActive("bulletList")}
            disabled={isDisabled}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            icon={ListOrdered}
            tooltip="Lista numerada"
            isActive={editor.isActive("orderedList")}
            disabled={isDisabled}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            icon={Quote}
            tooltip="Citação"
            isActive={editor.isActive("blockquote")}
            disabled={isDisabled}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />

          <Separator orientation="vertical" className="mx-1 h-6 bg-border/60" />

          <ToolbarButton
            icon={Undo}
            tooltip="Desfazer"
            disabled={isDisabled || !editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolbarButton
            icon={Redo}
            tooltip="Refazer"
            disabled={isDisabled || !editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </div>

        <EditorContent editor={editor} />
      </div>
    </TooltipProvider>
  );
}
