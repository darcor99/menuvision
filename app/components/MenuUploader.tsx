"use client";

import { useState } from "react";
import DishCard from "./DishCard";
import type { Dish } from "@/app/types/menu";

type AppState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "parsing" }
  | { status: "success"; dishes: Dish[] }
  | { status: "error"; message: string };

const MAX_CLIENT_BYTES = 10 * 1024 * 1024;

const STEP_LABELS: Record<string, string> = {
  reading: "Reading menu…",
  parsing: "Identifying dishes…",
};

export default function MenuUploader() {
  const [state, setState] = useState<AppState>({ status: "idle" });

  async function handleFile(file: File) {
    if (file.size > MAX_CLIENT_BYTES) {
      setState({
        status: "error",
        message: "File too large. Please use an image under 10 MB.",
      });
      return;
    }

    // Step 1: OCR
    setState({ status: "reading" });
    let ocrText: string;
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch("/api/ocr", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "OCR failed." });
        return;
      }
      ocrText = data.text;
    } catch {
      setState({ status: "error", message: "Network error during OCR. Please try again." });
      return;
    }

    // Step 2: Parse dishes
    setState({ status: "parsing" });
    try {
      const res = await fetch("/api/parse-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ocrText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Menu parsing failed." });
        return;
      }
      setState({ status: "success", dishes: data.dishes });
    } catch {
      setState({ status: "error", message: "Network error during parsing. Please try again." });
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  const isBusy = state.status === "reading" || state.status === "parsing";
  const stepLabel = isBusy ? STEP_LABELS[state.status] : null;

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      {/* Camera capture */}
      <label
        htmlFor="camera-input"
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-8 text-background transition active:scale-[0.98] ${isBusy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="text-2xl">{isBusy ? "⏳" : "📷"}</span>
        <span className="text-base font-semibold">
          {stepLabel ?? "Take a photo"}
        </span>
        <span className="text-xs opacity-70">
          {isBusy ? "This may take a few seconds" : "Use your camera"}
        </span>
        <input
          id="camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileChange}
          disabled={isBusy}
          className="sr-only"
        />
      </label>

      {/* File upload */}
      <label
        htmlFor="upload-input"
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-foreground/15 px-6 py-8 transition active:scale-[0.98] ${isBusy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="text-2xl">🖼️</span>
        <span className="text-base font-semibold">Upload an image</span>
        <span className="text-xs text-foreground/50">
          Choose a menu photo from your device
        </span>
        <input
          id="upload-input"
          type="file"
          accept="image/*"
          onChange={onFileChange}
          disabled={isBusy}
          className="sr-only"
        />
      </label>

      {/* Error */}
      {state.status === "error" && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
        >
          {state.message}
        </div>
      )}

      {/* Dish cards */}
      {state.status === "success" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
            {state.dishes.length} dish{state.dishes.length !== 1 ? "es" : ""} found
          </p>
          {state.dishes.map((dish, i) => (
            <DishCard key={i} dish={dish} />
          ))}
        </div>
      )}
    </div>
  );
}
