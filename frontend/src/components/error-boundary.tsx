"use client";

import { Component, ReactNode } from "react";
import Link from "next/link";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; errorMessage: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center gap-6">
            <div className="rv-badge rv-badge-red inline-flex">⚠ Erro Crítico</div>
            <h1 className="rv-display text-4xl text-[var(--rv-text-primary)]">Algo deu errado</h1>
            <p className="text-[var(--rv-text-muted)] max-w-sm text-sm font-[var(--font-body)]">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rv-btn rv-btn-primary px-8 h-11 text-xs"
              >
                Recarregar
              </button>
              <Link href="/" className="rv-btn rv-btn-ghost px-8 h-11 text-xs">
                Início
              </Link>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
