import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useAudioPlayer } from "./useAudioPlayer";
import { useAudioQueue } from "./useAudioQueue";
import { handleLessonEvent, type LessonEventData } from "./lesson/handleLessonEvent";
import { WS_URL } from "@/lib/config";
import type { ChatMessage, LessonExercise, LessonStatus } from "@/types";

interface PendingTutorMessage {
  text: string;
  audio?: string;
  exercise?: LessonExercise | null;
}

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

  const pendingRef = useRef<PendingTutorMessage | null>(null);
  const userSpeakingRef = useRef(false);
  const pendingTurnsRef = useRef(0);
  const streamingTextRef = useRef("");

  const showPendingMessage = useCallback((pending: PendingTutorMessage) => {
    setState((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          role: "assistant",
          text: pending.text,
          timestamp: Date.now(),
          exercise: pending.exercise ?? null,
        },
      ],
      currentExercise: pending.exercise ?? null,
      status: "speaking",
    }));
  }, []);

  const audioPlayer = useAudioPlayer({
    onPlay: () => {
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        setState((prev) => ({ ...prev, hasPending: false }));
        showPendingMessage(pending);
      }
    },
    onEnd: () => {
      setState((prev) => ({
        ...prev,
        status: prev.status === "speaking" ? "idle" : prev.status,
      }));
    },
  });

  const audioQueue = useAudioQueue({
    onAllDone: () => {
      setState((prev) => ({
        ...prev,
        status: prev.status === "speaking" ? "idle" : prev.status,
      }));
    },
  });

  const handleEvent = useCallback((event: string, data: LessonEventData) => {
    console.log("[Lesson] event:", event, data.text ? `"${data.text.slice(0, 50)}..."` : "", data.audio ? `audio:${data.audio.length}chars` : "");

    const action = handleLessonEvent(event, data, {
      userSpeaking: userSpeakingRef.current,
      pendingTurns: pendingTurnsRef.current,
    });

    // Decrement pending turns for response events
    if (event === "tutor_message" || event === "exercise_feedback") {
      pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
    }

    switch (action.type) {
      case "set_state":
        setState((prev) => {
          const patch = action.patch;
          // For status event, only update if the patch has a defined status
          if (event === "status" && patch["status"] === undefined) return prev;
          return { ...prev, ...patch } as LessonState;
        });
        if (event === "error") console.error("Lesson error:", data.message);
        break;

      case "play_audio":
        pendingRef.current = action.pending;
        setState((prev) => ({ ...prev, hasPending: true }));
        audioPlayer.play(action.audio);
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
        streamingTextRef.current += (streamingTextRef.current ? " " : "") + action.text;
        const accumulatedText = streamingTextRef.current;

        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant" && prev.status === "speaking") {
            messages[messages.length - 1] = { ...last, text: accumulatedText };
          } else {
            messages.push({
              role: "assistant",
              text: accumulatedText,
              timestamp: Date.now(),
            });
          }
          return { ...prev, messages, status: "speaking" };
        });

        if (action.audio) {
          audioQueue.enqueue({ chunkIndex: action.chunkIndex, audio: action.audio });
        }
        break;
      }

      case "stream_end": {
        streamingTextRef.current = "";
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
          return {
            ...prev,
            messages,
            currentExercise: action.exercise,
          };
        });
        break;
      }

      case "discard":
        if (event === "tutor_message" || event === "exercise_feedback") {
          console.log("[Lesson] discarding", event, "—", userSpeakingRef.current ? "user is speaking" : "newer message pending", `(pendingTurns=${pendingTurnsRef.current})`);
        }
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- showPendingMessage is a stable useCallback
  }, [audioPlayer, showPendingMessage]);

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
    pendingRef.current = null;
    streamingTextRef.current = "";
    const progress = audioPlayer.stop();
    audioQueue.stop();
    emit("interrupt", {});
    setState((prev) => {
      const messages = [...prev.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && progress < 0.95) {
        const cutAt = Math.max(1, Math.floor(last.text.length * progress));
        const truncated = last.text.substring(0, cutAt).replace(/\s+\S*$/, "");
        messages[messages.length - 1] = {
          ...last,
          text: (truncated || last.text.substring(0, cutAt)) + "...",
        };
      }
      return {
        ...prev,
        messages,
        hasPending: false,
        status: prev.status === "speaking" ? "idle" : prev.status,
      };
    });
  }, [audioPlayer, audioQueue, emit]);

  const setUserSpeaking = useCallback((speaking: boolean) => {
    userSpeakingRef.current = speaking;
  }, []);

  // Retry playing the pending first message (called after mic permission grants user gesture)
  const playPending = useCallback(() => {
    const pending = pendingRef.current;
    if (pending?.audio) {
      audioPlayer.play(pending.audio);
    }
  }, [audioPlayer]);

  return {
    ...state,
    connected,
    isPlaying: audioPlayer.isPlaying || audioQueue.isPlaying,
    isStreaming: audioQueue.isPlaying,
    audioDuration: audioPlayer.duration,
    sendText,
    submitExerciseAnswer,
    endLesson,
    interruptTutor,
    stopAudio: audioPlayer.stop,
    playPending: state.hasPending ? playPending : null,
    setUserSpeaking,
  };
}
