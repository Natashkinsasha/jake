"use client";

import { useRef, useState, useCallback } from "react";
import { useCallbackRef } from "./useCallbackRef";
import { api } from "@/lib/api";
import { TTS_CONFIG } from "@/lib/config";

interface UseTutorTtsOptions {
  onPlayStart?: () => void;
  onAllDone?: () => void;
}

interface UseTutorTtsReturn {
  speak: (text: string, voiceId: string, speechSpeed?: number) => void;
  startStream: (voiceId: string, speechSpeed?: number) => void;
  sendChunk: (text: string) => void;
  endStream: () => void;
  stop: () => void;
  isSpeaking: boolean;
}

const log = (...args: unknown[]) => {
  console.log("[TTS]", ...args);
};

export function useTutorTts(options?: UseTutorTtsOptions): UseTutorTtsReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const optionsRef = useCallbackRef(options);

  const pendingTextRef = useRef<string[]>([]);
  const isStreamingRef = useRef(false);
  const wsReadyRef = useRef(false);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const playNext = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      playingRef.current = false;
      setIsSpeaking(false);
      log("all audio done");
      optionsRef.current?.onAllDone?.();
      return;
    }

    const base64 = audioQueueRef.current.shift();
    if (!base64) return;
    cleanupAudio();

    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        cleanupAudio();
        playNext();
      };
      audio.onerror = () => {
        cleanupAudio();
        playNext();
      };

      log(`playing chunk (${blob.size} bytes)`);
      audio.play().catch(() => {
        cleanupAudio();
        playNext();
      });
    } catch {
      log("decode error");
      playNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupAudio]);

  const enqueueAudio = useCallback(
    (base64: string) => {
      audioQueueRef.current.push(base64);
      if (!playingRef.current) {
        playingRef.current = true;
        setIsSpeaking(true);
        optionsRef.current?.onPlayStart?.();
        playNext();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [playNext],
  );

  const closeWs = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    }
    wsReadyRef.current = false;
    pendingTextRef.current = [];
  }, []);

  const sendTextToWs = useCallback((text: string, flush: boolean) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: text + " ", flush }));
      log("sent text:", text.slice(0, 50));
    }
  }, []);

  const sendEos = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: "" }));
      log("sent EOS");
    }
  }, []);

  const openWs = useCallback(
    async (voiceId: string, speechSpeed: number, onReady: () => void) => {
      try {
        const { token } = await api.tts.token();

        const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${TTS_CONFIG.MODEL}&output_format=${TTS_CONFIG.OUTPUT_FORMAT}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        let audioBuffer = "";

        ws.onopen = () => {
          log("WS connected to ElevenLabs");
          ws.send(
            JSON.stringify({
              text: " ",
              voice_settings: TTS_CONFIG.VOICE_SETTINGS,
              xi_api_key: token,
              generation_config: { chunk_length_schedule: [120] },
              ...(speechSpeed !== 1.0 ? { speed: speechSpeed } : {}),
            }),
          );
          wsReadyRef.current = true;
          onReady();
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data as string) as {
            audio?: string;
            isFinal?: boolean;
          };
          if (msg.audio) {
            audioBuffer += msg.audio;
          }
          if (msg.isFinal) {
            if (audioBuffer) {
              enqueueAudio(audioBuffer);
              audioBuffer = "";
            }
            closeWs();
          }
        };

        ws.onerror = () => {
          log("WS error");
          closeWs();
        };
        ws.onclose = () => {
          log("WS closed");
          wsRef.current = null;
          wsReadyRef.current = false;
        };
      } catch (error) {
        log("failed to open TTS WS:", error);
        closeWs();
      }
    },
    [enqueueAudio, closeWs],
  );

  /** Speak a single message (greeting, exercise feedback). Opens WS, sends text, closes. */
  const speak = useCallback(
    (text: string, voiceId: string, speechSpeed?: number) => {
      if (!text.trim()) return;
      log("speak:", text.slice(0, 50), "voiceId:", voiceId);

      void openWs(voiceId, speechSpeed ?? 1.0, () => {
        sendTextToWs(text, true);
        sendEos();
      });
    },
    [openWs, sendTextToWs, sendEos],
  );

  /** Start a streaming TTS session. Call sendChunk() for each sentence, then endStream(). */
  const startStream = useCallback(
    (voiceId: string, speechSpeed?: number) => {
      log("startStream, voiceId:", voiceId);
      isStreamingRef.current = true;
      pendingTextRef.current = [];

      void openWs(voiceId, speechSpeed ?? 1.0, () => {
        for (const text of pendingTextRef.current) {
          sendTextToWs(text, true);
        }
        pendingTextRef.current = [];
      });
    },
    [openWs, sendTextToWs],
  );

  /** Send a text chunk (sentence) during a streaming session. */
  const sendChunk = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      if (wsReadyRef.current) {
        sendTextToWs(text, true);
      } else {
        pendingTextRef.current.push(text);
      }
    },
    [sendTextToWs],
  );

  /** End the streaming session. */
  const endStream = useCallback(() => {
    log("endStream");
    isStreamingRef.current = false;

    if (wsReadyRef.current) {
      sendEos();
    }
  }, [sendEos]);

  /** Stop everything — close WS, stop audio. */
  const stop = useCallback(() => {
    log("stop");
    isStreamingRef.current = false;
    closeWs();
    audioQueueRef.current = [];
    cleanupAudio();
    playingRef.current = false;
    setIsSpeaking(false);
  }, [closeWs, cleanupAudio]);

  return { speak, startStream, sendChunk, endStream, stop, isSpeaking };
}
