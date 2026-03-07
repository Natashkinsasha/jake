import { useState, useCallback, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { useTutorTts } from "./useTutorTts";
import { handleLessonEvent, type LessonEventData } from "./lesson/handleLessonEvent";
import { createLogger } from "./logger";
import { WS_URL, EMOTION_VOICE_SETTINGS } from "@/lib/config";
import type { ChatMessage, LessonStatus } from "@/types";

const log = createLogger("Lesson");

interface LessonState {
  lessonId: string | null;
  messages: ChatMessage[];
  status: LessonStatus;
  lessonEnded: boolean;
  error: string | null;
}

export function useLessonState(token?: string | null) {
  const [state, setState] = useState<LessonState>({
    lessonId: null,
    messages: [],
    status: "connecting",
    lessonEnded: false,
    error: null,
  });

  const [ttsError, setTtsError] = useState<string | null>(null);
  const pendingVocabRef = useRef<Array<{ word: string; translation: string; topic: string }>>([]);
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
      // Use server's authoritative fullText for the final snap (corrected punctuation etc.)
      const text = finalFullTextRef.current ?? pendingRevealTextRef.current;
      const vocabHighlights = pendingVocabRef.current.length > 0 ? [...pendingVocabRef.current] : undefined;
      log("onAllDone — attaching vocab:", vocabHighlights?.length ?? 0, "highlights");
      pendingVocabRef.current = [];
      if (text) {
        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            messages[messages.length - 1] = { ...last, text, vocabHighlights };
          }
          return { ...prev, messages, status: "idle" };
        });
      } else {
        setState((prev) => prev.status === "speaking" ? { ...prev, status: "idle" } : prev);
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

  const handleEvent = useCallback((event: string, data: LessonEventData) => {
    log("event:", event, data.text ? `"${data.text.slice(0, 50)}..."` : "");

    if (event === "lesson_started") {
      const d = data as LessonEventData & { voiceId?: string; speechSpeed?: number; ttsModel?: string; systemPrompt?: string; emotion?: string };
      if (d.voiceId) voiceIdRef.current = d.voiceId;
      if (d.speechSpeed != null) speechSpeedRef.current = d.speechSpeed;
      if (d.ttsModel) ttsModelRef.current = d.ttsModel;
      if (d.systemPrompt) systemPromptRef.current = d.systemPrompt;
      if (d.emotion) emotionRef.current = d.emotion;
      greetingPlayingRef.current = true;
    }

    if (event === "tutor_emotion") {
      const d = data as LessonEventData & { emotion?: string };
      if (d.emotion) emotionRef.current = d.emotion;
      return;
    }

    if (event === "vocab_highlight") {
      const d = data as LessonEventData & { word?: string; translation?: string; topic?: string };
      log("vocab_highlight received:", d.word, d.translation, d.topic);
      if (d.word && d.translation && d.topic) {
        pendingVocabRef.current = [...pendingVocabRef.current, { word: d.word, translation: d.translation, topic: d.topic }];
        log("pendingVocab now:", pendingVocabRef.current.length, "items");
      }
      return;
    }

    if (event === "vocab_reviewed") {
      return;
    }

    if (event === "speed_updated") {
      const speedMap: Record<string, number> = { very_slow: 0.7, slow: 0.85, normal: 1.0, natural: 1.0, fast: 1.15, very_fast: 1.3 };
      const d = data as LessonEventData & { speed?: string };
      if (d.speed && speedMap[d.speed] != null) {
        speechSpeedRef.current = speedMap[d.speed] ?? 1.0;
        log("speed updated to:", d.speed, speechSpeedRef.current);
      }
      return;
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
        if (event === "error") log("ERROR:", data.message);
        break;

      case "show_message": {
        if (action.text && voiceIdRef.current) {
          // Buffer text — reveal progressively as audio plays
          pendingRevealTextRef.current = action.text;
          revealedLenRef.current = 0;
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, { role: "assistant" as const, text: "", timestamp: Date.now() }],
            status: "speaking",
          }));
          const voiceSettings = emotionRef.current !== "neutral"
            ? EMOTION_VOICE_SETTINGS[emotionRef.current]
            : undefined;
          ttsRef.current.speak(action.text, voiceIdRef.current, speechSpeedRef.current, ttsModelRef.current, voiceSettings);
        } else {
          // No TTS — show text immediately
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, { role: "assistant" as const, text: action.text, timestamp: Date.now() }],
            status: "idle",
          }));
        }
        break;
      }

      case "stream_chunk": {
        if (action.messageId && activeMessageIdRef.current && action.messageId !== activeMessageIdRef.current) {
          log("discarding stale chunk, messageId mismatch");
          break;
        }
        if (action.messageId && !activeMessageIdRef.current) {
          log("discarding chunk, no active generation");
          break;
        }

        if (!streamStartedRef.current && voiceIdRef.current) {
          streamStartedRef.current = true;
          const voiceSettings = emotionRef.current !== "neutral"
            ? EMOTION_VOICE_SETTINGS[emotionRef.current]
            : undefined;
          ttsRef.current.startStream(voiceIdRef.current, speechSpeedRef.current, ttsModelRef.current, voiceSettings);
        }

        ttsRef.current.sendChunk(action.text);

        // Accumulate text — progress callback will reveal it in sync with audio
        // Don't add space if chunk starts with punctuation (e.g. ", I'm...")
        const sep = streamTextRef.current && !/^[,.\-!?;:'"]/.test(action.text) ? " " : "";
        streamTextRef.current += sep + action.text;
        pendingRevealTextRef.current = streamTextRef.current;

        // Ensure assistant message bubble exists (empty until audio plays)
        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role !== "assistant") {
            messages.push({ role: "assistant", text: "", timestamp: Date.now() });
            return { ...prev, messages, status: "speaking" };
          }
          return prev.status === "speaking" ? prev : { ...prev, status: "speaking" };
        });
        break;
      }

      case "stream_end": {
        if (action.messageId && activeMessageIdRef.current && action.messageId !== activeMessageIdRef.current) {
          log("discarding stale stream_end, messageId mismatch");
          break;
        }
        if (action.messageId && !activeMessageIdRef.current) {
          log("discarding stream_end, no active generation");
          break;
        }

        activeMessageIdRef.current = null;
        streamStartedRef.current = false;
        ttsRef.current.endStream();

        // Save authoritative fullText for onAllDone final snap.
        // Don't overwrite pendingRevealTextRef — it's used for mid-reveal
        // and switching text mid-playback causes visible "corrections".
        streamTextRef.current = "";
        finalFullTextRef.current = action.fullText;
        break;
      }

      case "stream_discard": {
        pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
        activeMessageIdRef.current = null;
        streamStartedRef.current = false;
        streamTextRef.current = "";
        pendingRevealTextRef.current = null;
        finalFullTextRef.current = null;
        revealedLenRef.current = 0;
        ttsRef.current.stop();

        setState((prev) => {
          const messages = [...prev.messages];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant") {
            messages.pop();
          }
          return { ...prev, messages, status: "idle" };
        });
        break;
      }

      case "discard":
        if (event === "tutor_message" || event === "exercise_feedback" || event === "tutor_chunk") {
          log("discarding", event);
        }
        break;
    }
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
          messages[messages.length - 1] = { ...last, text: last.text + " " + trimmed };
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
          messages[messages.length - 1] = { ...last, text: last.text + "..." };
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
    stopAllAudio: useCallback(() => { tts.stop(); }, [tts]),
    setUserSpeaking,
    debugInfo: {
      voiceId: voiceIdRef.current,
      speechSpeed: speechSpeedRef.current,
      ttsModel: ttsModelRef.current,
      systemPrompt: systemPromptRef.current,
    },
  };
}
