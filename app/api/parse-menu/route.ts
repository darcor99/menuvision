import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getIp } from "@/app/lib/rate-limit";
import type { Dish } from "@/app/types/menu";

export const maxDuration = 30;

const BASE_PROMPT = `You are a menu parsing assistant. Given raw OCR text from a restaurant menu, extract every dish.

Output line-delimited JSON — each line must be a complete, standalone JSON object. No arrays, no markdown, no commentary.

Line 1 (always, even if the name is not found): {"restaurant_name": <string or null>}
Then one line per dish:
{"name": ..., "original_language_name": ..., "english_name": ..., "short_description": ..., "key_ingredients": [...], "price": ...}

Field rules:
- name: dish name exactly as it appears on the menu
- original_language_name: original text if the name is non-English, otherwise null
- english_name: English translation (may equal name if already English)
- short_description: one concise sentence, max 14 words
- key_ingredients: up to 4 main ingredients
- price: price as printed (e.g. "12.50" or "$12.50"); null if not visible

Output only raw NDJSON lines. No wrapping, no explanation.`;

function buildPrompt(location?: string) {
  if (!location) return BASE_PROMPT;
  return (
    BASE_PROMPT +
    `\n\nContext: the user is at a restaurant in ${location}. ` +
    `Use this to improve dish name translations, identify regional specialities, ` +
    `and describe local ingredients or cooking styles accurately.`
  );
}

function normalizeDish(raw: Record<string, unknown>): Dish {
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    original_language_name:
      typeof raw.original_language_name === "string"
        ? raw.original_language_name
        : null,
    english_name:
      typeof raw.english_name === "string" ? raw.english_name : "",
    short_description:
      typeof raw.short_description === "string" ? raw.short_description : "",
    key_ingredients: Array.isArray(raw.key_ingredients)
      ? (raw.key_ingredients as unknown[]).filter(
          (x): x is string => typeof x === "string"
        )
      : [],
    price: typeof raw.price === "string" ? raw.price : null,
  };
}

type ParsedLine =
  | { restaurant_name: string | null }
  | Dish;

function tryParseLine(line: string): ParsedLine | null {
  try {
    const raw = JSON.parse(line) as Record<string, unknown>;
    if ("restaurant_name" in raw) {
      const n = raw.restaurant_name;
      return {
        restaurant_name:
          typeof n === "string" && n !== "null" && n !== "" ? n : null,
      };
    }
    if (typeof raw.name === "string") {
      return normalizeDish(raw);
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { allowed, remaining, resetInMs } = checkRateLimit(
    getIp(request),
    "parse-menu"
  );
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

  let body: { text?: string; location?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "No OCR text provided." }, { status: 400 });
  }

  const location = body.location?.trim() || undefined;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured." },
      { status: 500 }
    );
  }

  let openaiRes: Response;
  try {
    openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        stream: true,
        messages: [
          { role: "system", content: buildPrompt(location) },
          { role: "user", content: text },
        ],
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the OpenAI API. Check your network." },
      { status: 502 }
    );
  }

  if (!openaiRes.ok) {
    const errData = await openaiRes.json();
    const message: string =
      errData?.error?.message ?? "OpenAI API returned an error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const encoder = new TextEncoder();

  const outStream = new ReadableStream({
    async start(controller) {
      try {
        const reader = openaiRes.body!.getReader();
        const sseDecoder = new TextDecoder();
        let sseBuffer = "";  // raw SSE bytes
        let lineBuffer = ""; // accumulated model content between newlines

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += sseDecoder.decode(value, { stream: true });

          const sseLines = sseBuffer.split("\n");
          sseBuffer = sseLines.pop() ?? "";

          for (const sseLine of sseLines) {
            if (!sseLine.startsWith("data: ")) continue;
            const data = sseLine.slice(6).trim();
            if (data === "[DONE]") continue;

            let chunk: { choices?: { delta?: { content?: string } }[] };
            try {
              chunk = JSON.parse(data);
            } catch {
              continue;
            }

            const content = chunk.choices?.[0]?.delta?.content ?? "";
            if (!content) continue;

            lineBuffer += content;

            // Flush every complete line to the client
            const parts = lineBuffer.split("\n");
            lineBuffer = parts.pop() ?? "";

            for (const part of parts) {
              const trimmed = part.trim();
              if (!trimmed) continue;
              const parsed = tryParseLine(trimmed);
              if (parsed) {
                controller.enqueue(
                  encoder.encode(JSON.stringify(parsed) + "\n")
                );
              }
            }
          }
        }

        // Flush any content not terminated by a newline
        if (lineBuffer.trim()) {
          const parsed = tryParseLine(lineBuffer.trim());
          if (parsed) {
            controller.enqueue(encoder.encode(JSON.stringify(parsed) + "\n"));
          }
        }
      } catch {
        // Stream error — close cleanly so the client renders whatever arrived
      } finally {
        controller.close();
      }
    },
  });

  return new Response(outStream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-RateLimit-Remaining": String(remaining),
    },
  });
}
