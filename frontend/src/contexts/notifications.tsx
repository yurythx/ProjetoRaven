"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { useAuth } from "@/components/auth-provider";
import {
  useNotificationSocket,
  type NotificationEvent,
} from "@/hooks/use-notification-socket";

// ── Types ──────────────────────────────────────────────────────────────────────

type State = {
  notifications: NotificationEvent[];
  unreadCount: number;
  fetched: boolean;
};

type Action =
  | { type: "SET"; payload: NotificationEvent[] }
  | { type: "PREPEND"; payload: NotificationEvent }
  | { type: "MARK_ALL_READ" }
  | { type: "MARK_READ"; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET":
      return {
        notifications: action.payload,
        unreadCount: action.payload.filter((n) => !n.read).length,
        fetched: true,
      };
    case "PREPEND": {
      const already = state.notifications.some((n) => n.id === action.payload.id);
      if (already) return state;
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: state.unreadCount + (action.payload.read ? 0 : 1),
      };
    }
    case "MARK_ALL_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      };
    case "MARK_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────────

type ContextValue = State & {
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
};

const NotificationContext = createContext<ContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, {
    notifications: [],
    unreadCount: 0,
    fetched: false,
  });

  // Initial fetch
  useEffect(() => {
    if (!user) return;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        dispatch({ type: "SET", payload: Array.isArray(data) ? (data as NotificationEvent[]) : [] });
      })
      .catch(() => dispatch({ type: "SET", payload: [] }));
  }, [user]);

  // Real-time updates
  const handleNewNotification = useCallback((n: NotificationEvent) => {
    dispatch({ type: "PREPEND", payload: n });
  }, []);

  useNotificationSocket(handleNewNotification, Boolean(user));

  const markAllRead = useCallback(async () => {
    dispatch({ type: "MARK_ALL_READ" });
    await fetch("/api/notifications", { method: "POST" }).catch(() => null);
  }, []);

  const markRead = useCallback(async (id: string) => {
    dispatch({ type: "MARK_READ", id });
    await fetch(`/api/notifications/${id}/read/`, { method: "POST" }).catch(() => null);
  }, []);

  return (
    <NotificationContext.Provider value={{ ...state, markAllRead, markRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}
