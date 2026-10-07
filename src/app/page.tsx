export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <h1 className="text-3xl font-semibold tracking-tight">
        KOLU
      </h1>
      <p className="max-w-md text-sm text-foreground/70">
        Foundation phase — product UI is not built yet. This page only
        verifies the design tokens from docs/DESIGN_SYSTEM.md are wired up.
      </p>
      <span className="rounded-full bg-brand-accent px-4 py-1 text-xs font-medium text-[#0b0b0b]">
        Electric Lime #C8FF00
      </span>
    </main>
  );
}
