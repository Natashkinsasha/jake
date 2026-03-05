"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useCallbackRef } from "./useCallbackRef";
import { api } from "@/lib/api";
import { TTS_CONFIG } from "@/lib/config";
import { createLogger } from "./logger";

interface UseTutorTtsOptions {
  onAllDone?: () => void;
  onPlaybackStart?: () => void;
  onPlaybackProgress?: (playedSeconds: number, totalDecodedSeconds: number, allReceived: boolean) => void;
}

interface UseTutorTtsReturn {
  speak: (text: string, voiceId: string, speechSpeed?: number) => void;
  preWarm: (voiceId: string, speechSpeed?: number) => void;
  startStream: (voiceId: string, speechSpeed?: number) => void;
  sendChunk: (text: string) => void;
  endStream: () => void;
  stop: () => void;
  isSpeaking: boolean;
}

const log = createLogger("TTS");

export function useTutorTts(options?: UseTutorTtsOptions): UseTutorTtsReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useCallbackRef(options);

  // AudioContext gapless playback (pre-decode + sequential play)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const decodedQueueRef = useRef<AudioBuffer[]>([]);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playingRef = useRef(false);
  const pendingDecodesRef = useRef(0);
  const allReceivedRef = useRef(false);
  const audioGenRef = useRef(0);

  // Playback progress tracking
  const totalDecodedDurRef = useRef(0);
  const playedDurRef = useRef(0);
  const bufStartCtxTimeRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pendingTextRef = useRef<string[]>([]);
  const isStreamingRef = useRef(false);
  const wsReadyRef = useRef(false);
  const eosRequestedRef = useRef(false);
  const openGenRef = useRef(0);
  const connectingRef = useRef(false);


  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const checkDone = useCallback(() => {
    if (
      allReceivedRef.current &&
      pendingDecodesRef.current === 0 &&
      decodedQueueRef.current.length === 0 &&
      !currentSourceRef.current
    ) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      playingRef.current = false;
      totalDecodedDurRef.current = 0;
      playedDurRef.current = 0;
      setIsSpeaking(false);
      allReceivedRef.current = false;
      log("all audio done");
      optionsRef.current?.onAllDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playNextBuffer = useCallback(() => {
    if (decodedQueueRef.current.length === 0) {
      currentSourceRef.current = null;
      checkDone();
      return;
    }

    const audioBuffer = decodedQueueRef.current.shift();
    if (!audioBuffer) return;
    const ctx = ensureAudioCtx();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
    currentSourceRef.current = source;
    bufStartCtxTimeRef.current = ctx.currentTime;

    // Start progress reporting on first buffer
    if (!progressTimerRef.current) {
      optionsRef.current?.onPlaybackStart?.();
      progressTimerRef.current = setInterval(() => {
        const c = audioCtxRef.current;
        if (!c || !currentSourceRef.current) return;
        const elapsed = c.currentTime - bufStartCtxTimeRef.current;
        optionsRef.current?.onPlaybackProgress?.(
          playedDurRef.current + elapsed,
          totalDecodedDurRef.current,
          allReceivedRef.current,
        );
      }, 60);
    }

    log(`playing chunk (${Math.round(audioBuffer.duration * 1000)}ms)`);

    source.onended = () => {
      if (currentSourceRef.current === source) {
        currentSourceRef.current = null;
      }
      playedDurRef.current += audioBuffer.duration;
      playNextBuffer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureAudioCtx, checkDone]);

  const enqueueAudio = useCallback(
    (blob: Blob) => {
      if (!playingRef.current) {
        playingRef.current = true;
        setIsSpeaking(true);
      }

      const gen = audioGenRef.current;
      pendingDecodesRef.current++;
      const ctx = ensureAudioCtx();

      void blob
        .arrayBuffer()
        .then((buf) => ctx.decodeAudioData(buf))
        .then((audioBuffer) => {
          if (audioGenRef.current !== gen) return;
          pendingDecodesRef.current--;
          totalDecodedDurRef.current += audioBuffer.duration;
          decodedQueueRef.current.push(audioBuffer);
          if (!currentSourceRef.current) {
            playNextBuffer();
          }
        })
        .catch((err: unknown) => {
          if (audioGenRef.current !== gen) return;
          log("audio decode error:", err);
          pendingDecodesRef.current--;
          checkDone();
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ensureAudioCtx, playNextBuffer, checkDone],
  );

  const stopAudio = useCallback(() => {
    audioGenRef.current++;
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {
        // Already stopped
      }
      currentSourceRef.current = null;
    }
    decodedQueueRef.current = [];
    pendingDecodesRef.current = 0;
    allReceivedRef.current = false;
    playingRef.current = false;
    totalDecodedDurRef.current = 0;
    playedDurRef.current = 0;
    setIsSpeaking(false);
  }, []);

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
    connectingRef.current = false;
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
      connectingRef.current = true;
      const gen = ++openGenRef.current;

      try {
        const { token } = await api.tts.token();
        if (openGenRef.current !== gen) {
          log("openWs cancelled (stop() called during token fetch)");
          connectingRef.current = false;
          return;
        }
        log("got single-use token");

        const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${TTS_CONFIG.MODEL}&output_format=${TTS_CONFIG.OUTPUT_FORMAT}&single_use_token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const decodeBase64 = (b64: string): ArrayBuffer => {
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes.buffer;
        };

        ws.onopen = () => {
          connectingRef.current = false;
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

          // Flush any text buffered by sendChunk() before WS was ready
          for (const text of pendingTextRef.current) {
            sendTextToWs(text, false);
          }
          pendingTextRef.current = [];

          if (eosRequestedRef.current) {
            sendEos();
            eosRequestedRef.current = false;
          }

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
            const buf = decodeBase64(msg.audio);
            log("received audio chunk:", buf.byteLength, "bytes, isFinal:", msg.isFinal);
            // Skip tiny chunks that aren't valid MP3 frames
            if (buf.byteLength > 200) {
              const blob = new Blob([buf], { type: "audio/mpeg" });
              enqueueAudio(blob);
            }
          } else {
            log("received message (no audio), isFinal:", msg.isFinal);
          }

          if (msg.isFinal) {
            allReceivedRef.current = true;
            // Close this specific WS instance (not whatever is in wsRef)
            ws.onmessage = null;
            ws.onerror = null;
            ws.onclose = null;
            ws.close();
            if (wsRef.current === ws) {
              wsRef.current = null;
              wsReadyRef.current = false;
            }
            checkDone();
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
          if (wsRef.current === ws) {
            wsRef.current = null;
            wsReadyRef.current = false;
          }
          // Safety net: if WS closed without isFinal (server crash, network drop),
          // mark as received so checkDone can finalize playback
          if (!allReceivedRef.current) {
            allReceivedRef.current = true;
            checkDone();
          }
        };
      } catch (error) {
        log("failed to open TTS WS:", error);
        connectingRef.current = false;
        closeWs();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enqueueAudio, closeWs, sendTextToWs, sendEos, checkDone],
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

  /** Pre-warm: fetch token + open WS to ElevenLabs before first chunk arrives. */
  const preWarm = useCallback(
    (voiceId: string, speechSpeed?: number) => {
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      if (wsRef.current || connectingRef.current) return;
      log("preWarm");
      void openWs(voiceId, speechSpeed ?? 1.0, () => {});
    },
    [openWs],
  );

  /** Start a streaming TTS session. Call sendChunk() for each sentence, then endStream(). */
  const startStream = useCallback(
    (voiceId: string, speechSpeed?: number) => {
      log("startStream, voiceId:", voiceId);
      isStreamingRef.current = true;
      eosRequestedRef.current = false;

      // If WS already exists or token fetch in progress (pre-warmed), reuse it
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      if (wsRef.current || connectingRef.current) {
        log("startStream: reusing pre-warmed WS");
        return;
      }

      // No pre-warm, open normally
      pendingTextRef.current = [];
      void openWs(voiceId, speechSpeed ?? 1.0, () => {});
    },
    [openWs],
  );

  /** Send a text chunk (sentence) during a streaming session. No flush — let ElevenLabs maintain consistent prosody. */
  const sendChunk = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      if (wsReadyRef.current) {
        sendTextToWs(text, false);
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
    stopAudio();
  }, [closeWs, stopAudio]);

  useEffect(() => {
    return () => {
      void audioCtxRef.current?.close();
    };
  }, []);

  return { speak, preWarm, startStream, sendChunk, endStream, stop, isSpeaking };
}
