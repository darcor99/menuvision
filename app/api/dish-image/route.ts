import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getIp } from "@/app/lib/rate-limit";

export const maxDuration = 20;

const cache = new Map<string, string[]>();

async function searchImages(query: string, apiKey: string): Promise<string[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_images");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const results: { thumbnail?: string; original?: string }[] =
      data.images_results ?? [];
    return results
      .slice(0, 3)
      .map((r) => r.thumbnail ?? r.original)
      .filter((u): u is string => Boolean(u));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { allowed, remaining, resetInMs } = checkRateLimit(getIp(request), "dish-image");
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

  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing dish name." }, { status: 400 });
  }

  const restaurant = request.nextUrl.searchParams.get("restaurant")?.trim() || null;

  // Cache key includes restaurant so we don't serve generic results for a
  // restaurant-specific lookup (or vice versa) on a cache hit.
  const cacheKey = restaurant
    ? `${restaurant.toLowerCase()}:${name.toLowerCase()}`
    : name.toLowerCase();

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

  let urls: string[] = [];

  // Try restaurant-specific search first — gives photos of the actual dish
  // at this restaurant rather than generic stock images.
  if (restaurant) {
    urls = await searchImages(`${name} ${restaurant}`, apiKey);
  }

  // Fall back to generic dish name if we didn't get enough results.
  if (urls.length < 2) {
    const genericUrls = await searchImages(name, apiKey);
    // Keep whichever set has more results.
    if (genericUrls.length > urls.length) {
      urls = genericUrls;
    }
  }

  if (urls.length === 0) {
    return NextResponse.json({ error: "No images found." }, { status: 404 });
  }

  cache.set(cacheKey, urls);
  return NextResponse.json(
    { urls },
    { headers: { "X-RateLimit-Remaining": String(remaining) } }
  );
}
