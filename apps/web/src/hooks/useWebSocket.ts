import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface UseWebSocketOptions {
  url: string;
  onEvent: (event: string, data: any) => void;
}

export function useWebSocket({ url, onEvent }: UseWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    const socket = io(url, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    const events = [
      "lesson_started", "tutor_message", "transcript",
      "exercise_feedback", "lesson_ended", "status", "error",
    ];
    events.forEach((event) => socket.on(event, (data) => onEvent(event, data)));

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [url]);

  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit, connected };
}
