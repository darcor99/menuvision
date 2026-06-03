"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dish } from "@/app/types/menu";

type PhotoState =
  | { status: "idle" }
  | { status: "loading"; step: "searching" | "generating" }
  | { status: "open"; urls: string[]; broken: Set<string>; source: "real" | "ai" }
  | { status: "error"; message: string };

export default function DishCard({
  dish,
  restaurantName,
  location,
}: {
  dish: Dish;
  restaurantName?: string | null;
  location?: string | null;
}) {
  const [photos, setPhotos] = useState<PhotoState>({ status: "idle" });

  const showOriginal =
    dish.original_language_name &&
    dish.original_language_name !== dish.name;

  const showEnglish =
    dish.english_name &&
    dish.english_name !== dish.name &&
    dish.english_name !== dish.original_language_name;

  const searchName = dish.english_name || dish.name;

  async function togglePhotos() {
    if (photos.status === "open") {
      setPhotos({ status: "idle" });
      return;
    }
    if (photos.status === "loading") return;

    // Step 1 — try real photos
    setPhotos({ status: "loading", step: "searching" });

    let realUrls: string[] = [];
    try {
      const params = new URLSearchParams({ name: searchName });
      if (restaurantName) params.set("restaurant", restaurantName);
      if (location)       params.set("location", location);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 15_000);
      try {
        const res = await fetch(`/api/dish-image?${params}`, { signal: ac.signal });
        if (res.ok) {
          const data = await res.json();
          realUrls = data.urls ?? [];
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // network blip or timeout — fall through to generation
    }

    if (realUrls.length >= 2) {
      setPhotos({ status: "open", urls: realUrls, broken: new Set(), source: "real" });
      return;
    }

    // Step 2 — fewer than 2 real photos, fall back to AI generation
    setPhotos({ status: "loading", step: "generating" });
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 45_000);
      let res: Response;
      try {
        res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: searchName,
            description: dish.short_description,
          }),
          signal: ac.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const data = await res!.json();
      if (!res!.ok) {
        setPhotos({
          status: "error",
          message: data.error ?? "Could not load or generate a photo.",
        });
      } else {
        const dataUrl = `data:image/png;base64,${data.b64_json}`;
        setPhotos({ status: "open", urls: [dataUrl], broken: new Set(), source: "ai" });
      }
    } catch {
      setPhotos({ status: "error", message: "Network error. Please try again." });
    }
  }

  const buttonLabel =
    photos.status === "loading"
      ? photos.step === "generating"
        ? "Generating preview…"
        : "Finding photos…"
      : photos.status === "open"
      ? "Hide photos"
      : "Show photos";

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardContent className="p-5">
        {/* Name row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-semibold leading-snug text-foreground">
              {dish.name}
            </h2>
            {showOriginal && (
              <p className="text-xs text-muted-foreground">
                {dish.original_language_name}
              </p>
            )}
            {showEnglish && (
              <p className="text-sm italic text-muted-foreground">
                {dish.english_name}
              </p>
            )}
          </div>
          {dish.price && (
            <Badge variant="secondary" className="mt-0.5 shrink-0 tabular-nums">
              {dish.price}
            </Badge>
          )}
        </div>

        {/* Description */}
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          {dish.short_description}
        </p>

        {/* Ingredients */}
        {dish.key_ingredients.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dish.key_ingredients.map((ing) => (
              <Badge key={ing} variant="outline" className="font-normal">
                {ing}
              </Badge>
            ))}
          </div>
        )}

        {/* Toggle button */}
        <Button
          variant="outline"
          size="sm"
          onClick={togglePhotos}
          disabled={photos.status === "loading"}
          className="mt-4 w-full"
        >
          {buttonLabel}
        </Button>

        {/* Error */}
        {photos.status === "error" && (
          <p className="mt-2 text-center text-xs text-destructive">
            {photos.message}
          </p>
        )}
      </CardContent>

      {/* Carousel */}
      {photos.status === "open" && (
        <>
          {/* Source label */}
          <div className="flex items-center gap-1.5 px-5 pb-2 text-xs text-muted-foreground">
            {photos.source === "real" ? (
              <>
                <span aria-hidden>📷</span>
                <span>Real photos</span>
              </>
            ) : (
              <>
                <span aria-hidden>✨</span>
                <span>AI-generated preview — may not reflect the actual dish</span>
              </>
            )}
          </div>

          {/* Scrollable strip */}
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {photos.urls.filter((url) => !photos.broken.has(url)).map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`${searchName} ${photos.source === "ai" ? "AI-generated preview" : `photo ${i + 1}`}`}
                className="h-56 w-[85%] shrink-0 snap-start rounded-xl object-cover"
                onError={() => {
                  setPhotos((prev) =>
                    prev.status === "open"
                      ? { ...prev, broken: new Set([...prev.broken, url]) }
                      : prev
                  );
                }}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
