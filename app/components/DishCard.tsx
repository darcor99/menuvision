"use client";

import { useState } from "react";
import type { Dish } from "@/app/types/menu";

type PhotoState =
  | { status: "idle" }
  | { status: "loading"; step: "searching" | "generating" }
  | { status: "open"; urls: string[]; source: "real" | "ai" }
  | { status: "error"; message: string };

export default function DishCard({ dish }: { dish: Dish }) {
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
      const res = await fetch(
        `/api/dish-image?name=${encodeURIComponent(searchName)}`
      );
      if (res.ok) {
        const data = await res.json();
        realUrls = data.urls ?? [];
      }
    } catch {
      // network blip — fall through to generation
    }

    if (realUrls.length >= 2) {
      setPhotos({ status: "open", urls: realUrls, source: "real" });
      return;
    }

    // Step 2 — fewer than 2 real photos, fall back to AI generation
    setPhotos({ status: "loading", step: "generating" });
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: searchName,
          description: dish.short_description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhotos({
          status: "error",
          message: data.error ?? "Could not load or generate a photo.",
        });
      } else {
        const dataUrl = `data:image/png;base64,${data.b64_json}`;
        setPhotos({ status: "open", urls: [dataUrl], source: "ai" });
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
    <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-sm">
      <div className="p-5">
        {/* Name row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-semibold leading-snug text-foreground">
              {dish.name}
            </h2>
            {showOriginal && (
              <p className="text-xs text-foreground/45">
                {dish.original_language_name}
              </p>
            )}
            {showEnglish && (
              <p className="text-sm italic text-foreground/60">
                {dish.english_name}
              </p>
            )}
          </div>
          {dish.price && (
            <span className="mt-0.5 shrink-0 rounded-full bg-foreground/5 px-3 py-1 text-sm font-medium tabular-nums text-foreground">
              {dish.price}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="mt-2.5 text-sm leading-relaxed text-foreground/70">
          {dish.short_description}
        </p>

        {/* Ingredients */}
        {dish.key_ingredients.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dish.key_ingredients.map((ing) => (
              <span
                key={ing}
                className="rounded-full border border-foreground/10 px-2.5 py-0.5 text-xs text-foreground/55"
              >
                {ing}
              </span>
            ))}
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={togglePhotos}
          disabled={photos.status === "loading"}
          className="mt-4 w-full rounded-xl border border-foreground/10 py-2 text-sm font-medium text-foreground/55 transition hover:bg-foreground/5 active:scale-[0.98] disabled:opacity-50"
        >
          {buttonLabel}
        </button>

        {/* Error */}
        {photos.status === "error" && (
          <p className="mt-2 text-center text-xs text-red-500 dark:text-red-400">
            {photos.message}
          </p>
        )}
      </div>

      {/* Carousel */}
      {photos.status === "open" && (
        <>
          {/* Source label */}
          <div className="flex items-center gap-1.5 px-5 pb-2 text-xs text-foreground/40">
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

          {/* Scrollable strip — bleeds edge to edge */}
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {photos.urls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`${searchName} ${photos.source === "ai" ? "AI-generated preview" : `photo ${i + 1}`}`}
                className="h-52 w-[85%] shrink-0 snap-start rounded-xl object-cover"
                onError={(e) => {
                  e.currentTarget.parentElement?.removeChild(e.currentTarget);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
