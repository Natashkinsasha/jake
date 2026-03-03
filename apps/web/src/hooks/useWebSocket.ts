import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useCallbackRef } from "./useCallbackRef";

interface UseWebSocketOptions {
  url: string;
  token: string | null;
  onEvent: (event: string, data: any) => void;
}

export function useWebSocket({ url, token, onEvent }: UseWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useCallbackRef(onEvent);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socket = io(url, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => {
      console.error("WS connect error:", err.message);
      onEventRef.current("error", { message: "Connection failed" });
    });

    const events = [
      "lesson_started", "tutor_message", "transcript",
      "exercise_feedback", "lesson_ended", "status", "error",
    ];
    events.forEach((event) => socket.on(event, (data) => onEventRef.current(event, data)));

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [url, token]);

  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit, connected };
}
