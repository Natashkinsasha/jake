import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useTutorTts } from "./useTutorTts";
import { handleLessonEvent, type LessonEventData } from "./lesson/handleLessonEvent";
import { WS_URL } from "@/lib/config";
import type { ChatMessage, LessonExercise, LessonStatus } from "@/types";

interface LessonState {
  lessonId: string | null;
  messages: ChatMessage[];
  currentExercise: LessonExercise | null;
  status: LessonStatus;
  lessonEnded: boolean;
  error: string | null;
}

export function useLessonState(token?: string | null) {
  const [state, setState] = useState<LessonState>({
    lessonId: null,
    messages: [],
    currentExercise: null,
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

  const tts = useTutorTts();
  const ttsRef = useRef(tts);
  ttsRef.current = tts;

  const handleEvent = useCallback((event: string, data: LessonEventData) => {
    console.log("[Lesson] event:", event, data.text ? `"${data.text.slice(0, 50)}..."` : "");

    if (event === "lesson_started") {
      const d = data as LessonEventData & { voiceId?: string; speechSpeed?: number };
      if (d.voiceId) voiceIdRef.current = d.voiceId;
      if (d.speechSpeed != null) speechSpeedRef.current = d.speechSpeed;
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
        if (event === "error") console.error("Lesson error:", data.message);
        break;

      case "show_message":
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              text: action.text,
              timestamp: Date.now(),
              exercise: action.exercise,
            },
          ],
          currentExercise: action.exercise,
          status: "idle",
        }));
        if (action.text && voiceIdRef.current) {
          ttsRef.current.speak(action.text, voiceIdRef.current, speechSpeedRef.current);
        }
        break;

      case "stream_chunk": {
        if (action.messageId && activeMessageIdRef.current && action.messageId !== activeMessageIdRef.current) {
          console.log("[Lesson] discarding stale chunk, messageId mismatch");
          break;
        }
        if (action.messageId && !activeMessageIdRef.current) {
          console.log("[Lesson] discarding chunk, no active generation");
          break;
        }

        if (!streamStartedRef.current && voiceIdRef.current) {
          streamStartedRef.current = true;
          ttsRef.current.startStream(voiceIdRef.current, speechSpeedRef.current);
        }

        ttsRef.current.sendChunk(action.text);

        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant" && prev.status === "speaking") {
            messages[messages.length - 1] = {
              ...last,
              text: last.text ? last.text + " " + action.text : action.text,
            };
          } else {
            messages.push({
              role: "assistant",
              text: action.text,
              timestamp: Date.now(),
            });
          }
          return { ...prev, messages, status: "speaking" };
        });
        break;
      }

      case "stream_end": {
        if (action.messageId && activeMessageIdRef.current && action.messageId !== activeMessageIdRef.current) {
          console.log("[Lesson] discarding stale stream_end, messageId mismatch");
          break;
        }
        if (action.messageId && !activeMessageIdRef.current) {
          console.log("[Lesson] discarding stream_end, no active generation");
          break;
        }

        activeMessageIdRef.current = null;
        streamStartedRef.current = false;

        ttsRef.current.endStream();

        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            messages[messages.length - 1] = {
              ...last,
              text: action.fullText,
              exercise: action.exercise,
            };
          } else {
            messages.push({
              role: "assistant",
              text: action.fullText,
              timestamp: Date.now(),
              exercise: action.exercise,
            });
          }
          return { ...prev, messages, currentExercise: action.exercise, status: "idle" };
        });
        break;
      }

      case "discard":
        if (event === "tutor_message" || event === "exercise_feedback" || event === "tutor_chunk") {
          console.log("[Lesson] discarding", event);
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

  const submitExerciseAnswer = useCallback(
    (exerciseId: string, answer: string) => {
      emit("exercise_answer", { exerciseId, answer });
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

    setState((prev) => {
      const messages = [...prev.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.text && prev.status === "speaking") {
        messages[messages.length - 1] = { ...last, text: last.text + "..." };
      }
      return {
        ...prev,
        messages,
        status: prev.status === "speaking" ? "idle" : prev.status,
      };
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
    submitExerciseAnswer,
    endLesson,
    interruptTutor,
    stopAllAudio: useCallback(() => { tts.stop(); }, [tts]),
    setUserSpeaking,
  };
}
