"use client";

import { useState, useRef, useEffect } from "react";
import DishCard from "./DishCard";
import { DishCardSkeleton } from "./DishCardSkeleton";
import { LocationChip } from "./LocationChip";
import { RestaurantConfirmation } from "./RestaurantConfirmation";
import { Button } from "@/components/ui/button";
import { Camera, ImageUp, Loader2, ScanLine } from "lucide-react";
import { compressImage } from "@/app/lib/compress-image";
import { useLocation } from "@/app/hooks/useLocation";
import type { Dish } from "@/app/types/menu";

type AppState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "parsing" }
  | { status: "confirming"; dishes: Dish[]; restaurantName: string | null }
  | { status: "success"; dishes: Dish[]; restaurantName: string | null }
  | { status: "error"; message: string };

const MAX_CLIENT_BYTES = 10 * 1024 * 1024;
const STORAGE_KEY = "menuvision_last_menu";
const SKELETON_COUNT = 4;

export default function MenuUploader() {
  const [state, setState] = useState<AppState>({ status: "idle" });
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<File | null>(null);
  // Accumulates dishes across state transitions so confirm always has the full list
  const dishesRef = useRef<Dish[]>([]);

  const { status: locStatus, label: locLabel, setLabel: setLocLabel } =
    useLocation();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as
        | { dishes: Dish[]; restaurantName: string | null }
        | Dish[];
      const dishes = Array.isArray(saved) ? saved : saved.dishes;
      const restaurantName = Array.isArray(saved) ? null : saved.restaurantName;
      if (Array.isArray(dishes) && dishes.length > 0) {
        setState({ status: "success", dishes, restaurantName });
      }
    } catch {
      // Corrupt storage — ignore and start fresh.
    }
  }, []);

  async function handleFile(file: File) {
    lastFileRef.current = file;
    dishesRef.current = [];
    const compressed = await compressImage(file);

    if (compressed.size > MAX_CLIENT_BYTES) {
      setState({
        status: "error",
        message: "File too large. Please use an image under 10 MB.",
      });
      return;
    }

    // Step 1 — OCR
    setState({ status: "reading" });
    let ocrText: string;
    try {
      const body = new FormData();
      body.append("image", compressed);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 30_000);
      let res: Response;
      try {
        res = await fetch("/api/ocr", { method: "POST", body, signal: ac.signal });
      } finally {
        clearTimeout(timer);
      }
      const data = await res!.json();
      if (!res!.ok) {
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

    // Step 2 — Stream parse: restaurant name arrives in ~1-2s, dishes pop in one-by-one
    setState({ status: "parsing" });
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 30_000);
      let res: Response;
      try {
        res = await fetch("/api/parse-menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: ocrText,
            location: locLabel || undefined,
          }),
          signal: ac.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res!.ok) {
        const data = await res!.json();
        setState({ status: "error", message: data.error ?? "Menu parsing failed." });
        return;
      }

      const reader = res!.body!.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";
      let confirming = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });

        const parts = lineBuffer.split("\n");
        lineBuffer = parts.pop() ?? "";

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;

          let obj: Record<string, unknown>;
          try {
            obj = JSON.parse(trimmed) as Record<string, unknown>;
          } catch {
            continue; // skip malformed line
          }

          if (!confirming && "restaurant_name" in obj) {
            // First line — restaurant name → transition to confirming immediately
            confirming = true;
            const restaurantName =
              typeof obj.restaurant_name === "string" ? obj.restaurant_name : null;
            setState({ status: "confirming", dishes: [], restaurantName });
          } else if (typeof obj.name === "string") {
            // Dish line — append to ref and update whichever display state is active
            dishesRef.current = [...dishesRef.current, obj as unknown as Dish];

            if (!confirming) {
              // Model skipped restaurant_name — transition now
              confirming = true;
              setState({
                status: "confirming",
                dishes: dishesRef.current,
                restaurantName: null,
              });
            } else {
              setState((prev) => {
                if (prev.status === "confirming" || prev.status === "success") {
                  return { ...prev, dishes: dishesRef.current };
                }
                return prev;
              });
            }
          }
        }
      }

      // Flush any content not terminated by a newline
      if (lineBuffer.trim()) {
        let obj: Record<string, unknown>;
        try {
          obj = JSON.parse(lineBuffer.trim()) as Record<string, unknown>;
          if (typeof obj.name === "string") {
            dishesRef.current = [...dishesRef.current, obj as unknown as Dish];
            setState((prev) => {
              if (prev.status === "confirming" || prev.status === "success") {
                return { ...prev, dishes: dishesRef.current };
              }
              return prev;
            });
          }
        } catch { /* skip */ }
      }

      // If stream ended with nothing, show an error
      if (!confirming) {
        setState((prev) => {
          if (prev.status === "parsing") {
            return { status: "error", message: "No dishes found in this menu." };
          }
          return prev;
        });
      }
    } catch {
      // Only override state if we haven't already started showing results
      setState((prev) => {
        if (prev.status === "parsing" || prev.status === "reading") {
          return {
            status: "error",
            message: "Network error during parsing. Please try again.",
          };
        }
        return prev;
      });
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleRestaurantConfirm(restaurantName: string | null) {
    if (state.status !== "confirming") return;
    // Use ref to capture any dishes that arrived between renders
    const dishes = dishesRef.current;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dishes, restaurantName }));
    } catch { /* ignore */ }
    setState({ status: "success", dishes, restaurantName });
  }

  function resetScan() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    setState({ status: "idle" });
  }

  const isBusy = state.status === "reading" || state.status === "parsing";
  const isConfirming = state.status === "confirming";
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

      {/* Upload buttons */}
      {!isSuccess && !isConfirming && (
        <>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={isBusy}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-8 text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            {isBusy
              ? <Loader2 className="h-6 w-6 animate-spin" />
              : <Camera className="h-6 w-6" />}
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
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border px-6 py-8 transition hover:bg-muted active:scale-[0.98] disabled:opacity-60"
          >
            <ImageUp className="h-6 w-6" />
            <span className="text-base font-semibold">Upload an image</span>
            <span className="text-xs text-muted-foreground">
              Choose a menu photo from your device
            </span>
          </button>

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
          className="rounded-2xl border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive"
        >
          <p>{state.message}</p>
          {lastFileRef.current && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleFile(lastFileRef.current!)}
              className="mt-3 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              Try again
            </Button>
          )}
        </div>
      )}

      {/* Restaurant name confirmation — dish count ticks up live as stream arrives */}
      {isConfirming && (
        <RestaurantConfirmation
          restaurantName={state.restaurantName}
          onConfirm={handleRestaurantConfirm}
        />
      )}

      {/* Skeletons while OCR / initial parse before first stream line */}
      {isBusy && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetScan}
              className="gap-1.5 text-muted-foreground"
            >
              <ScanLine className="h-4 w-4" />
              Scan another menu
            </Button>
          </div>

          {state.restaurantName && (
            <p className="text-base font-semibold text-foreground">
              {state.restaurantName}
            </p>
          )}
          <LocationChip
            status={locStatus}
            label={locLabel}
            onChange={setLocLabel}
          />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {state.dishes.length} dish{state.dishes.length !== 1 ? "es" : ""} found
          </p>
          {state.dishes.map((dish) => (
            <DishCard
              key={dish.name}
              dish={dish}
              restaurantName={state.restaurantName}
              location={locLabel || null}
            />
          ))}
          <Button
            variant="ghost"
            onClick={resetScan}
            className="mt-2 w-full"
          >
            Scan another menu
          </Button>
        </div>
      )}
    </div>
  );
}
