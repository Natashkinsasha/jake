import { useCallback, useRef, useState } from "react";
import { WS_URL } from "@/lib/config";
import { handleCustomEvent } from "./lesson/customEventHandlers";
import { handleLessonEvent, type LessonEventData } from "./lesson/handleLessonEvent";
import { processAction } from "./lesson/processAction";
import type { LessonRefs, LessonState } from "./lesson/types";
import { createLogger } from "./logger";
import { useTutorTts } from "./useTutorTts";
import { useWebSocket } from "./useWebSocket";

const log = createLogger("Lesson");

export function useLessonState(token?: string | null) {
  const [state, setState] = useState<LessonState>({
    lessonId: null,
    messages: [],
    status: "connecting",
    lessonEnded: false,
    error: null,
    startedAt: null,
  });

  const [ttsError, setTtsError] = useState<string | null>(null);
  const seenVocabRef = useRef<Set<string>>(new Set());
  const userSpeakingRef = useRef(false);
  const pendingTurnsRef = useRef(0);
  const activeMessageIdRef = useRef<string | null>(null);
  const voiceIdRef = useRef<string | null>(null);
  const speechSpeedRef = useRef<number>(1.0);
  const ttsModelRef = useRef<string | undefined>(undefined);
  const systemPromptRef = useRef<string | null>(null);
  const streamStartedRef = useRef(false);
  const greetingPlayingRef = useRef(false);
  const emotionRef = useRef<string>("neutral");

  const streamTextRef = useRef<string>("");
  const pendingRevealTextRef = useRef<string | null>(null);
  const finalFullTextRef = useRef<string | null>(null);
  const revealedLenRef = useRef(0);

  const tts = useTutorTts({
    onError: (message) => {
      log("TTS error:", message);
      greetingPlayingRef.current = false;
      setTtsError(message);
    },
    onAllDone: () => {
      greetingPlayingRef.current = false;

      // If a new stream already started (e.g. exercise feedback response),
      // this onAllDone is from a stale TTS — don't overwrite the new stream's message.
      if (streamStartedRef.current) return;

      // Use server's authoritative fullText for the final snap (corrected punctuation etc.)
      const text = finalFullTextRef.current ?? pendingRevealTextRef.current;
      if (text) {
        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            messages[messages.length - 1] = { ...last, text };
          }
          return { ...prev, messages, status: "idle" };
        });
      } else {
        setState((prev) => (prev.status === "speaking" ? { ...prev, status: "idle" } : prev));
      }
      finalFullTextRef.current = null;
      pendingRevealTextRef.current = null;
      revealedLenRef.current = 0;
    },
    onPlaybackProgress: (playedSec, totalDecodedSec, allReceived) => {
      const fullText = pendingRevealTextRef.current;
      if (!fullText) return;

      let targetLen: number;
      if (allReceived && totalDecodedSec > 0) {
        // Exact sync — we know the total audio duration
        targetLen = Math.floor(fullText.length * (playedSec / totalDecodedSec));
      } else {
        // Estimate ~15 chars/sec adjusted for speech speed
        const rate = 15 * speechSpeedRef.current;
        targetLen = Math.floor(playedSec * rate);
      }

      // Never go backward, never exceed text length
      targetLen = Math.max(revealedLenRef.current, Math.min(targetLen, fullText.length));
      if (targetLen <= revealedLenRef.current) return;

      // Snap forward to word boundary
      while (targetLen < fullText.length && fullText[targetLen] !== " ") {
        targetLen++;
      }

      revealedLenRef.current = targetLen;
      const revealed = fullText.slice(0, targetLen);

      setState((prev) => {
        const messages = [...prev.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "assistant") {
          messages[messages.length - 1] = { ...last, text: revealed };
        } else {
          messages.push({ role: "assistant", text: revealed, timestamp: Date.now() });
        }
        return { ...prev, messages };
      });
    },
  });
  const ttsRef = useRef(tts);
  ttsRef.current = tts;

  const refsRef = useRef<LessonRefs | null>(null);
  if (!refsRef.current) {
    refsRef.current = {
      voiceId: voiceIdRef,
      speechSpeed: speechSpeedRef,
      ttsModel: ttsModelRef,
      systemPrompt: systemPromptRef,
      emotion: emotionRef,
      greetingPlaying: greetingPlayingRef,
      seenVocab: seenVocabRef,
      pendingTurns: pendingTurnsRef,
      activeMessageId: activeMessageIdRef,
      streamStarted: streamStartedRef,
      streamText: streamTextRef,
      pendingRevealText: pendingRevealTextRef,
      finalFullText: finalFullTextRef,
      revealedLen: revealedLenRef,
      userSpeaking: userSpeakingRef,
      tts: ttsRef,
    };
  }
  const refs = refsRef.current;

  const handleEvent = useCallback(
    (event: string, data: LessonEventData) => {
      log("event:", event, data.text ? `"${data.text.slice(0, 50)}..."` : "");

      if (handleCustomEvent(event, data, refs, setState, log)) return;

      if (event === "tutor_message") {
        refs.pendingTurns.current = Math.max(0, refs.pendingTurns.current - 1);
      }

      const action = handleLessonEvent(event, data, {
        userSpeaking: refs.userSpeaking.current,
        pendingTurns: refs.pendingTurns.current,
      });

      processAction(action, event, data, refs, setState, log);
    },
    [refs],
  );

  const { emit, connected } = useWebSocket({
    url: WS_URL,
    token: token ?? null,
    onEvent: handleEvent,
  });

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      pendingTurnsRef.current++;
      emotionRef.current = "neutral";
      const trimmed = text.trim();
      const messageId = crypto.randomUUID();
      activeMessageIdRef.current = messageId;

      // Pre-warm TTS WebSocket while server processes the request
      if (voiceIdRef.current) {
        ttsRef.current.preWarm(voiceIdRef.current, speechSpeedRef.current, ttsModelRef.current);
      }

      setState((prev) => {
        const messages = [...prev.messages];
        const last = messages[messages.length - 1];
        if (last?.role === "user") {
          messages[messages.length - 1] = { ...last, text: `${last.text} ${trimmed}` };
        } else {
          messages.push({ role: "user", text: trimmed, timestamp: Date.now() });
        }
        return { ...prev, messages, status: "thinking" };
      });
      emit("text", { text: trimmed, messageId });
    },
    [emit],
  );

  const sendVoiceSample = useCallback(
    (base64Audio: string) => {
      emit("voice_sample", { audio: base64Audio });
    },
    [emit],
  );

  const endLesson = useCallback(() => {
    emit("end_lesson", {});
  }, [emit]);

  const interruptTutor = useCallback(() => {
    if (greetingPlayingRef.current) return;
    tts.stop();
    emit("interrupt", {});
    activeMessageIdRef.current = null;
    streamStartedRef.current = false;
    streamTextRef.current = "";
    pendingRevealTextRef.current = null;
    finalFullTextRef.current = null;
    revealedLenRef.current = 0;

    setState((prev) => {
      const messages = [...prev.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        if (last.text) {
          messages[messages.length - 1] = { ...last, text: `${last.text}...` };
        } else {
          messages.pop();
        }
      }
      return { ...prev, messages, status: "idle" };
    });
  }, [tts, emit]);

  const setUserSpeaking = useCallback((speaking: boolean) => {
    userSpeakingRef.current = speaking;
  }, []);

  return {
    ...state,
    connected,
    isPlaying: tts.isSpeaking,
    ttsError,
    sendText,
    sendVoiceSample,
    endLesson,
    interruptTutor,
    submitExerciseAnswer: useCallback(
      (exerciseId: string, answers: Array<{ word: string; definition: string }>) => {
        emit("exercise_answer", { exerciseId, answers });
      },
      [emit],
    ),
    stopAllAudio: useCallback(() => {
      tts.stop();
    }, [tts]),
    setUserSpeaking,
    debugInfo: {
      voiceId: voiceIdRef.current,
      speechSpeed: speechSpeedRef.current,
      ttsModel: ttsModelRef.current,
      systemPrompt: systemPromptRef.current,
    },
  };
}
