"use client";

import { useState } from "react";

type OcrState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; text: string }
  | { status: "error"; message: string };

const MAX_CLIENT_BYTES = 10 * 1024 * 1024; // 10 MB — mirrors API limit

export default function MenuUploader() {
  const [ocr, setOcr] = useState<OcrState>({ status: "idle" });

  async function handleFile(file: File) {
    if (file.size > MAX_CLIENT_BYTES) {
      setOcr({
        status: "error",
        message: "File too large. Please use an image under 10 MB.",
      });
      return;
    }

    setOcr({ status: "loading" });

    const body = new FormData();
    body.append("image", file);

    try {
      const res = await fetch("/api/ocr", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        setOcr({ status: "error", message: data.error ?? "Something went wrong." });
      } else {
        setOcr({ status: "success", text: data.text });
      }
    } catch {
      setOcr({ status: "error", message: "Network error. Please try again." });
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can trigger onChange again
    e.target.value = "";
  }

  const isLoading = ocr.status === "loading";

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      {/* Camera capture */}
      <label
        htmlFor="camera-input"
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-8 text-background transition active:scale-[0.98] ${isLoading ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="text-2xl">{isLoading ? "⏳" : "📷"}</span>
        <span className="text-base font-semibold">
          {isLoading ? "Reading menu…" : "Take a photo"}
        </span>
        <span className="text-xs opacity-70">Use your camera</span>
        <input
          id="camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileChange}
          disabled={isLoading}
          className="sr-only"
        />
      </label>

      {/* File upload */}
      <label
        htmlFor="upload-input"
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-foreground/15 px-6 py-8 transition active:scale-[0.98] ${isLoading ? "pointer-events-none opacity-60" : ""}`}
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
          disabled={isLoading}
          className="sr-only"
        />
      </label>

      {/* OCR result / error */}
      {ocr.status === "error" && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
        >
          {ocr.message}
        </div>
      )}

      {ocr.status === "success" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
            Raw OCR output
          </p>
          <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4 font-mono text-xs leading-relaxed text-foreground/80">
            {ocr.text}
          </pre>
        </div>
      )}
    </div>
  );
}
