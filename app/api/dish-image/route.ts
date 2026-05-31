import { NextRequest, NextResponse } from "next/server";

// Module-level cache — survives across requests within the same server process
const cache = new Map<string, string[]>();

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing dish name." }, { status: 400 });
  }

  const cacheKey = name.toLowerCase();
  if (cache.has(cacheKey)) {
    return NextResponse.json({ urls: cache.get(cacheKey) });
  }

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SerpAPI key not configured." },
      { status: 500 }
    );
  }

  const searchUrl = new URL("https://serpapi.com/search.json");
  searchUrl.searchParams.set("engine", "google_images");
  searchUrl.searchParams.set("q", name);
  searchUrl.searchParams.set("api_key", apiKey);

  let serpRes: Response;
  try {
    serpRes = await fetch(searchUrl.toString());
  } catch {
    return NextResponse.json(
      { error: "Could not reach SerpAPI. Check your network." },
      { status: 502 }
    );
  }

  const data = await serpRes.json();

  if (!serpRes.ok) {
    const message: string = data?.error ?? "SerpAPI returned an error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const results: { thumbnail?: string; original?: string }[] =
    data.images_results ?? [];

  const urls = results
    .slice(0, 3)
    .map((r) => r.thumbnail ?? r.original)
    .filter((u): u is string => Boolean(u));

  if (urls.length === 0) {
    return NextResponse.json({ error: "No images found." }, { status: 404 });
  }

  cache.set(cacheKey, urls);
  return NextResponse.json({ urls });
}
