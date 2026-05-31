"use client";

import { useState, useRef, useEffect } from "react";
import DishCard from "./DishCard";
import { DishCardSkeleton } from "./DishCardSkeleton";
import { LocationChip } from "./LocationChip";
import { compressImage } from "@/app/lib/compress-image";
import { useLocation } from "@/app/hooks/useLocation";
import type { Dish } from "@/app/types/menu";

type AppState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "parsing" }
  | { status: "success"; dishes: Dish[] }
  | { status: "error"; message: string };

const MAX_CLIENT_BYTES = 10 * 1024 * 1024;
const STORAGE_KEY = "menuvision_last_menu";
const SKELETON_COUNT = 4;

export default function MenuUploader() {
  const [state, setState] = useState<AppState>({ status: "idle" });
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Geolocation — starts detecting on mount, resolves in the background.
  const { status: locStatus, label: locLabel, setLabel: setLocLabel } =
    useLocation();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const dishes = JSON.parse(raw) as Dish[];
      if (Array.isArray(dishes) && dishes.length > 0) {
        setState({ status: "success", dishes });
      }
    } catch {
      // Corrupt storage — ignore and start fresh.
    }
  }, []);

  async function handleFile(file: File) {
    if (file.size > MAX_CLIENT_BYTES) {
      setState({
        status: "error",
        message: "File too large. Please use an image under 10 MB.",
      });
      return;
    }

    const compressed = await compressImage(file);

    // Step 1 — OCR
    setState({ status: "reading" });
    let ocrText: string;
    try {
      const body = new FormData();
      body.append("image", compressed);
      const res = await fetch("/api/ocr", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "OCR failed." });
        return;
      }
      ocrText = data.text;
    } catch {
      setState({
        status: "error",
        message: "Network error during OCR. Please try again.",
      });
      return;
    }

    // Step 2 — Parse dishes, passing location as AI context
    setState({ status: "parsing" });
    try {
      const res = await fetch("/api/parse-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: ocrText,
          location: locLabel || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Menu parsing failed." });
        return;
      }
      const dishes: Dish[] = data.dishes;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dishes));
      } catch {
        // Storage quota or private-browsing restriction — not fatal.
      }
      setState({ status: "success", dishes });
    } catch {
      setState({
        status: "error",
        message: "Network error during parsing. Please try again.",
      });
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function resetScan() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    setState({ status: "idle" });
  }

  const isBusy = state.status === "reading" || state.status === "parsing";
  const isSuccess = state.status === "success";

  const stepLabel =
    state.status === "reading"
      ? "Reading menu…"
      : state.status === "parsing"
      ? "Identifying dishes…"
      : null;

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileChange}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
      />

      {/* Upload buttons — hidden once results are showing */}
      {!isSuccess && (
        <>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={isBusy}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-8 text-background transition active:scale-[0.98] disabled:opacity-60"
          >
            <span className="text-2xl">{isBusy ? "⏳" : "📷"}</span>
            <span className="text-base font-semibold">
              {stepLabel ?? "Take a photo"}
            </span>
            <span className="text-xs opacity-70">
              {isBusy ? "This may take a few seconds" : "Use your camera"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            disabled={isBusy}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-foreground/15 px-6 py-8 transition active:scale-[0.98] disabled:opacity-60"
          >
            <span className="text-2xl">🖼️</span>
            <span className="text-base font-semibold">Upload an image</span>
            <span className="text-xs text-foreground/50">
              Choose a menu photo from your device
            </span>
          </button>

          {/* Location chip — shown once geolocation has started */}
          <LocationChip
            status={locStatus}
            label={locLabel}
            onChange={setLocLabel}
          />
        </>
      )}

      {/* Error alert */}
      {state.status === "error" && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
        >
          {state.message}
        </div>
      )}

      {/* Skeletons while loading */}
      {isBusy && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
            {stepLabel}
          </p>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <DishCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Dish cards */}
      {isSuccess && (
        <div className="flex flex-col gap-3">
          {/* Location context shown above results */}
          <LocationChip
            status={locStatus}
            label={locLabel}
            onChange={setLocLabel}
          />
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
            {state.dishes.length} dish{state.dishes.length !== 1 ? "es" : ""} found
          </p>
          {state.dishes.map((dish, i) => (
            <DishCard key={i} dish={dish} />
          ))}
          <button
            type="button"
            onClick={resetScan}
            className="mt-2 w-full rounded-2xl border border-foreground/15 py-4 text-sm font-medium text-foreground/60 transition hover:bg-foreground/5 active:scale-[0.98]"
          >
            Scan another menu
          </button>
        </div>
      )}
    </div>
  );
}
