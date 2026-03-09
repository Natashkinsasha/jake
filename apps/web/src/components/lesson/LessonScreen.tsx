"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChatHistory } from "./ChatHistory";
import { LessonConnecting } from "./LessonConnecting";
import { LessonWaiting } from "./LessonWaiting";
import { LessonHeader } from "./LessonHeader";
import { LessonControls } from "./LessonControls";
import { DebugModal } from "./DebugModal";
import { ExercisePanel } from "./ExercisePanel";
import { useToast } from "@/components/ui/Toast";
import { useLessonState } from "@/hooks/useLessonState";
import { useStudentStt } from "@/hooks/useStudentStt";
import { useSpeechBuffer } from "@/hooks/useSpeechBuffer";
import { useElapsedTimer } from "@/hooks/useElapsedTimer";
import { useTabFocus } from "@/hooks/useTabFocus";
import { isBackchannel } from "@/lib/backchannel";
import { shouldAbortForRevision } from "@/lib/text-similarity";

interface LessonScreenProps {
  token?: string | null;
}

export function LessonScreen({ token }: LessonScreenProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    messages, status, connected, isPlaying, lessonId, startedAt,
    lessonEnded: serverLessonEnded, error: lessonError, ttsError, sendText,
    sendVoiceSample, endLesson, interruptTutor, stopAllAudio,
    setUserSpeaking, debugInfo, submitExerciseAnswer,
  } = useLessonState(token);

  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const micReadyRef = useRef(false);
  const isTutorActive = isPlaying || status === "speaking" || status === "thinking";
  const isTutorActiveRef = useRef(false);
  isTutorActiveRef.current = isTutorActive;
  const statusRef = useRef(status);
  statusRef.current = status;
  const lastSentTextRef = useRef("");

  const hasReceivedFirstMessage = messages.some((msg) => msg.role === "assistant");
  const elapsed = useElapsedTimer(hasReceivedFirstMessage, startedAt);

  // Find the active (not yet answered) exercise
  const [dismissedExerciseId, setDismissedExerciseId] = useState<string | null>(null);
  const activeExercise = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.role === "exercise" && msg.exercise && !msg.exerciseFeedback) {
        if (msg.exercise.exerciseId === dismissedExerciseId) return null;
        return msg.exercise;
      }
    }
    return null;
  }, [messages, dismissedExerciseId]);

  const wrappedSendText = useCallback((text: string) => {
    lastSentTextRef.current = text;
    sendText(text);
  }, [sendText]);

  const speechBuffer = useSpeechBuffer({
    onFlush: useCallback((text: string) => {
      setLiveTranscript("");
      wrappedSendText(text);
    }, [wrappedSendText]),
    onSpeechDone: useCallback(() => { setUserSpeaking(false); }, [setUserSpeaking]),
  });

  const stt = useStudentStt({
    onSpeechEnd: () => {
      setUserSpeaking(false);
    },
    onVoiceSample: (base64Audio: string) => {
      sendVoiceSample(base64Audio);
    },
    onSegment: (text: string) => {
      // Abort if Deepgram significantly revised the transcript we already sent
      if (statusRef.current === "thinking" && lastSentTextRef.current) {
        const bufferedText = speechBuffer.getText();
        const fullNew = bufferedText ? bufferedText + " " + text : text;
        if (shouldAbortForRevision(lastSentTextRef.current, fullNew)) {
          interruptTutor();
          speechBuffer.clear();
          lastSentTextRef.current = "";
        }
      }

      if (isTutorActiveRef.current && !isBackchannel(text)) {
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

  const endedByClientRef = useRef(false);

  const handleEndLesson = useCallback(() => {
    endedByClientRef.current = true;
    stt.disable();
    stopAllAudio();
    speechBuffer.flush();
    endLesson();
    router.push("/dashboard");
  }, [endLesson, stt, speechBuffer, router, stopAllAudio]);

  // Server ended the lesson (only react if not initiated by client)
  useEffect(() => {
    if (serverLessonEnded && !endedByClientRef.current) {
      stt.disable();
      stopAllAudio();
      showToast("Lesson ended", "info");
      router.push("/dashboard");
    }
  }, [serverLessonEnded, stt, router, stopAllAudio, showToast]);

  // TTS error — show toast
  useEffect(() => {
    if (ttsError) {
      showToast(ttsError, "error");
    }
  }, [ttsError, showToast]);

  // STT error — show toast
  useEffect(() => {
    if (stt.error) {
      showToast(stt.error, "error");
    }
  }, [stt.error, showToast]);

  // Error — go back to dashboard
  useEffect(() => {
    if (lessonError) {
      stt.disable();
      stopAllAudio();
      showToast(lessonError, "error");
      router.push("/dashboard");
    }
  }, [lessonError, stt, stopAllAudio, router, showToast]);

  if (!connected) return <LessonConnecting />;
  if (!hasReceivedFirstMessage) return <LessonWaiting />;

  return (
    <div className="h-dvh lesson-bg flex flex-col overflow-hidden">
      {/* Minimal top bar — just debug button */}
      <LessonHeader>
        <button
          type="button"
          onClick={() => { setDebugOpen(true); }}
          className="p-2 -m-1 text-white/15 hover:text-white/40 transition-colors rounded-lg"
          title="Debug"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6.56 1.14a.75.75 0 01.177 1.045 3.989 3.989 0 00-.464.886c.482.4.882.93 1.159 1.528h3.136a3.997 3.997 0 011.16-1.528 3.989 3.989 0 00-.465-.886.75.75 0 111.222-.868c.274.386.5.819.664 1.283A4.003 4.003 0 0114.75 7h.5a.75.75 0 010 1.5h-.227a4.984 4.984 0 01.227 1.5v.5h.5a.75.75 0 010 1.5h-.5v.5a4.984 4.984 0 01-.227 1.5h.227a.75.75 0 010 1.5h-.5a4.003 4.003 0 01-1.7 2.47.75.75 0 01-.868-1.222c.149-.105.29-.22.424-.344A3.001 3.001 0 0013 12.5v-2A3.001 3.001 0 0010 7.5H9.5A3.001 3.001 0 006.5 10.5v2a3.001 3.001 0 00.606 1.904c.134.124.275.239.424.344a.75.75 0 01-.868 1.222A4.003 4.003 0 015 13.5h-.5a.75.75 0 010-1.5h.227A4.984 4.984 0 014.5 10.5V10h-.5a.75.75 0 010-1.5h.5V8a4.984 4.984 0 01.227-1.5H4.5a.75.75 0 010-1.5h.5a4.003 4.003 0 011.7-2.47 3.989 3.989 0 01-.664-1.283.75.75 0 011.045-.177z" clipRule="evenodd" />
          </svg>
        </button>
      </LessonHeader>
      <DebugModal open={debugOpen} onClose={() => { setDebugOpen(false); }} debugInfo={debugInfo} />

      {/* Chat — takes available space */}
      <ChatHistory
        messages={messages}
        isThinking={status === "thinking"}
        isTutorActive={isTutorActive}
        lessonId={lessonId}
        onExerciseSubmit={submitExerciseAnswer}
        activeExerciseId={activeExercise?.exerciseId}
      />

      {/* Exercise panel — slides up from bottom, above controls */}
      {activeExercise && (
        <ExercisePanel
          exercise={activeExercise}
          onSubmit={submitExerciseAnswer}
          onDismiss={() => { setDismissedExerciseId(activeExercise.exerciseId); }}
        />
      )}

      {/* Live transcript preview — always rendered to avoid layout shift */}
      <div className="flex-shrink-0 px-4 pb-2 min-h-7">
        {liveTranscript && (
          <p className="text-white/40 text-sm italic text-center truncate">{liveTranscript}</p>
        )}
      </div>

      {/* Bottom controls */}
      <LessonControls
        isPaused={isPaused}
        isMuted={isMuted}
        sttError={stt.error}
        elapsed={elapsed}
        onTogglePause={handleTogglePause}
        onToggleMute={handleToggleMute}
        onEndLesson={handleEndLesson}
      />
    </div>
  );
}
