"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getApiBaseUrl } from "@/lib/env";

export type ForumReplyEvent = {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
  is_solution: boolean;
};

export type ForumReactionEvent = {
  id: string;
  type: string;
  count: number;
};

export type ForumTopicStatusEvent = {
  status: string;
  is_pinned: boolean;
  is_locked: boolean;
};

export type ForumEvent = 
  | { type: "new_reply"; reply: ForumReplyEvent }
  | { type: "reaction_update"; reaction: ForumReactionEvent }
  | { type: "topic_status_update"; data: ForumTopicStatusEvent };

function toWsProtocol(proto: string): string {
  return proto === "https:" ? "wss:" : proto === "http:" ? "ws:" : proto;
}

function buildWsUrl(topicSlug: string): string {
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
  return `${protocol}//${host}/ws/forum/topic/${topicSlug}/`;
}

export type ConnectionStatus = "connecting" | "open" | "closed" | "error";

/**
 * Subscribes to real-time events for a forum topic.
 * Features: Exponential backoff, multiple event types, connection status.
 */
export function useTopicSocket(
  topicSlug: string | null | undefined,
  onEvent: (event: ForumEvent) => void
): { status: ConnectionStatus } {
  const [status, setStatus] = useState<ConnectionStatus>("closed");
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000; // 30s
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!topicSlug) return;
    
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus("connecting");
    const ws = new WebSocket(buildWsUrl(topicSlug));
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("open");
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as ForumEvent;
        if (data?.type) {
          onEventRef.current(data);
        }
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = (e) => {
      wsRef.current = null;
      
      // Abnormal closure or network issues
      if (e.code !== 1000 && e.code !== 1001) {
        setStatus("error");
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      } else {
        setStatus("closed");
      }
    };

    ws.onerror = () => {};
  }, [topicSlug]);

  useEffect(() => {
    if (!topicSlug) return;
    
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        // Normal closure code 1000
        wsRef.current.close(1000);
      }
    };
  }, [topicSlug, connect]);

  return { status };
}
