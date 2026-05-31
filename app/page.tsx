import MenuUploader from "./components/MenuUploader";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 bg-background px-6 py-10">
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

      <MenuUploader />

      <footer className="mt-auto text-center text-xs text-foreground/40">
        Point, shoot, and explore the menu.
      </footer>
    </main>
  );
}
