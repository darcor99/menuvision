"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  restaurantName: string | null;
  onConfirm: (name: string | null) => void;
};

export function RestaurantConfirmation({ restaurantName, onConfirm }: Props) {
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
      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Enter restaurant name
          </p>
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirm();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="Restaurant name (optional)"
            className="mb-3"
          />
          <div className="flex gap-2">
            <Button onClick={confirm} className="flex-1">
              Confirm
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const nameFound = restaurantName !== null;

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {nameFound ? "Is this your restaurant?" : "Couldn't detect a restaurant name"}
        </p>
        <p className="mb-4 mt-0.5 text-sm leading-snug text-foreground">
          {nameFound ? restaurantName : "Add a name below, or skip."}
        </p>
        <div className="flex gap-2">
          {nameFound && (
            <Button onClick={() => onConfirm(restaurantName)} className="flex-1">
              Yes, that&apos;s right
            </Button>
          )}
          <Button
            variant="outline"
            onClick={nameFound ? startEdit : () => { setDraft(""); setEditing(true); }}
            className={nameFound ? "" : "flex-1"}
          >
            {nameFound ? "Edit" : "Add name"}
          </Button>
          {!nameFound && (
            <Button variant="ghost" onClick={() => onConfirm(null)}>
              Skip
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
