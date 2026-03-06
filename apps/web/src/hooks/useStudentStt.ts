"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { unlockAudio } from "./useAudioPlayer";
import { useCallbackRef } from "./useCallbackRef";
import { createLogger } from "./logger";
import { STT_CONFIG } from "@/lib/config";
import { api } from "@/lib/api";

interface UseStudentSttReturn {
  enable: () => void;
  disable: () => void;
  finalText: string;
  isEnabled: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  error: string | null;
}

interface UseStudentSttOptions {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onSegment?: (text: string) => void;
}

interface DeepgramResult {
  type: string;
  channel?: {
    alternatives?: { transcript?: string }[];
  };
  is_final?: boolean;
  speech_final?: boolean;
}

const log = createLogger("STT");

const DG_PARAMS = new URLSearchParams({
  model: STT_CONFIG.MODEL,
  language: STT_CONFIG.LANGUAGE,
  smart_format: String(STT_CONFIG.SMART_FORMAT),
  interim_results: String(STT_CONFIG.INTERIM_RESULTS),
  endpointing: String(STT_CONFIG.ENDPOINTING_MS),
  vad_events: String(STT_CONFIG.VAD_EVENTS),
}).toString();

export function useStudentStt(
  options?: UseStudentSttOptions,
): UseStudentSttReturn {
  const [finalText, setFinalText] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const enabledRef = useRef(false);
  const speechDetectedRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const segmentCountRef = useRef(0);
  const transcriptLengthRef = useRef(0);
  const onSpeechStartRef = useCallbackRef(options?.onSpeechStart);
  const onSpeechEndRef = useCallbackRef(options?.onSpeechEnd);
  const onSegmentRef = useCallbackRef(options?.onSegment);

  useEffect(() => {
    const supported = typeof navigator.mediaDevices.getUserMedia === "function";
    log("isSupported:", supported);
    setIsSupported(supported);
  }, []);

  const cleanup = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaRecorderRef.current = null;

    const ws = wsRef.current;
    if (ws) {
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
    }

    streamRef.current?.getTracks().forEach((t) => { t.stop(); });
    streamRef.current = null;
    speechDetectedRef.current = false;
  }, []);

  const startStreaming = useCallback(async () => {
    if (enabledRef.current) return;
    log("enable() called");
    setError(null);
    setFinalText("");

    try {
      const { key } = await api.stt.token();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Mic permission = user gesture — unlock audio playback
      unlockAudio();
      streamRef.current = stream;

      const ws = new WebSocket(`${STT_CONFIG.WS_URL}?${DG_PARAMS}`, ["token", key]);
      wsRef.current = ws;

      ws.onopen = () => {
        log("WebSocket connected to Deepgram");

        if (!stream.active || stream.getTracks().every((t) => t.readyState === "ended")) {
          log("stream is no longer active");
          setError("Microphone stream lost");
          cleanup();
          return;
        }

        const candidates = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/ogg;codecs=opus",
          undefined, // let the browser pick
        ];

        let recorder: MediaRecorder | null = null;
        for (const mime of candidates) {
          try {
            const opts = mime ? { mimeType: mime } : undefined;
            const r = new MediaRecorder(stream, opts);
            r.start(250);
            recorder = r;
            log("using mimeType:", r.mimeType || "(browser default)");
            break;
          } catch {
            log("mimeType failed:", mime ?? "(default)");
          }
        }

        if (!recorder) {
          log("all mimeTypes failed");
          setError("Your browser does not support audio recording");
          cleanup();
          return;
        }

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        mediaRecorderRef.current = recorder;
        setIsListening(true);
        log("streaming started");
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as DeepgramResult;

        if (msg.type === "SpeechStarted") {
          if (!speechDetectedRef.current) {
            speechDetectedRef.current = true;
            speechStartTimeRef.current = Date.now();
            segmentCountRef.current = 0;
            transcriptLengthRef.current = 0;
            log("speech started (Deepgram VAD)");
            onSpeechStartRef.current?.();
          }
          setIsProcessing(true);
          return;
        }

        if (msg.type === "Results") {
          const transcript: string =
            msg.channel?.alternatives?.[0]?.transcript ?? "";
          const isFinal: boolean = msg.is_final ?? false;
          const speechFinal: boolean = msg.speech_final ?? false;

          if (transcript) {
            setFinalText(transcript);
          }

          // is_final with text = confirmed segment → send to parent
          if (isFinal && transcript) {
            log("is_final segment:", transcript);
            segmentCountRef.current++;
            transcriptLengthRef.current += transcript.length;
            onSegmentRef.current?.(transcript);
            setFinalText("");
          }

          if (speechFinal) {
            log("speech_final:", transcript || "(empty)");
            const durationMs = Date.now() - speechStartTimeRef.current;
            api.stt.metrics({
              durationMs,
              transcriptLength: transcriptLengthRef.current,
              segments: segmentCountRef.current,
            }).catch(() => {});
            speechDetectedRef.current = false;
            setIsProcessing(false);
            onSpeechEndRef.current?.();
          }
        }
      };

      ws.onerror = () => {
        log("WebSocket error");
        setError("WebSocket connection error");
      };

      ws.onclose = (e) => {
        log("WebSocket closed:", e.code, e.reason);
        if (enabledRef.current) {
          enabledRef.current = false;
          setIsEnabled(false);
          setIsListening(false);
          setIsProcessing(false);
          setError("Connection lost");
          cleanup();
        }
      };

      enabledRef.current = true;
      setIsEnabled(true);
      log("continuous streaming enabled");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to access microphone";
      log("error:", message);
      setError(message);
      cleanup();
    }
  }, [cleanup, onSpeechStartRef, onSpeechEndRef, onSegmentRef]);

  const enable = useCallback(() => {
    void startStreaming();
  }, [startStreaming]);

  const disable = useCallback(() => {
    if (!enabledRef.current) return;
    log("disable() called");

    enabledRef.current = false;
    setIsEnabled(false);
    setIsListening(false);
    setIsProcessing(false);
    cleanup();

    log("continuous streaming disabled");
  }, [cleanup]);

  useEffect(() => {
    return () => {
      enabledRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    enable,
    disable,
    finalText,
    isEnabled,
    isListening,
    isProcessing,
    isSupported,
    error,
  };
}
