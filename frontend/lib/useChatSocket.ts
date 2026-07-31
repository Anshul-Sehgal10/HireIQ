"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

// ---------------------------------------------------------------------------
// URL helper — reuses the same origin/base logic as apiUrl(), just swapped
// to ws(s):// so dev/prod both resolve correctly without duplicating config.
// ---------------------------------------------------------------------------

export function wsUrl(path: string): string {
  const base = getApiBaseUrl(); // e.g. http://localhost:8000/api/v1
  const wsBase = base.replace(/^http/, "ws"); // http->ws, https->wss
  return `${wsBase}${path.startsWith("/") ? path : `/${path}`}`;
}

// ---------------------------------------------------------------------------
// Core socket hook
// ---------------------------------------------------------------------------

export interface TypingPayload {
  user_id: string;
  user_name: string;
  is_typing: boolean;
}

export interface OnlineUser {
  user_id: string;
  user_name: string;
  role: string;
}

export interface ChatSocketHandlers<TMessage = any> {
  onMessage?: (data: TMessage) => void;
  onActivity?: (message: string) => void;
  onPresence?: (onlineUsers: OnlineUser[]) => void;
  onTyping?: (payload: TypingPayload) => void;
  onError?: (detail: string) => void;
}

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

/**
 * Generic WS chat connection: connects on mount (and whenever `path`
 * changes), reconnects with exponential backoff on unexpected drops (the
 * backend connection manager is plain accept/reject per-connection with no
 * server-side reconnect logic — this is the client-side half of that), and
 * dispatches incoming frames to typed handlers by `type`.
 *
 * Pass `path = null` to stay disconnected (e.g. before an id param resolves).
 */
export function useChatSocket<TMessage = any>(
  path: string | null,
  handlers: ChatSocketHandlers<TMessage>,
) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (!path || unmountedRef.current) return;

    const socket = new WebSocket(wsUrl(path));
    wsRef.current = socket;

    socket.onopen = () => {
      attemptRef.current = 0;
      setConnected(true);
    };

    socket.onmessage = (event) => {
      let frame: any;
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }
      const h = handlersRef.current;
      switch (frame.type) {
        case "message":
          h.onMessage?.(frame.data);
          break;
        case "activity":
          h.onActivity?.(frame.message);
          break;
        case "presence":
          h.onPresence?.(frame.online_users ?? []);
          break;
        case "typing":
          h.onTyping?.({ user_id: frame.user_id, user_name: frame.user_name, is_typing: frame.is_typing });
          break;
        case "error":
          h.onError?.(frame.detail ?? "Unknown error");
          break;
      }
    };

    socket.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (unmountedRef.current) return;
      const delay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** attemptRef.current);
      attemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [path]);

  useEffect(() => {
    if (!path) return;
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const send = useCallback((frame: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(frame));
    }
  }, []);

  return { connected, send };
}

// ---------------------------------------------------------------------------
// Typing broadcast — debounces typing_start/typing_stop on the sender side.
// ---------------------------------------------------------------------------

export function useTypingBroadcast(send: (frame: Record<string, unknown>) => void, idleMs = 2000) {
  const typingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notifyTyping = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = true;
      send({ type: "typing_start" });
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      typingRef.current = false;
      send({ type: "typing_stop" });
    }, idleMs);
  }, [send, idleMs]);

  const stopTyping = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (typingRef.current) {
      typingRef.current = false;
      send({ type: "typing_stop" });
    }
  }, [send]);

  useEffect(() => () => stopTyping(), [stopTyping]);

  return { notifyTyping, stopTyping };
}

// ---------------------------------------------------------------------------
// Typing receiver — tracks who else is currently typing, with a safety
// auto-expire in case a typing_stop frame is ever missed (dropped packet,
// tab closed uncleanly) so an indicator never gets stuck on forever.
// ---------------------------------------------------------------------------

const TYPING_EXPIRE_MS = 4000;

export function useTypingUsers(selfId?: string) {
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleTyping = useCallback(
    (payload: TypingPayload) => {
      if (payload.user_id === selfId) return;
      if (timers.current[payload.user_id]) clearTimeout(timers.current[payload.user_id]);

      if (payload.is_typing) {
        setTypingUsers((prev) => ({ ...prev, [payload.user_id]: payload.user_name }));
        timers.current[payload.user_id] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[payload.user_id];
            return next;
          });
        }, TYPING_EXPIRE_MS);
      } else {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[payload.user_id];
          return next;
        });
      }
    },
    [selfId],
  );

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    [],
  );

  return { typingUsers, handleTyping };
}