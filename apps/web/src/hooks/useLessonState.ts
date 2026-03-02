import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useAudioPlayer } from "./useAudioPlayer";

interface Exercise {
  type: string;
  id: string;
  [key: string]: any;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  exercise?: Exercise | null;
}

interface PendingTutorMessage {
  text: string;
  audio?: string;
  exercise?: Exercise | null;
}

interface LessonState {
  lessonId: string | null;
  messages: Message[];
  currentExercise: Exercise | null;
  status: "idle" | "connecting" | "listening" | "thinking" | "speaking";
  lessonEnded: boolean;
  hasPending: boolean;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000/ws/lesson";

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
    switch (event) {
      case "lesson_started":
        setState((prev) => ({ ...prev, lessonId: data.lessonId, status: "idle" }));
        break;
      case "tutor_message": {
        const shouldDiscard = userSpeakingRef.current || pendingTurnsRef.current > 1;
        if (shouldDiscard) {
          pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
          console.log("[Lesson] discarding tutor_message —", userSpeakingRef.current ? "user is speaking" : "newer message pending", `(pendingTurns=${pendingTurnsRef.current})`);
          break;
        }
        pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
        if (data.audio) {
          pendingRef.current = {
            text: data.text,
            audio: data.audio,
            exercise: data.exercise || null,
          };
          setState((prev) => ({ ...prev, hasPending: true }));
          audioPlayer.play(data.audio);
        } else {
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              {
                role: "assistant",
                text: data.text,
                timestamp: Date.now(),
                exercise: data.exercise || null,
              },
            ],
            currentExercise: data.exercise || null,
            status: "idle",
          }));
        }
        break;
      }
      case "transcript":
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            { role: "user", text: data.text, timestamp: Date.now() },
          ],
        }));
        break;
      case "exercise_feedback": {
        const shouldDiscardFb = userSpeakingRef.current || pendingTurnsRef.current > 1;
        if (shouldDiscardFb) {
          pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
          console.log("[Lesson] discarding exercise_feedback —", userSpeakingRef.current ? "user is speaking" : "newer message pending");
          break;
        }
        pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
        if (data.audio) {
          pendingRef.current = { text: data.text, exercise: null };
          setState((prev) => ({ ...prev, hasPending: true }));
          audioPlayer.play(data.audio);
        } else {
          setState((prev) => ({
            ...prev,
            messages: [
              ...prev.messages,
              { role: "assistant", text: data.text, timestamp: Date.now() },
            ],
            currentExercise: null,
            status: "idle",
          }));
        }
        break;
      }
      case "status":
        setState((prev) => ({
          ...prev,
          status: data.state === "thinking" ? "thinking" : prev.status,
        }));
        break;
      case "lesson_ended":
        setState((prev) => ({ ...prev, status: "idle", lessonEnded: true }));
        break;
      case "error":
        console.error("Lesson error:", data.message);
        setState((prev) => ({ ...prev, status: "idle" }));
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
