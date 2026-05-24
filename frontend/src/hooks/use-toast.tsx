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

const ToastContext = React.createContext<{
  toasts: ToastItem[];
  toast: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id?: string) => void;
} | null>(null);

function randomId() {
  return Math.random().toString(36).slice(2);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id?: string) => {
    setToasts((prev) => (id ? prev.filter((t) => t.id !== id) : []));
  }, []);

  const toast = React.useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = randomId();
      setToasts((prev) => [
        ...prev,
        {
          ...t,
          id,
          open: true,
          onOpenChange: (open) => {
            if (!open) dismiss(id);
          },
        },
      ]);
    },
    [dismiss]
  );

  return <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    return { toasts: [], toast: () => {}, dismiss: () => {} };
  }
  return ctx;
}

