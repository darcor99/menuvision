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

  const name       = request.nextUrl.searchParams.get("name")?.trim()       || null;
  const restaurant = request.nextUrl.searchParams.get("restaurant")?.trim() || null;
  const location   = request.nextUrl.searchParams.get("location")?.trim()   || null;

  if (!name) {
    return NextResponse.json({ error: "Missing dish name." }, { status: 400 });
  }

  // Cache key encodes all available context so different combinations are
  // stored independently and never cross-contaminate.
  const cacheKey = [location, restaurant, name]
    .filter(Boolean)
    .map((s) => s!.toLowerCase())
    .join(":");

  if (cache.has(cacheKey)) {
    return NextResponse.json({ urls: cache.get(cacheKey) });
  }

  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "SerpAPI key not configured." }, { status: 500 });
  }

  // Attempt 1 — most specific: dish + restaurant + city
  // e.g. "Beef Burger The Ivy Dublin, Ireland"
  const specificQuery = [name, restaurant, location].filter(Boolean).join(" ");
  let urls = await searchImages(specificQuery, apiKey);

  // Attempt 2 — drop restaurant, keep city
  // e.g. "Beef Burger Dublin, Ireland"
  // Only runs if attempt 1 didn't have enough AND we actually have a location
  // to make this query meaningfully different from attempt 1.
  if (urls.length < 2 && location && restaurant) {
    const cityQuery = [name, location].filter(Boolean).join(" ");
    const cityUrls = await searchImages(cityQuery, apiKey);
    if (cityUrls.length > urls.length) urls = cityUrls;
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
