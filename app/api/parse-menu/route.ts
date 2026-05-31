import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getIp } from "@/app/lib/rate-limit";
import type { Dish } from "@/app/types/menu";

export const maxDuration = 30;

const BASE_PROMPT = `You are a menu parsing assistant. Given raw OCR text from a restaurant menu, extract every dish and return a JSON object.

Return this exact shape: { "dishes": Dish[] }

Each Dish object must have:
- name: string — dish name exactly as it appears on the menu
- original_language_name: string | null — original text if the name is non-English, otherwise null
- english_name: string — English name or translation (may equal name if already English)
- short_description: string — one sentence describing what this dish actually is
- key_ingredients: string[] — up to 6 main ingredients
- price: string | null — price as printed (e.g. "12.50" or "$12.50"); null if not visible

Only output valid JSON. No markdown, no commentary.`;

function buildPrompt(location?: string) {
  if (!location) return BASE_PROMPT;
  return (
    BASE_PROMPT +
    `\n\nContext: the user is at a restaurant in ${location}. ` +
    `Use this to improve dish name translations, identify regional specialities, ` +
    `and describe local ingredients or cooking styles accurately.`
  );
}

export async function POST(request: NextRequest) {
  const { allowed, remaining, resetInMs } = checkRateLimit(getIp(request), "parse-menu");
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
        response_format: { type: "json_object" },
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

  const data = await openaiRes.json();

  if (!openaiRes.ok) {
    const message: string = data?.error?.message ?? "OpenAI API returned an error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let parsed: { dishes: Dish[] };
  try {
    const content: string = data.choices[0].message.content;
    parsed = JSON.parse(content);
    if (!Array.isArray(parsed.dishes)) throw new Error();
  } catch {
    return NextResponse.json(
      { error: "Could not parse the model response as a dish list." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { dishes: parsed.dishes },
    { headers: { "X-RateLimit-Remaining": String(remaining) } }
  );
}
