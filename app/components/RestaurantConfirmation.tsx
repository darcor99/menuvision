"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  restaurantName: string | null;
  dishCount: number;
  onConfirm: (name: string | null) => void;
};

export function RestaurantConfirmation({
  restaurantName,
  dishCount,
  onConfirm,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(restaurantName ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(restaurantName ?? "");
    setEditing(true);
  }

  function confirm() {
    onConfirm(draft.trim() || null);
  }

  if (editing) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-background p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/40">
          Enter restaurant name
        </p>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Restaurant name (optional)"
          className="mb-3 w-full rounded-xl border border-foreground/15 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirm}
            className="flex-1 rounded-xl bg-foreground py-2.5 text-sm font-semibold text-background transition active:scale-[0.98]"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-xl border border-foreground/10 px-4 py-2.5 text-sm text-foreground/55 transition hover:bg-foreground/5 active:scale-[0.98]"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 shadow-sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-foreground/40">
        Is this your restaurant?
      </p>
      <p className="text-base font-semibold leading-snug text-foreground">
        {restaurantName ?? "Couldn't find a name"}
      </p>
      <p className="mb-4 mt-0.5 text-xs text-foreground/40">
        {dishCount} dish{dishCount !== 1 ? "es" : ""} found
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onConfirm(restaurantName)}
          className="flex-1 rounded-xl bg-foreground py-2.5 text-sm font-semibold text-background transition active:scale-[0.98]"
        >
          Yes, that&apos;s right
        </button>
        <button
          type="button"
          onClick={startEdit}
          className="rounded-xl border border-foreground/10 px-4 py-2.5 text-sm text-foreground/55 transition hover:bg-foreground/5 active:scale-[0.98]"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
