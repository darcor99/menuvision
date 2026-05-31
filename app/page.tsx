export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-between bg-background px-6 py-10">
      {/* Header / hero */}
      <header className="flex w-full max-w-md flex-col items-center text-center">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/5 text-3xl">
          🍽️
        </span>
        <h1 className="text-3xl font-bold tracking-tight">MenuVision</h1>
        <p className="mt-2 text-balance text-sm text-foreground/60">
          Snap a photo of a menu or upload one, and let MenuVision bring each
          dish to life.
        </p>
      </header>

      {/* Capture / upload actions */}
      <section className="flex w-full max-w-md flex-col gap-4">
        {/* Camera capture */}
        <label
          htmlFor="camera-input"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-8 text-background transition active:scale-[0.98]"
        >
          <span className="text-2xl">📷</span>
          <span className="text-base font-semibold">Take a photo</span>
          <span className="text-xs opacity-70">Use your camera</span>
          <input
            id="camera-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
          />
        </label>

        {/* File upload */}
        <label
          htmlFor="upload-input"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-foreground/15 px-6 py-8 transition active:scale-[0.98]"
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
            className="sr-only"
          />
        </label>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-foreground/40">
        Point, shoot, and explore the menu.
      </footer>
    </main>
  );
}
