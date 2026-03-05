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
    lessonEnded: serverLessonEnded, error: lessonError, sendText,
    submitExerciseAnswer, endLesson, interruptTutor, stopAllAudio,
    setUserSpeaking,
  } = useLessonState(token);

  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const micReadyRef = useRef(false);
  const isTutorActive = isPlaying || status === "speaking";
  const isTutorActiveRef = useRef(false);
  isTutorActiveRef.current = isTutorActive;

  const hasReceivedFirstMessage = messages.some((msg) => msg.role === "assistant");
  const elapsed = useElapsedTimer(hasReceivedFirstMessage);

  const speechBuffer = useSpeechBuffer({
    onFlush: useCallback((text: string) => {
      setLiveTranscript("");
      sendText(text);
    }, [sendText]),
    onSpeechDone: useCallback(() => { setUserSpeaking(false); }, [setUserSpeaking]),
  });

  const stt = useStudentStt({
    onSpeechEnd: () => {
      setUserSpeaking(false);
    },
    onSegment: (text: string) => {
      if (isTutorActiveRef.current) {
        setUserSpeaking(true);
        interruptTutor();
        speechBuffer.clear();
        setLiveTranscript("");
      }
      speechBuffer.push(text);
      setLiveTranscript(speechBuffer.getText());
    },
  });

  // Enable STT after tutor's first message
  useEffect(() => {
    if (hasReceivedFirstMessage && !isMuted && !isPaused && !stt.isEnabled && !micReadyRef.current) {
      stt.enable();
      micReadyRef.current = true;
    }
  }, [hasReceivedFirstMessage, isMuted, isPaused, stt]);

  // Pause audio when tab loses focus
  useTabFocus({ onBlur: () => { stopAllAudio(); } });

  // Show interim transcript
  useEffect(() => {
    if (stt.finalText) {
      const buf = speechBuffer.getText();
      setLiveTranscript(buf ? buf + " " + stt.finalText : stt.finalText);
    }
  }, [stt.finalText, speechBuffer]);

  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
      if (!isMuted) stt.enable();
    } else {
      setIsPaused(true);
      interruptTutor();
      stt.disable();
      speechBuffer.clear();
      setLiveTranscript("");
    }
  }, [isPaused, isMuted, stt, interruptTutor, speechBuffer]);

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
    stopAllAudio();
    speechBuffer.flush();
    endLesson();
    router.push("/dashboard");
  }, [endLesson, stt, speechBuffer, router, stopAllAudio]);

  // Server ended the lesson
  useEffect(() => {
    if (serverLessonEnded) {
      stt.disable();
      stopAllAudio();
      router.push("/dashboard");
    }
  }, [serverLessonEnded, stt, router, stopAllAudio]);

  // Error — go back to dashboard
  useEffect(() => {
    if (lessonError) {
      stt.disable();
      stopAllAudio();
      router.push("/dashboard");
    }
  }, [lessonError, stt, stopAllAudio, router]);

  if (!connected) return <LessonConnecting />;
  if (!hasReceivedFirstMessage) return <LessonWaiting />;

  return (
    <div className="h-screen lesson-gradient flex flex-col overflow-hidden">
      <LessonHeader elapsed={elapsed} onEndLesson={handleEndLesson} />

      <div className="flex-shrink-0 flex flex-col items-center py-4">
        <TutorAvatar isSpeaking={isTutorActive} />
        <p className="text-white/80 text-sm mt-2 font-medium">Jake</p>
      </div>

      <ChatHistory
        messages={messages}
        isThinking={status === "thinking"}
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
