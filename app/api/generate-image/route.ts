import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getIp } from "@/app/lib/rate-limit";

export const maxDuration = 60;

const CACHE_MAX = 100; // base64 PNGs are ~1-2 MB each; cap memory use
const cache = new Map<string, string>();

function cacheSet(key: string, value: string) {
  if (cache.size >= CACHE_MAX) {
    cache.delete(cache.keys().next().value!);
  }
  cache.set(key, value);
}

export async function POST(request: NextRequest) {
  const { allowed, remaining, resetInMs } = checkRateLimit(getIp(request), "generate-image");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(resetInMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  let body: { name?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = body.name?.trim();
  const description = body.description?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing dish name." }, { status: 400 });
  }

  const cacheKey = name.toLowerCase();
  if (cache.has(cacheKey)) {
    return NextResponse.json({ b64_json: cache.get(cacheKey) });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured." },
      { status: 500 }
    );
  }

  const prompt = description
    ? `Professional food photography of ${name}: ${description}. Beautifully plated, studio lighting, shallow depth of field, appetizing, restaurant quality.`
    : `Professional food photography of ${name}. Beautifully plated, studio lighting, shallow depth of field, appetizing, restaurant quality.`;

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the OpenAI API." },
      { status: 502 }
    );
  }

  const data = await openaiRes.json();

  if (!openaiRes.ok) {
    const message: string = data?.error?.message ?? "Image generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const b64_json: string = data.data?.[0]?.b64_json;
  if (!b64_json) {
    return NextResponse.json(
      { error: "No image returned by the model." },
      { status: 500 }
    );
  }

  cacheSet(cacheKey, b64_json);
  return NextResponse.json(
    { b64_json },
    { headers: { "X-RateLimit-Remaining": String(remaining) } }
  );
}
