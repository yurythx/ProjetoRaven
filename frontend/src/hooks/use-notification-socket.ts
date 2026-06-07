"use client";

import { useEffect, useRef, useCallback } from "react";
import { getApiBaseUrl } from "@/lib/env";

export type NotificationEvent = {
  id: string;
  verb: string;
  actor_name: string;
  message: string;
  target_url: string;
  read: boolean;
  created_at: string;
};

function toWsProtocol(proto: string): string {
  return proto === "https:" ? "wss:" : proto === "http:" ? "ws:" : proto;
}

function buildWsUrl(token: string): string {
  const wsBase = process.env.NEXT_PUBLIC_WS_BASE_URL;
  let protocol: string;
  let host: string;
  if (wsBase) {
    const parsed = new URL(wsBase);
    protocol = toWsProtocol(parsed.protocol);
    host = parsed.host;
  } else {
    const apiBase = getApiBaseUrl();
    const parsed = new URL(apiBase);
    protocol = toWsProtocol(parsed.protocol);
    host = parsed.host;
  }
  return `${protocol}//${host}/ws/notifications/?token=${encodeURIComponent(token)}`;
}

/**
 * Subscribes to real-time in-app notifications via WebSocket.
 *
 * Fetches a short-lived token from /api/auth/ws-token, connects to the
 * Django Channels NotificationConsumer, and fires `onNotification` whenever
 * a new_notification event arrives.
 *
 * Authentication failure (4003) or missing token → no connection, silent.
 * Network drop (1006) → single automatic reconnect after 3 s.
 */
export function useNotificationSocket(
  onNotification: (n: NotificationEvent) => void,
  enabled = true
): void {
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    const token = tokenRef.current;
    if (!token) return;
    if (wsRef.current) return;

    const ws = new WebSocket(buildWsUrl(token));
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type?: string;
          notification?: NotificationEvent;
        };
        if (data?.type === "new_notification" && data.notification) {
          onNotificationRef.current(data.notification);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = (e) => {
      wsRef.current = null;
      if (!enabled) return;
      const shouldRetry =
        e.code === 1006 ||
        e.code === 1011 ||
        e.code === 1013 ||
        (e.code >= 4000 && e.code !== 4003);
      if (!shouldRetry) return;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 60_000);
      reconnectAttempts.current += 1;
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        connect();
      }, delay);
    };

    ws.onerror = () => {};
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    fetch("/api/auth/ws-token")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { token?: string } | null) => {
        if (cancelled || !data?.token) return;
        tokenRef.current = data.token;
        connect();
      })
      .catch(() => null);

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, connect]);
}
