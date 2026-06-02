"use client";

import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ThemeToggleProps {
  /** true = botão está sobre fundo escuro (branco); false = sobre fundo claro (preto) */
  onDark?: boolean;
}

export function ThemeToggle({ onDark = true }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const icon =
    !mounted ? (
      <Monitor className="h-4 w-4" aria-hidden="true" />
    ) : resolvedTheme === "light" ? (
      <Sun className="h-4 w-4" aria-hidden="true" />
    ) : (
      <Moon className="h-4 w-4" aria-hidden="true" />
    );

  const btnClass = onDark
    ? "h-9 w-9 rounded-xl border border-[#ffffff20] bg-[#ffffff10] text-white/70 hover:text-white hover:bg-[#ffffff18] hover:border-[#ffffff35] transition-all flex items-center justify-center"
    : "h-9 w-9 rounded-xl border border-[var(--rv-border)] bg-[var(--rv-surface)] text-[var(--rv-text-primary)] hover:text-[var(--rv-black)] hover:bg-[var(--rv-surface-2)] hover:border-[var(--rv-border-hover)] transition-all flex items-center justify-center";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={btnClass} aria-label="Alternar tema">
          <span className="transition-transform duration-300 hover:rotate-12">{icon}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-40 p-1 bg-[var(--rv-surface)] border border-[var(--rv-border)] text-[var(--rv-text-primary)]"
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="flex items-center justify-between cursor-pointer gap-2"
        >
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-[var(--rv-gold)]" aria-hidden="true" />
            <span>Claro</span>
          </div>
          {theme === "light" && <Check className="h-3.5 w-3.5 text-[var(--rv-accent)]" aria-hidden="true" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="flex items-center justify-between cursor-pointer gap-2"
        >
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-[var(--rv-cyan)]" aria-hidden="true" />
            <span>Escuro</span>
          </div>
          {theme === "dark" && <Check className="h-3.5 w-3.5 text-[var(--rv-accent)]" aria-hidden="true" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="flex items-center justify-between cursor-pointer gap-2"
        >
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-[var(--rv-text-muted)]" aria-hidden="true" />
            <span>Sistema</span>
          </div>
          {theme === "system" && <Check className="h-3.5 w-3.5 text-[var(--rv-accent)]" aria-hidden="true" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
