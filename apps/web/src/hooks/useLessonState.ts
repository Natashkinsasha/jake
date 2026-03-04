import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useAudioQueue } from "./useAudioQueue";
import { handleLessonEvent, type LessonEventData } from "./lesson/handleLessonEvent";
import { WS_URL } from "@/lib/config";
import type { ChatMessage, LessonExercise, LessonStatus } from "@/types";

interface LessonState {
  lessonId: string | null;
  messages: ChatMessage[];
  currentExercise: LessonExercise | null;
  status: LessonStatus;
  lessonEnded: boolean;
  hasPending: boolean;
  error: string | null;
}

export function useLessonState(token?: string | null) {
  const [state, setState] = useState<LessonState>({
    lessonId: null,
    messages: [],
    currentExercise: null,
    status: "connecting",
    lessonEnded: false,
    hasPending: false,
    error: null,
  });

  const pendingAudioRef = useRef<string | null>(null);
  const userSpeakingRef = useRef(false);
  const pendingTurnsRef = useRef(0);
  const revealedWordsRef = useRef<number>(Infinity);

  // Streaming: buffer text chunks, reveal in sync with audio playback.
  // stream_end data is saved to a ref and applied only when all audio finishes.
  const streamChunksRef = useRef<string[]>([]);
  const streamEndRef = useRef<{ fullText: string; exercise: LessonExercise | null } | null>(null);
  const audioDoneRef = useRef(true);

  const audioQueue = useAudioQueue({
    onChunkStart: (chunkIndex) => {
      const chunks = streamChunksRef.current;
      if (chunks.length === 0) return;
      const visibleText = chunks.slice(0, chunkIndex + 1).join(" ");
      setState((prev) => {
        const messages = [...prev.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant" && prev.status === "speaking") {
          messages[messages.length - 1] = { ...last, text: visibleText };
        }
        return { ...prev, messages };
      });
    },
    onAllDone: () => {
      audioDoneRef.current = true;
      const endData = streamEndRef.current;
      streamEndRef.current = null;
      streamChunksRef.current = [];

      if (endData) {
        // stream_end already arrived — apply final text + exercise
        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            messages[messages.length - 1] = {
              ...last,
              text: endData.fullText,
              exercise: endData.exercise,
            };
          }
          return {
            ...prev,
            messages,
            currentExercise: endData.exercise,
            status: "idle",
          };
        });
      } else {
        // stream_end hasn't arrived yet (will apply when it does)
        setState((prev) => ({
          ...prev,
          status: prev.status === "speaking" ? "idle" : prev.status,
        }));
      }
    },
  });

  const handleEvent = useCallback((event: string, data: LessonEventData) => {
    console.log("[Lesson] event:", event, data.text ? `"${data.text.slice(0, 50)}..."` : "", data.audio ? `audio:${data.audio.length}chars` : "");

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

      case "play_audio":
        pendingAudioRef.current = action.audio;
        // Buffer text — will be revealed by onChunkStart when audio plays
        streamChunksRef.current = [action.pending.text];
        audioDoneRef.current = false;
        streamEndRef.current = {
          fullText: action.pending.text,
          exercise: action.pending.exercise ?? null,
        };
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              role: "assistant",
              text: "",
              timestamp: Date.now(),
              exercise: action.pending.exercise ?? null,
            },
          ],
          currentExercise: action.pending.exercise ?? null,
          hasPending: true,
          status: "speaking",
        }));
        break;

      case "show_message":
        if (action.status === "transcript") {
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: "user", text: action.text, timestamp: Date.now() },
            ],
          }));
        } else {
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
        }
        break;

      case "stream_chunk": {
        streamChunksRef.current.push(action.text);
        audioDoneRef.current = false;

        // Create a placeholder message on the first chunk
        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (!(last?.role === "assistant" && prev.status === "speaking")) {
            messages.push({
              role: "assistant",
              text: "",
              timestamp: Date.now(),
            });
          }
          return { ...prev, messages, status: "speaking" };
        });

        if (action.audio) {
          audioQueue.enqueue({ chunkIndex: action.chunkIndex, audio: action.audio });
        } else {
          // No audio (TTS failed) — show text immediately
          const visibleText = streamChunksRef.current.join(" ");
          setState((prev) => {
            const messages = [...prev.messages];
            const last = messages[messages.length - 1];
            if (last?.role === "assistant") {
              messages[messages.length - 1] = { ...last, text: visibleText };
            }
            return { ...prev, messages };
          });
        }
        break;
      }

      case "stream_end": {
        const endData = { fullText: action.fullText, exercise: action.exercise };

        if (audioDoneRef.current) {
          // Audio already finished (short response) — apply immediately
          streamChunksRef.current = [];
          streamEndRef.current = null;
          setState((prev) => {
            const messages = [...prev.messages];
            const last = messages[messages.length - 1];
            if (last?.role === "assistant") {
              messages[messages.length - 1] = {
                ...last,
                text: action.fullText,
                exercise: action.exercise,
              };
            }
            return { ...prev, messages, currentExercise: action.exercise, status: "idle" };
          });
        } else {
          // Audio still playing — save for onAllDone
          streamEndRef.current = endData;
        }
        break;
      }

      case "discard":
        if (event === "tutor_message" || event === "exercise_feedback" || event === "tutor_chunk") {
          console.log("[Lesson] discarding", event, "—", userSpeakingRef.current ? "user is speaking" : "newer message pending", `(pendingTurns=${pendingTurnsRef.current})`);
        }
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- audioQueue.enqueue is stable
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
      console.log("[Lesson] sendText:", trimmed, `(pendingTurns=${pendingTurnsRef.current})`);
      setState((prev) => {
        const last = prev.messages[prev.messages.length - 1];
        if (last?.role === "user") {
          const updated = [...prev.messages];
          updated[updated.length - 1] = {
            ...last,
            text: last.text + " " + trimmed,
          };
          return { ...prev, messages: updated, status: "thinking" };
        }
        return {
          ...prev,
          messages: [
            ...prev.messages,
            { role: "user", text: trimmed, timestamp: Date.now() },
          ],
          status: "thinking",
        };
      });
      emit("text", { text: trimmed });
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
    pendingAudioRef.current = null;
    audioQueue.stop();
    emit("interrupt", {});

    const visibleWords = revealedWordsRef.current;

    setState((prev) => {
      const messages = [...prev.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && visibleWords < Infinity) {
        const words = last.text.split(" ");
        if (visibleWords < words.length) {
          messages[messages.length - 1] = {
            ...last,
            text: words.slice(0, visibleWords).join(" ") + "...",
          };
        }
      }
      return {
        ...prev,
        messages,
        hasPending: false,
        status: prev.status === "speaking" ? "idle" : prev.status,
      };
    });

    streamChunksRef.current = [];
    streamEndRef.current = null;
    audioDoneRef.current = true;
    revealedWordsRef.current = Infinity;
  }, [audioQueue, emit]);

  const setUserSpeaking = useCallback((speaking: boolean) => {
    userSpeakingRef.current = speaking;
  }, []);

  const setRevealedWords = useCallback((count: number) => {
    revealedWordsRef.current = count;
  }, []);

  const playPending = useCallback(() => {
    const audio = pendingAudioRef.current;
    if (audio) {
      pendingAudioRef.current = null;
      setState((prev) => ({ ...prev, hasPending: false }));
      audioQueue.enqueue({ chunkIndex: 0, audio });
    }
  }, [audioQueue]);

  return {
    ...state,
    connected,
    isPlaying: audioQueue.isPlaying,
    sendText,
    submitExerciseAnswer,
    endLesson,
    interruptTutor,
    stopAllAudio: useCallback(() => { audioQueue.stop(); }, [audioQueue]),
    playPending: state.hasPending ? playPending : null,
    setUserSpeaking,
    setRevealedWords,
  };
}
