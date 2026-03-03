import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useAudioPlayer } from "./useAudioPlayer";
import { handleLessonEvent } from "./lesson/handleLessonEvent";
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
}

export function useLessonState(token?: string | null) {
  const [state, setState] = useState<LessonState>({
    lessonId: null,
    messages: [],
    currentExercise: null,
    status: "connecting",
    lessonEnded: false,
    hasPending: false,
  });

  const pendingRef = useRef<PendingTutorMessage | null>(null);
  const userSpeakingRef = useRef(false);
  const pendingTurnsRef = useRef(0);

  const showPendingMessage = useCallback((pending: PendingTutorMessage) => {
    setState((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          role: "assistant",
          text: pending.text,
          timestamp: Date.now(),
          exercise: pending.exercise || null,
        },
      ],
      currentExercise: pending.exercise || null,
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

  const handleEvent = useCallback((event: string, data: any) => {
    console.log("[Lesson] event:", event, data?.text ? `"${data.text.slice(0, 50)}..."` : "", data?.audio ? `audio:${data.audio.length}chars` : "");

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
          if (event === "status" && patch.status === undefined) return prev;
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

      case "discard":
        if (event === "tutor_message" || event === "exercise_feedback") {
          console.log("[Lesson] discarding", event, "—", userSpeakingRef.current ? "user is speaking" : "newer message pending", `(pendingTurns=${pendingTurnsRef.current})`);
        }
        break;
    }
  }, [audioPlayer, showPendingMessage]);

  const { emit, connected } = useWebSocket({
    url: WS_URL,
    token: token || null,
    onEvent: handleEvent,
  });

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      pendingTurnsRef.current++;
      console.log("[Lesson] sendText:", text.trim(), `(pendingTurns=${pendingTurnsRef.current})`);
      setState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          { role: "user", text: text.trim(), timestamp: Date.now() },
        ],
        status: "thinking",
      }));
      emit("text", { text: text.trim() });
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
    audioPlayer.stop();
    setState((prev) => ({
      ...prev,
      hasPending: false,
      status: prev.status === "speaking" ? "idle" : prev.status,
    }));
  }, [audioPlayer]);

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
    isPlaying: audioPlayer.isPlaying,
    sendText,
    submitExerciseAnswer,
    endLesson,
    interruptTutor,
    stopAudio: audioPlayer.stop,
    playPending: state.hasPending ? playPending : null,
    setUserSpeaking,
  };
}
