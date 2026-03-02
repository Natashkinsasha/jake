import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { useAudioPlayer } from "./useAudioPlayer";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface Exercise {
  type: string;
  id: string;
  [key: string]: any;
}

interface LessonState {
  lessonId: string | null;
  messages: Message[];
  currentExercise: Exercise | null;
  status: "idle" | "connecting" | "listening" | "thinking" | "speaking";
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000/ws/lesson";

export function useLessonState() {
  const [state, setState] = useState<LessonState>({
    lessonId: null,
    messages: [],
    currentExercise: null,
    status: "connecting",
  });

  const onEventRef = useRef((event: string, data: any) => {});

  const audioPlayer = useAudioPlayer();

  onEventRef.current = (event: string, data: any) => {
    switch (event) {
      case "lesson_started":
        setState((prev) => ({ ...prev, lessonId: data.lessonId, status: "idle" }));
        break;
      case "tutor_message":
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, { role: "assistant", text: data.text }],
          currentExercise: data.exercise || null,
          status: "speaking",
        }));
        if (data.audio) {
          audioPlayer.play(data.audio);
        }
        break;
      case "transcript":
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, { role: "user", text: data.text }],
        }));
        break;
      case "exercise_feedback":
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, { role: "assistant", text: data.text }],
          currentExercise: null,
          status: "speaking",
        }));
        if (data.audio) {
          audioPlayer.play(data.audio);
        }
        break;
      case "status":
        setState((prev) => ({
          ...prev,
          status: data.state === "thinking" ? "thinking" : prev.status,
        }));
        break;
      case "lesson_ended":
        setState((prev) => ({ ...prev, status: "idle" }));
        break;
      case "error":
        console.error("Lesson error:", data.message);
        setState((prev) => ({ ...prev, status: "idle" }));
        break;
    }
  };

  const handleEvent = useCallback((event: string, data: any) => {
    onEventRef.current(event, data);
  }, []);

  const { emit, connected } = useWebSocket({
    url: WS_URL,
    onEvent: handleEvent,
  });

  const handleRecordingComplete = useCallback(
    (audioBase64: string) => {
      emit("audio", { audio: audioBase64 });
      setState((prev) => ({ ...prev, status: "thinking" }));
    },
    [emit],
  );

  const { isRecording, startRecording, stopRecording } = useVoiceRecorder({
    onRecordingComplete: handleRecordingComplete,
  });

  const submitExerciseAnswer = useCallback(
    (exerciseId: string, answer: string) => {
      emit("exercise_answer", { exerciseId, answer });
    },
    [emit],
  );

  const endLesson = useCallback(() => {
    emit("end_lesson", {});
  }, [emit]);

  return {
    ...state,
    connected,
    isRecording,
    isPlaying: audioPlayer.isPlaying,
    startRecording,
    stopRecording,
    submitExerciseAnswer,
    endLesson,
    stopAudio: audioPlayer.stop,
  };
}
