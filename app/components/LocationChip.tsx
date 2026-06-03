"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
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
      <p className="flex animate-pulse items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        Detecting location…
      </p>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="e.g. Tokyo, Japan"
          className="h-7 min-w-0 flex-1 text-xs"
        />
        <button
          type="button"
          onClick={confirm}
          className="shrink-0 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          Done
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="shrink-0 text-xs text-muted-foreground/60 transition hover:text-muted-foreground"
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
      className="flex items-center gap-1.5 text-left text-xs text-muted-foreground transition hover:text-foreground/70"
    >
      <MapPin className="h-3 w-3 shrink-0" />
      <span>{label || "Add location (optional)"}</span>
      <span className="shrink-0 text-muted-foreground/50">· edit</span>
    </button>
  );
}
