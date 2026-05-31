"use client";

import { useState } from "react";
import type { Dish } from "@/app/types/menu";

type PhotoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "open"; urls: string[] }
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

  // Prefer english_name for image search — better results than romanized/foreign names
  const searchName = dish.english_name || dish.name;

  async function togglePhotos() {
    if (photos.status === "open") {
      setPhotos({ status: "idle" });
      return;
    }
    if (photos.status === "loading") return;

    setPhotos({ status: "loading" });
    try {
      const res = await fetch(
        `/api/dish-image?name=${encodeURIComponent(searchName)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setPhotos({ status: "error", message: data.error ?? "Could not load photos." });
      } else {
        setPhotos({ status: "open", urls: data.urls });
      }
    } catch {
      setPhotos({ status: "error", message: "Network error. Please try again." });
    }
  }

  const buttonLabel =
    photos.status === "loading"
      ? "Loading…"
      : photos.status === "open"
      ? "Hide photos"
      : "Show photos";

  return (
    // overflow-hidden lets the photo strip bleed to card edges cleanly
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

        {/* Show/hide photos button */}
        <button
          onClick={togglePhotos}
          disabled={photos.status === "loading"}
          className="mt-4 w-full rounded-xl border border-foreground/10 py-2 text-sm font-medium text-foreground/55 transition hover:bg-foreground/5 active:scale-[0.98] disabled:opacity-50"
        >
          {buttonLabel}
        </button>

        {/* Photo fetch error */}
        {photos.status === "error" && (
          <p className="mt-2 text-center text-xs text-red-500 dark:text-red-400">
            {photos.message}
          </p>
        )}
      </div>

      {/* Photo carousel — bleeds edge to edge inside the card */}
      {photos.status === "open" && (
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {photos.urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`${searchName} photo ${i + 1}`}
              className="h-52 w-[85%] shrink-0 snap-start rounded-xl object-cover"
              onError={(e) => {
                e.currentTarget.parentElement?.removeChild(e.currentTarget);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
