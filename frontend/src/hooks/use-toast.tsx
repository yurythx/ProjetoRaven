"use client";

import React from "react";

type ToastVariant = "default" | "destructive";

type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: ToastVariant;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ToastInput = Omit<ToastItem, "id">;
type ToastCallOptions = { description?: string };
type ListenerAction = { type: "add"; toast: ToastItem } | { type: "dismiss"; id?: string };

const ToastContext = React.createContext<{
  toasts: ToastItem[];
  toast: (t: ToastInput) => void;
  dismiss: (id?: string) => void;
} | null>(null);

const listeners = new Set<(action: ListenerAction) => void>();

function randomId() {
  return Math.random().toString(36).slice(2);
}

function emit(action: ListenerAction) {
  for (const l of listeners) l(action);
}

function push(input: ToastInput): string {
  const id = randomId();
  const toast: ToastItem = {
    ...input,
    id,
    open: true,
    onOpenChange: (open) => {
      if (!open) emit({ type: "dismiss", id });
    },
  };
  emit({ type: "add", toast });
  return id;
}

function dismissInternal(id?: string) {
  emit({ type: "dismiss", id });
}

type ToastApi = ((input: ToastInput) => string) & {
  success: (title: string, opts?: ToastCallOptions) => string;
  warning: (title: string, opts?: ToastCallOptions) => string;
  error: (title: string, opts?: ToastCallOptions) => string;
  dismiss: (id?: string) => void;
};

export const toast: ToastApi = Object.assign(
  (input: ToastInput) => push(input),
  {
    success: (title: string, opts?: ToastCallOptions) => push({ title, description: opts?.description }),
    warning: (title: string, opts?: ToastCallOptions) => push({ title, description: opts?.description }),
    error: (title: string, opts?: ToastCallOptions) =>
      push({ title, description: opts?.description, variant: "destructive" }),
    dismiss: (id?: string) => dismissInternal(id),
  }
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const listener = (action: ListenerAction) => {
      if (action.type === "add") {
        setToasts((prev) => [...prev, action.toast]);
        return;
      }
      setToasts((prev) => (action.id ? prev.filter((t) => t.id !== action.id) : []));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const dismiss = React.useCallback((id?: string) => dismissInternal(id), []);
  const pushToast = React.useCallback((t: ToastInput) => {
    push(t);
  }, []);

  return <ToastContext.Provider value={{ toasts, toast: pushToast, dismiss }}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return { toasts: [], toast: () => {}, dismiss: () => {} };
  }
  return ctx;
}
