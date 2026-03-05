"use client";

import { useRef, useState, useCallback } from "react";
import { useCallbackRef } from "./useCallbackRef";
import { api } from "@/lib/api";
import { TTS_CONFIG } from "@/lib/config";

interface UseTutorTtsOptions {
  onPlayStart?: () => void;
  onAudioPlay?: (duration: number) => void;
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
  const audioQueueRef = useRef<Blob[]>([]);
  const playingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const optionsRef = useCallbackRef(options);

  const pendingTextRef = useRef<string[]>([]);
  const isStreamingRef = useRef(false);
  const wsReadyRef = useRef(false);
  const eosRequestedRef = useRef(false);
  const openGenRef = useRef(0);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onloadedmetadata = null;
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

    const blob = audioQueueRef.current.shift();
    if (!blob) return;
    cleanupAudio();

    const url = URL.createObjectURL(blob);
    urlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) {
        optionsRef.current?.onAudioPlay?.(audio.duration);
      }
    };

    audio.onended = () => {
      cleanupAudio();
      playNext();
    };
    audio.onerror = () => {
      log("audio playback error");
      cleanupAudio();
      playNext();
    };

    log(`playing chunk (${blob.size} bytes)`);
    audio.play().catch(() => {
      cleanupAudio();
      playNext();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupAudio]);

  const enqueueAudio = useCallback(
    (blob: Blob) => {
      audioQueueRef.current.push(blob);
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
    eosRequestedRef.current = false;
  }, []);

  const sendTextToWs = useCallback((text: string, flush: boolean) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: text + " ", flush }));
      log("sent text:", text.slice(0, 50));
    } else {
      log("sendTextToWs: WS not open, skipping");
    }
  }, []);

  const sendEos = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: "" }));
      log("sent EOS");
    } else {
      log("sendEos: WS not open, skipping");
    }
  }, []);

  const openWs = useCallback(
    async (voiceId: string, speechSpeed: number, onReady: () => void) => {
      // Close any existing WS before opening a new one
      closeWs();
      const gen = ++openGenRef.current;

      try {
        const { token } = await api.tts.token();
        if (openGenRef.current !== gen) {
          log("openWs cancelled (stop() called during token fetch)");
          return;
        }
        log("got single-use token");

        const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${TTS_CONFIG.MODEL}&output_format=${TTS_CONFIG.OUTPUT_FORMAT}&single_use_token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const audioChunks: BlobPart[] = [];

        const decodeBase64 = (b64: string): ArrayBuffer => {
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes.buffer;
        };

        const flushAudio = () => {
          if (audioChunks.length > 0) {
            const blob = new Blob(audioChunks, { type: "audio/mpeg" });
            log("enqueuing audio blob:", blob.size, "bytes");
            enqueueAudio(blob);
            audioChunks.length = 0;
          }
        };

        ws.onopen = () => {
          log("WS connected to ElevenLabs");
          ws.send(
            JSON.stringify({
              text: " ",
              voice_settings: TTS_CONFIG.VOICE_SETTINGS,
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
            message?: string;
            error?: string;
          };

          if (msg.error) log("WS error from server:", msg.error);
          if (msg.message) log("WS server message:", msg.message);

          if (msg.audio) {
            audioChunks.push(decodeBase64(msg.audio));
            log("received audio chunk:", msg.audio.length, "chars, isFinal:", msg.isFinal);
          } else {
            log("received message (no audio), isFinal:", msg.isFinal);
          }

          if (msg.isFinal) {
            flushAudio();
            // Close this specific WS instance (not whatever is in wsRef)
            ws.onmessage = null;
            ws.onerror = null;
            ws.onclose = null;
            ws.close();
            if (wsRef.current === ws) {
              wsRef.current = null;
              wsReadyRef.current = false;
            }
          }
        };

        ws.onerror = () => {
          log("WS error");
          if (wsRef.current === ws) {
            closeWs();
          }
        };

        ws.onclose = (event) => {
          log("WS closed, code:", event.code, "reason:", event.reason || "(none)");
          // If server closed before isFinal, flush any buffered audio
          flushAudio();
          if (wsRef.current === ws) {
            wsRef.current = null;
            wsReadyRef.current = false;
          }
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
      eosRequestedRef.current = false;

      void openWs(voiceId, speechSpeed ?? 1.0, () => {
        for (const text of pendingTextRef.current) {
          sendTextToWs(text, true);
        }
        pendingTextRef.current = [];

        // If endStream() was called while WS was still connecting, send EOS now
        if (eosRequestedRef.current) {
          log("sending deferred EOS");
          sendEos();
          eosRequestedRef.current = false;
        }
      });
    },
    [openWs, sendTextToWs, sendEos],
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
    } else {
      log("WS not ready, deferring EOS");
      eosRequestedRef.current = true;
    }
  }, [sendEos]);

  /** Stop everything — close WS, stop audio. */
  const stop = useCallback(() => {
    log("stop");
    isStreamingRef.current = false;
    openGenRef.current++;
    closeWs();
    audioQueueRef.current = [];
    cleanupAudio();
    playingRef.current = false;
    setIsSpeaking(false);
  }, [closeWs, cleanupAudio]);

  return { speak, startStream, sendChunk, endStream, stop, isSpeaking };
}
