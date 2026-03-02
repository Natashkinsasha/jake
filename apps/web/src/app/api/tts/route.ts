import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_TEXT_LENGTH = 2000;

interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

function computeWordBoundaries(alignment: ElevenLabsAlignment): WordTiming[] {
  const words: WordTiming[] = [];
  let currentWord = "";
  let wordStart = -1;
  let wordEnd = -1;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];
    const start = alignment.character_start_times_seconds[i];
    const end = alignment.character_end_times_seconds[i];

    if (char === " " || char === "\n" || char === "\t") {
      if (currentWord) {
        words.push({ word: currentWord, startTime: wordStart, endTime: wordEnd });
        currentWord = "";
        wordStart = -1;
        wordEnd = -1;
      }
    } else {
      if (wordStart === -1) {
        wordStart = start;
      }
      wordEnd = end;
      currentWord += char;
    }
  }

  if (currentWord) {
    words.push({ word: currentWord, startTime: wordStart, endTime: wordEnd });
  }

  return words;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { text, voiceId = "onwK4e9ZLuTAKqWW03F9" } = body;

  if (!text || typeof text !== "string") {
    return NextResponse.json(
      { error: "text is required" },
      { status: 400 }
    );
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` },
      { status: 400 }
    );
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("ElevenLabs API error:", response.status, errorText);
    return NextResponse.json(
      { error: `ElevenLabs API error: ${response.status}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  const audioBase64: string = data.audio_base64;
  const alignment: ElevenLabsAlignment = data.alignment;
  const words = computeWordBoundaries(alignment);

  return NextResponse.json({ audioBase64, words });
}
