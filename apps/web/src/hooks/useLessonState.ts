import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useTutorTts } from "./useTutorTts";
import { handleLessonEvent, type LessonEventData } from "./lesson/handleLessonEvent";
import { WS_URL } from "@/lib/config";
import { createLogger } from "./logger";
import type { ChatMessage, LessonStatus } from "@/types";

const log = createLogger("Lesson");

interface LessonState {
  lessonId: string | null;
  messages: ChatMessage[];
  status: LessonStatus;
  lessonEnded: boolean;
  error: string | null;
}

export function useLessonState(token?: string | null) {
  const [state, setState] = useState<LessonState>({
    lessonId: null,
    messages: [],
    status: "connecting",
    lessonEnded: false,
    error: null,
  });

  const userSpeakingRef = useRef(false);
  const pendingTurnsRef = useRef(0);
  const activeMessageIdRef = useRef<string | null>(null);
  const voiceIdRef = useRef<string | null>(null);
  const speechSpeedRef = useRef<number>(1.0);
  const streamStartedRef = useRef(false);

  const streamTextRef = useRef<string>("");
  const pendingRevealTextRef = useRef<string | null>(null);
  const revealedLenRef = useRef(0);

  const tts = useTutorTts({
    onAllDone: () => {
      // Reveal any remaining text
      const text = pendingRevealTextRef.current;
      if (text && revealedLenRef.current < text.length) {
        revealedLenRef.current = text.length;
        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            messages[messages.length - 1] = { ...last, text };
          }
          return { ...prev, messages, status: "idle" };
        });
      } else {
        setState((prev) => prev.status === "speaking" ? { ...prev, status: "idle" } : prev);
      }
      pendingRevealTextRef.current = null;
      revealedLenRef.current = 0;
    },
    onPlaybackProgress: (playedSec, totalDecodedSec, allReceived) => {
      const fullText = pendingRevealTextRef.current;
      if (!fullText) return;

      let targetLen: number;
      if (allReceived && totalDecodedSec > 0) {
        // Exact sync — we know the total audio duration
        targetLen = Math.floor(fullText.length * (playedSec / totalDecodedSec));
      } else {
        // Estimate ~15 chars/sec adjusted for speech speed
        const rate = 15 * speechSpeedRef.current;
        targetLen = Math.floor(playedSec * rate);
      }

      // Never go backward, never exceed text length
      targetLen = Math.max(revealedLenRef.current, Math.min(targetLen, fullText.length));
      if (targetLen <= revealedLenRef.current) return;

      // Snap forward to word boundary
      while (targetLen < fullText.length && fullText[targetLen] !== " ") {
        targetLen++;
      }

      revealedLenRef.current = targetLen;
      const revealed = fullText.slice(0, targetLen);

      setState((prev) => {
        const messages = [...prev.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          messages[messages.length - 1] = { ...last, text: revealed };
        } else {
          messages.push({ role: "assistant", text: revealed, timestamp: Date.now() });
        }
        return { ...prev, messages };
      });
    },
  });
  const ttsRef = useRef(tts);
  ttsRef.current = tts;

  const handleEvent = useCallback((event: string, data: LessonEventData) => {
    log("event:", event, data.text ? `"${data.text.slice(0, 50)}..."` : "");

    if (event === "lesson_started") {
      const d = data as LessonEventData & { voiceId?: string; speechSpeed?: number };
      if (d.voiceId) voiceIdRef.current = d.voiceId;
      if (d.speechSpeed != null) speechSpeedRef.current = d.speechSpeed;
    }

    if (event === "speed_updated") {
      const speedMap: Record<string, number> = { very_slow: 0.7, slow: 0.85, normal: 1.0, natural: 1.0, fast: 1.15, very_fast: 1.3 };
      const d = data as LessonEventData & { speed?: string };
      if (d.speed && speedMap[d.speed] != null) {
        speechSpeedRef.current = speedMap[d.speed] ?? 1.0;
        log("speed updated to:", d.speed, speechSpeedRef.current);
      }
      return;
    }

    const action = handleLessonEvent(event, data, {
      userSpeaking: userSpeakingRef.current,
      pendingTurns: pendingTurnsRef.current,
    });

    if (event === "tutor_message" || event === "exercise_feedback") {
      pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
    }

    switch (action.type) {
      case "set_state":
        setState((prev) => {
          const patch = action.patch;
          if (event === "status" && patch["status"] === undefined) return prev;
          return { ...prev, ...patch } as LessonState;
        });
        if (event === "error") log("ERROR:", data.message);
        break;

      case "show_message": {
        if (action.text && voiceIdRef.current) {
          // Buffer text — reveal progressively as audio plays
          pendingRevealTextRef.current = action.text;
          revealedLenRef.current = 0;
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, { role: "assistant" as const, text: "", timestamp: Date.now() }],
            status: "speaking",
          }));
          ttsRef.current.speak(action.text, voiceIdRef.current, speechSpeedRef.current);
        } else {
          // No TTS — show text immediately
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, { role: "assistant" as const, text: action.text, timestamp: Date.now() }],
            status: "idle",
          }));
        }
        break;
      }

      case "stream_chunk": {
        if (action.messageId && activeMessageIdRef.current && action.messageId !== activeMessageIdRef.current) {
          log("discarding stale chunk, messageId mismatch");
          break;
        }
        if (action.messageId && !activeMessageIdRef.current) {
          log("discarding chunk, no active generation");
          break;
        }

        if (!streamStartedRef.current && voiceIdRef.current) {
          streamStartedRef.current = true;
          ttsRef.current.startStream(voiceIdRef.current, speechSpeedRef.current);
        }

        ttsRef.current.sendChunk(action.text);

        // Accumulate text — progress callback will reveal it in sync with audio
        streamTextRef.current += (streamTextRef.current ? " " : "") + action.text;
        pendingRevealTextRef.current = streamTextRef.current;

        // Ensure assistant message bubble exists (empty until audio plays)
        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role !== "assistant") {
            messages.push({ role: "assistant", text: "", timestamp: Date.now() });
            return { ...prev, messages, status: "speaking" };
          }
          return prev.status === "speaking" ? prev : { ...prev, status: "speaking" };
        });
        break;
      }

      case "stream_end": {
        if (action.messageId && activeMessageIdRef.current && action.messageId !== activeMessageIdRef.current) {
          log("discarding stale stream_end, messageId mismatch");
          break;
        }
        if (action.messageId && !activeMessageIdRef.current) {
          log("discarding stream_end, no active generation");
          break;
        }

        activeMessageIdRef.current = null;
        streamStartedRef.current = false;
        ttsRef.current.endStream();

        // Store full text — onAllDone will reveal any remainder
        streamTextRef.current = "";
        pendingRevealTextRef.current = action.fullText;
        break;
      }

      case "stream_discard": {
        pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
        activeMessageIdRef.current = null;
        streamStartedRef.current = false;
        streamTextRef.current = "";
        pendingRevealTextRef.current = null;
        revealedLenRef.current = 0;
        ttsRef.current.stop();

        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            messages.pop();
          }
          return { ...prev, messages, status: "idle" };
        });
        break;
      }

      case "discard":
        if (event === "tutor_message" || event === "exercise_feedback" || event === "tutor_chunk") {
          log("discarding", event);
        }
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { emit, connected } = useWebSocket({
    url: WS_URL,
    token: token ?? null,
    onEvent: handleEvent,
  });

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      pendingTurnsRef.current++;
      const trimmed = text.trim();
      const messageId = crypto.randomUUID();
      activeMessageIdRef.current = messageId;

      // Pre-warm TTS WebSocket while server processes the request
      if (voiceIdRef.current) {
        ttsRef.current.preWarm(voiceIdRef.current, speechSpeedRef.current);
      }

      setState((prev) => {
        const messages = [...prev.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "user") {
          messages[messages.length - 1] = { ...last, text: last.text + " " + trimmed };
        } else {
          messages.push({ role: "user", text: trimmed, timestamp: Date.now() });
        }
        return { ...prev, messages, status: "thinking" };
      });
      emit("text", { text: trimmed, messageId });
    },
    [emit],
  );

  const endLesson = useCallback(() => {
    emit("end_lesson", {});
  }, [emit]);

  const interruptTutor = useCallback(() => {
    tts.stop();
    emit("interrupt", {});
    activeMessageIdRef.current = null;
    streamStartedRef.current = false;
    streamTextRef.current = "";
    pendingRevealTextRef.current = null;
    revealedLenRef.current = 0;

    setState((prev) => {
      const messages = [...prev.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        if (last.text) {
          messages[messages.length - 1] = { ...last, text: last.text + "..." };
        } else {
          messages.pop();
        }
      }
      return { ...prev, messages, status: "idle" };
    });
  }, [tts, emit]);

  const setUserSpeaking = useCallback((speaking: boolean) => {
    userSpeakingRef.current = speaking;
  }, []);

  return {
    ...state,
    connected,
    isPlaying: tts.isSpeaking,
    sendText,
    endLesson,
    interruptTutor,
    stopAllAudio: useCallback(() => { tts.stop(); }, [tts]),
    setUserSpeaking,
  };
}
