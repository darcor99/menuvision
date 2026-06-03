"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Is this your restaurant?
        </p>
        <p className="text-base font-semibold leading-snug text-foreground">
          {restaurantName ?? "Couldn't find a name"}
        </p>
        <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
          {dishCount} dish{dishCount !== 1 ? "es" : ""} found
        </p>
        <div className="flex gap-2">
          <Button onClick={() => onConfirm(restaurantName)} className="flex-1">
            Yes, that&apos;s right
          </Button>
          <Button variant="outline" onClick={startEdit}>
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
