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

  const pendingSentencesRef = useRef<string[]>([]);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const streamFullTextRef = useRef<string>("");
  const isStreamingModeRef = useRef(false);

  const scheduleReveals = useCallback((duration: number) => {
    const fullText = pendingSentencesRef.current.join(" ");
    const totalChars = fullText.length;
    if (totalChars === 0) return;

    const durationMs = duration * 1000;
    const startTime = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const charIndex = Math.floor(progress * totalChars);

      setState((prev) => {
        const messages = [...prev.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          messages[messages.length - 1] = { ...last, text: fullText.slice(0, charIndex) };
        }
        return { ...prev, messages };
      });

      if (progress < 1) {
        revealTimersRef.current.push(setTimeout(tick, 50));
      }
    };

    tick();
  }, []);

  const finalizeStream = useCallback(() => {
    for (const t of revealTimersRef.current) clearTimeout(t);
    revealTimersRef.current = [];

    // Capture ref values BEFORE setState — React batching may defer
    // the updater, and refs are cleared synchronously after setState call
    const fullText = streamFullTextRef.current
      || pendingSentencesRef.current.join(" ");

    setState((prev) => {
      const messages = [...prev.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        messages[messages.length - 1] = {
          ...last,
          text: fullText,
        };
      }
      return {
        ...prev,
        messages,
        status: "idle",
      };
    });

    isStreamingModeRef.current = false;
    pendingSentencesRef.current = [];
    streamFullTextRef.current = "";
  }, []);

  const tts = useTutorTts({
    onAudioPlay: (duration) => {
      if (!isStreamingModeRef.current) return;
      scheduleReveals(duration);
    },
    onAllDone: () => {
      if (!isStreamingModeRef.current) return;
      finalizeStream();
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
        speechSpeedRef.current = speedMap[d.speed]!;
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

      case "show_message":
        if (action.text && voiceIdRef.current) {
          // Typewriter reveal synced with audio
          isStreamingModeRef.current = true;
          pendingSentencesRef.current = [action.text];
          streamFullTextRef.current = action.text;

          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: "assistant", text: "", timestamp: Date.now() },
            ],
            status: "speaking",
          }));

          ttsRef.current.speak(action.text, voiceIdRef.current, speechSpeedRef.current);
        } else {
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                text: action.text,
                timestamp: Date.now(),
              },
            ],
            status: "idle",
          }));
        }
        break;

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
          isStreamingModeRef.current = true;
          pendingSentencesRef.current = [];
          ttsRef.current.startStream(voiceIdRef.current, speechSpeedRef.current);
        }

        ttsRef.current.sendChunk(action.text);
        pendingSentencesRef.current.push(action.text);

        // Create empty placeholder message on first chunk (no text yet)
        if (pendingSentencesRef.current.length === 1) {
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, { role: "assistant", text: "", timestamp: Date.now() }],
            status: "speaking",
          }));
        }
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

        // Save for later reveal (when audio finishes)
        streamFullTextRef.current = action.fullText;
        break;
      }

      case "stream_discard": {
        // Moderation flagged the input after chunks were already sent.
        // Stop TTS, clear audio queue, remove partial assistant message.
        // Decrement pendingTurns so the follow-up safety tutor_message is not discarded.
        pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
        activeMessageIdRef.current = null;
        streamStartedRef.current = false;
        ttsRef.current.stop();

        for (const t of revealTimersRef.current) clearTimeout(t);
        revealTimersRef.current = [];

        isStreamingModeRef.current = false;
        pendingSentencesRef.current = [];
        streamFullTextRef.current = "";

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
        const last = prev.messages[prev.messages.length - 1];
        if (last?.role === "user") {
          const updated = [...prev.messages];
          updated[updated.length - 1] = { ...last, text: last.text + " " + trimmed };
          return { ...prev, messages: updated, status: "thinking" };
        }
        return {
          ...prev,
          messages: [...prev.messages, { role: "user", text: trimmed, timestamp: Date.now() }],
          status: "thinking",
        };
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

    // Clear reveal timers
    for (const t of revealTimersRef.current) clearTimeout(t);
    revealTimersRef.current = [];

    if (isStreamingModeRef.current) {
      isStreamingModeRef.current = false;
      pendingSentencesRef.current = [];
      streamFullTextRef.current = "";

      // Keep only already-revealed text; remove placeholder if nothing shown yet
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
    } else {
      setState((prev) => {
        const messages = [...prev.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant" && last.text && prev.status === "speaking") {
          messages[messages.length - 1] = { ...last, text: last.text + "..." };
        }
        return { ...prev, messages, status: prev.status === "speaking" || prev.status === "thinking" ? "idle" : prev.status };
      });
    }
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
