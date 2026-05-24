"use client";

import { useEffect, useRef } from "react";
import { getApiBaseUrl } from "@/lib/env"; // fallback for production (no NEXT_PUBLIC_WS_BASE_URL)

export type ForumReplyEvent = {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
  is_solution: boolean;
};

function buildWsUrl(topicSlug: string): string {
  const wsBase = process.env.NEXT_PUBLIC_WS_BASE_URL;
  let protocol: string;
  let host: string;
  if (wsBase) {
    const parsed = new URL(wsBase);
    protocol = parsed.protocol;
    host = parsed.host;
  } else {
    const apiBase = getApiBaseUrl();
    const parsed = new URL(apiBase);
    protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    host = parsed.host;
  }
  return `${protocol}//${host}/ws/forum/topic/${topicSlug}/`;
}

/**
 * Subscribes to real-time replies for a forum topic.
 *
 * Usage:
 *   useTopicSocket(slug, (reply) => setReplies((prev) => [...prev, reply]));
 *
 * The WebSocket is silent on error — the UI remains functional via normal fetching.
 * Automatically reconnects once if the connection drops unexpectedly.
 */
export function useTopicSocket(
  topicSlug: string | null | undefined,
  onNewReply: (reply: ForumReplyEvent) => void
): void {
  const onNewReplyRef = useRef(onNewReply);
  onNewReplyRef.current = onNewReply;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!topicSlug) return;

    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(buildWsUrl(topicSlug!));
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data?.type === "new_reply" && data.reply) {
            onNewReplyRef.current(data.reply as ForumReplyEvent);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = (e) => {
        wsRef.current = null;
        // Reconnect once on abnormal closure (1006 = network drop)
        if (!cancelled && e.code === 1006) {
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [topicSlug]);
}
