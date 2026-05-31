"use client";

import { useState, useRef, useEffect } from "react";
import type { LocationStatus } from "@/app/hooks/useLocation";

type Props = {
  status: LocationStatus;
  label: string;
  onChange: (value: string) => void;
};

export function LocationChip({ status, label, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(label);
    setEditing(true);
  }

  function confirm() {
    onChange(draft.trim());
    setEditing(false);
  }

  if (status === "idle") return null;

  if (status === "detecting") {
    return (
      <p className="animate-pulse text-xs text-foreground/40">
        📍 Detecting location…
      </p>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs">📍</span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="e.g. Tokyo, Japan"
          className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-foreground/40"
        />
        <button
          type="button"
          onClick={confirm}
          className="shrink-0 text-xs font-medium text-foreground/60 transition hover:text-foreground"
        >
          Done
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="shrink-0 text-xs text-foreground/35 transition hover:text-foreground/60"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="flex items-center gap-1.5 text-left text-xs text-foreground/45 transition hover:text-foreground/70"
    >
      <span className="shrink-0">📍</span>
      <span>{label || "Add location (optional)"}</span>
      <span className="shrink-0 text-foreground/25">· edit</span>
    </button>
  );
}
