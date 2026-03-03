"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TutorAvatar } from "./TutorAvatar";
import { ChatHistory } from "./ChatHistory";
import { LessonConnecting } from "./LessonConnecting";
import { LessonWaiting } from "./LessonWaiting";
import { LessonHeader } from "./LessonHeader";
import { LessonControls } from "./LessonControls";
import { useLessonState } from "@/hooks/useLessonState";
import { useStudentStt } from "@/hooks/useStudentStt";
import { useSpeechBuffer } from "@/hooks/useSpeechBuffer";
import { useElapsedTimer } from "@/hooks/useElapsedTimer";
import { useTabFocus } from "@/hooks/useTabFocus";

interface LessonScreenProps {
  token?: string | null;
}

export function LessonScreen({ token }: LessonScreenProps) {
  const router = useRouter();
  const {
    messages, currentExercise, status, connected, isPlaying,
    lessonEnded: serverLessonEnded, sendText, submitExerciseAnswer,
    endLesson, interruptTutor, stopAudio, playPending, setUserSpeaking,
  } = useLessonState(token);

  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const micReadyRef = useRef(false);
  const isPlayingRef = useRef(false);

  if (isPlaying) {
    isPlayingRef.current = true;
  } else if (isPlayingRef.current) {
    isPlayingRef.current = false;
  }

  const hasReceivedFirstMessage = messages.some((msg) => msg.role === "assistant");
  const elapsed = useElapsedTimer(hasReceivedFirstMessage);

  const speechBuffer = useSpeechBuffer({
    onFlush: useCallback((text: string) => {
      setLiveTranscript("");
      sendText(text);
    }, [sendText]),
    onSpeechDone: useCallback(() => setUserSpeaking(false), [setUserSpeaking]),
  });

  const stt = useStudentStt({
    onSegment: (text: string) => {
      setUserSpeaking(true);

      if (isPlayingRef.current) {
        interruptTutor();
        speechBuffer.clear();
        setLiveTranscript("");
      }

      speechBuffer.push(text);
      setLiveTranscript(speechBuffer.getText() + " " + text);
    },
  });

  // Enable STT after tutor's first message
  useEffect(() => {
    if (hasReceivedFirstMessage && !isMuted && !isPaused && !stt.isEnabled && !micReadyRef.current) {
      stt.enable();
      micReadyRef.current = true;
    }
  }, [hasReceivedFirstMessage, isMuted, isPaused, stt]);

  // Play pending first message after mic is ready
  useEffect(() => {
    if (stt.isEnabled && playPending) {
      const timer = setTimeout(() => playPending(), 500);
      return () => clearTimeout(timer);
    }
  }, [stt.isEnabled, playPending]);

  // Pause audio when tab loses focus
  useTabFocus({ onBlur: () => stopAudio() });

  // Show interim transcript
  useEffect(() => {
    if (stt.finalText) {
      setLiveTranscript(speechBuffer.getText() + " " + stt.finalText);
    }
  }, [stt.finalText, speechBuffer]);

  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
      if (!isMuted) stt.enable();
    } else {
      setIsPaused(true);
      stopAudio();
      stt.disable();
      speechBuffer.clear();
      setLiveTranscript("");
    }
  }, [isPaused, isMuted, stt, stopAudio, speechBuffer]);

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      if (!isPaused) stt.enable();
    } else {
      setIsMuted(true);
      stt.disable();
    }
  }, [isMuted, isPaused, stt]);

  const handleEndLesson = useCallback(() => {
    stt.disable();
    stopAudio();
    speechBuffer.flush();
    endLesson();
    router.push("/dashboard");
  }, [endLesson, stt, speechBuffer, router, stopAudio]);

  // Server ended the lesson
  useEffect(() => {
    if (serverLessonEnded) {
      stt.disable();
      stopAudio();
      router.push("/dashboard");
    }
  }, [serverLessonEnded, stt, router, stopAudio]);

  if (!connected) return <LessonConnecting />;
  if (!hasReceivedFirstMessage) return <LessonWaiting />;

  return (
    <div className="h-screen lesson-gradient flex flex-col overflow-hidden">
      <LessonHeader elapsed={elapsed} onEndLesson={handleEndLesson} />

      <div className="flex-shrink-0 flex flex-col items-center py-4">
        <TutorAvatar isSpeaking={status === "speaking"} />
        <p className="text-white/80 text-sm mt-2 font-medium">Jake</p>
      </div>

      <ChatHistory
        messages={messages}
        isThinking={status === "thinking"}
        isSpeaking={isPlaying || status === "speaking"}
        currentExercise={currentExercise}
        onSubmitExercise={submitExerciseAnswer}
      />

      {liveTranscript && (
        <div className="px-4 pb-2">
          <p className="text-white/50 text-sm italic text-center">{liveTranscript}</p>
        </div>
      )}

      <LessonControls
        isPaused={isPaused}
        isMuted={isMuted}
        onTogglePause={handleTogglePause}
        onToggleMute={handleToggleMute}
      />
    </div>
  );
}
