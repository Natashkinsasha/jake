"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { unlockAudio } from "./useAudioPlayer";

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
}

const log = (...args: unknown[]) => console.log("[STT]", ...args);

const DG_WS_URL = "wss://api.deepgram.com/v1/listen";
const DG_PARAMS = new URLSearchParams({
  model: "nova-3",
  language: "en",
  smart_format: "true",
  interim_results: "true",
  endpointing: "800",
  vad_events: "true",
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
  const onSpeechStartRef = useRef(options?.onSpeechStart);
  onSpeechStartRef.current = options?.onSpeechStart;

  useEffect(() => {
    const supported = !!navigator.mediaDevices?.getUserMedia;
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

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    speechDetectedRef.current = false;
  }, []);

  const enable = useCallback(async () => {
    if (enabledRef.current) return;
    log("enable() called");
    setError(null);
    setFinalText("");

    try {
      const tokenRes = await fetch("/api/stt/token");
      if (!tokenRes.ok) throw new Error("Failed to get STT token");
      const { key } = await tokenRes.json();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Mic permission = user gesture — unlock audio playback
      unlockAudio();
      streamRef.current = stream;

      const ws = new WebSocket(`${DG_WS_URL}?${DG_PARAMS}`, ["token", key]);
      wsRef.current = ws;

      ws.onopen = () => {
        log("WebSocket connected to Deepgram");

        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm",
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start(250);
        setIsListening(true);
        log("streaming started");
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "SpeechStarted") {
          if (!speechDetectedRef.current) {
            speechDetectedRef.current = true;
            log("speech started (Deepgram VAD)");
            onSpeechStartRef.current?.();
          }
          setIsProcessing(true);
          return;
        }

        if (msg.type === "Results") {
          const transcript =
            msg.channel?.alternatives?.[0]?.transcript ?? "";
          const isFinal = msg.is_final;
          const speechFinal = msg.speech_final;

          if (transcript) {
            setFinalText(transcript);
          }

          if (speechFinal) {
            log("speech_final:", transcript);
            speechDetectedRef.current = false;
            setIsProcessing(false);
          } else if (isFinal && transcript) {
            log("is_final segment:", transcript);
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
  }, [cleanup]);

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
