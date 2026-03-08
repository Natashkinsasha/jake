"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useCallbackRef } from "./useCallbackRef";
import { createLogger } from "./logger";
import { api } from "@/lib/api";
import { TTS_CONFIG } from "@/lib/config";

function pcmToAudioBuffer(ctx: AudioContext, raw: ArrayBuffer): AudioBuffer {
  const int16 = new Int16Array(raw);
  const audioBuffer = ctx.createBuffer(1, int16.length, TTS_CONFIG.SAMPLE_RATE);
  const channel = audioBuffer.getChannelData(0);

  const fadeSamples = Math.min(
    Math.floor((TTS_CONFIG.CROSSFADE_MS / 1000) * TTS_CONFIG.SAMPLE_RATE),
    Math.floor(int16.length / 2),
  );

  for (const [i, sample] of int16.entries()) {
    let gain = 1;
    if (i < fadeSamples) {
      gain = i / fadeSamples;
    } else if (i >= int16.length - fadeSamples) {
      gain = (int16.length - 1 - i) / fadeSamples;
    }
    channel[i] = (sample / 32768) * gain;
  }

  return audioBuffer;
}

interface UseTutorTtsOptions {
  onAllDone?: () => void;
  onPlaybackStart?: () => void;
  onPlaybackProgress?: (playedSeconds: number, totalDecodedSeconds: number, allReceived: boolean) => void;
  onError?: (message: string) => void;
}

type VoiceSettingsOverride = { stability: number; similarity_boost: number; style: number };

interface UseTutorTtsReturn {
  speak: (text: string, voiceId: string, speechSpeed?: number, model?: string, voiceSettings?: VoiceSettingsOverride) => void;
  preWarm: (voiceId: string, speechSpeed?: number, model?: string) => void;
  startStream: (voiceId: string, speechSpeed?: number, model?: string, voiceSettings?: VoiceSettingsOverride) => void;
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

  // AudioContext gapless playback (pre-decode + scheduled play)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const decodedQueueRef = useRef<AudioBuffer[]>([]);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const playingRef = useRef(false);
  const allReceivedRef = useRef(false);
  const audioGenRef = useRef(0);

  // Playback progress tracking
  const totalDecodedDurRef = useRef(0);
  const playedDurRef = useRef(0);
  const batchStartTimeRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pendingTextRef = useRef<string[]>([]);
  const isStreamingRef = useRef(false);
  const wsReadyRef = useRef(false);
  const eosRequestedRef = useRef(false);
  const openGenRef = useRef(0);
  const connectingRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const preBufferMetRef = useRef(false);


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
      decodedQueueRef.current.length === 0 &&
      !currentSourceRef.current
    ) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      playingRef.current = false;
      preBufferMetRef.current = false;
      scheduledSourcesRef.current = [];
      totalDecodedDurRef.current = 0;
      playedDurRef.current = 0;
      setIsSpeaking(false);
      allReceivedRef.current = false;
      log("all audio done");
      optionsRef.current?.onAllDone?.();
    }
  }, [optionsRef]);

  const scheduleBuffers = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    while (decodedQueueRef.current.length > 0) {
      const audioBuffer = decodedQueueRef.current.shift();
      if (!audioBuffer) break;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;
      currentSourceRef.current = source;
      scheduledSourcesRef.current.push(source);

      // Start progress reporting on first buffer
      if (!progressTimerRef.current) {
        batchStartTimeRef.current = startTime;
        optionsRef.current?.onPlaybackStart?.();
        progressTimerRef.current = setInterval(() => {
          const c = audioCtxRef.current;
          if (!c) return;
          const elapsed = c.currentTime - batchStartTimeRef.current;
          optionsRef.current?.onPlaybackProgress?.(
            Math.max(0, elapsed),
            totalDecodedDurRef.current,
            allReceivedRef.current,
          );
        }, 60);
      }

      log(`scheduled chunk (${Math.round(audioBuffer.duration * 1000)}ms) at ${startTime.toFixed(3)}`);

      source.onended = () => {
        scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== source);
        if (currentSourceRef.current === source) {
          currentSourceRef.current = null;
        }
        playedDurRef.current += audioBuffer.duration;
        checkDone();
      };
    }
  }, [checkDone, optionsRef]);

  const enqueueAudio = useCallback(
    (raw: ArrayBuffer) => {
      if (!playingRef.current) {
        playingRef.current = true;
        setIsSpeaking(true);
      }

      const ctx = ensureAudioCtx();

      try {
        const audioBuffer = pcmToAudioBuffer(ctx, raw);
        totalDecodedDurRef.current += audioBuffer.duration;
        decodedQueueRef.current.push(audioBuffer);

        // Pre-buffer: wait until we have enough audio before starting playback
        if (!preBufferMetRef.current) {
          const queuedDuration = decodedQueueRef.current.reduce((sum, b) => sum + b.duration, 0);
          if (queuedDuration < TTS_CONFIG.PRE_BUFFER_MS / 1000 && !allReceivedRef.current) {
            return;
          }
          preBufferMetRef.current = true;
          nextStartTimeRef.current = ctx.currentTime;
        }

        scheduleBuffers();
      } catch (err: unknown) {
        log("PCM decode error:", err);
        checkDone();
      }
    },
    [ensureAudioCtx, scheduleBuffers, checkDone],
  );

  const stopAudio = useCallback(() => {
    audioGenRef.current++;
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    for (const source of scheduledSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    }
    scheduledSourcesRef.current = [];
    currentSourceRef.current = null;
    decodedQueueRef.current = [];
    allReceivedRef.current = false;
    playingRef.current = false;
    preBufferMetRef.current = false;
    nextStartTimeRef.current = 0;
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
    async (voiceId: string, speechSpeed: number, onReady: () => void, model?: string, voiceSettings?: VoiceSettingsOverride) => {
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

        const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=${model ?? TTS_CONFIG.MODEL}&output_format=${TTS_CONFIG.OUTPUT_FORMAT}&single_use_token=${token}`;
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
              voice_settings: voiceSettings ?? TTS_CONFIG.VOICE_SETTINGS,
              generation_config: { chunk_length_schedule: TTS_CONFIG.CHUNK_LENGTH_SCHEDULE },
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
            enqueueAudio(buf);
          } else {
            log("received message (no audio), isFinal:", msg.isFinal);
          }

          if (msg.isFinal) {
            allReceivedRef.current = true;
            // Flush pre-buffer if it hasn't been met yet (short messages)
            if (!preBufferMetRef.current && decodedQueueRef.current.length > 0) {
              preBufferMetRef.current = true;
              const ctx = audioCtxRef.current;
              if (ctx) {
                nextStartTimeRef.current = ctx.currentTime;
                scheduleBuffers();
              }
            }
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
          optionsRef.current?.onError?.("Voice temporarily unavailable");
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
        optionsRef.current?.onError?.("Voice temporarily unavailable");
        closeWs();
      }
    },
    [enqueueAudio, closeWs, sendTextToWs, sendEos, checkDone, scheduleBuffers, optionsRef],
  );

  /** Speak a single message (greeting, exercise feedback). Opens WS, sends text, closes. */
  const speak = useCallback(
    (text: string, voiceId: string, speechSpeed?: number, model?: string, voiceSettings?: VoiceSettingsOverride) => {
      if (!text.trim()) return;
      log("speak:", text.slice(0, 50), "voiceId:", voiceId);

      void openWs(voiceId, speechSpeed ?? 1.0, () => {
        sendTextToWs(text, true);
        sendEos();
      }, model, voiceSettings);
    },
    [openWs, sendTextToWs, sendEos],
  );

  /** Pre-warm: fetch token + open WS to ElevenLabs before first chunk arrives. */
  const preWarm = useCallback(
    (voiceId: string, speechSpeed?: number, model?: string) => {
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      if (wsRef.current || connectingRef.current) return;
      log("preWarm");
      void openWs(voiceId, speechSpeed ?? 1.0, () => {}, model);
    },
    [openWs],
  );

  /** Start a streaming TTS session. Call sendChunk() for each sentence, then endStream(). */
  const startStream = useCallback(
    (voiceId: string, speechSpeed?: number, model?: string, voiceSettings?: VoiceSettingsOverride) => {
      log("startStream, voiceId:", voiceId);
      isStreamingRef.current = true;
      eosRequestedRef.current = false;

      // Stop any audio still playing from a previous stream/speak call.
      // Without this, old AudioBufferSourceNode.onended callbacks fire checkDone()
      // with stale allReceivedRef=true, triggering onAllDone prematurely.
      stopAudio();

      // If voice settings provided, close pre-warmed WS (it has default settings)
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      if (voiceSettings && (wsRef.current || connectingRef.current)) {
        log("startStream: closing pre-warmed WS for emotion-specific settings");
        closeWs();
      }

      // If WS already exists or token fetch in progress (pre-warmed), reuse it
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      if (wsRef.current || connectingRef.current) {
        log("startStream: reusing pre-warmed WS");
        return;
      }

      // No pre-warm, open normally
      pendingTextRef.current = [];
      void openWs(voiceId, speechSpeed ?? 1.0, () => {}, model, voiceSettings);
    },
    [openWs, closeWs, stopAudio],
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
