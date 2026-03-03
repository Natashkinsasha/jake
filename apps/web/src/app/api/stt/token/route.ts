import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = `stt-token:${session.user?.email ?? "unknown"}`;
  const { allowed } = rateLimit(key, 10, 10 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY not configured" },
      { status: 500 }
    );
  }

  const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: 300 }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Deepgram grant API error:", response.status, errorText);
    return NextResponse.json(
      { error: `Deepgram API error: ${response.status}` },
      { status: 502 }
    );
  }

  const data = await response.json();

  return NextResponse.json({ key: data.access_token });
}
