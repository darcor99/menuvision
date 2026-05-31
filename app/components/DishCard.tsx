import type { Dish } from "@/app/types/menu";

export default function DishCard({ dish }: { dish: Dish }) {
  const showOriginal =
    dish.original_language_name &&
    dish.original_language_name !== dish.name;

  const showEnglish =
    dish.english_name &&
    dish.english_name !== dish.name &&
    dish.english_name !== dish.original_language_name;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-background p-5 shadow-sm">
      {/* Name row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold leading-snug text-foreground">{dish.name}</h2>
          {showOriginal && (
            <p className="text-xs text-foreground/45">{dish.original_language_name}</p>
          )}
          {showEnglish && (
            <p className="text-sm italic text-foreground/60">{dish.english_name}</p>
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
    </div>
  );
}
