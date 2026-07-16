export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-8 py-4"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {title}
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Meta Ads Dashboard
        </span>
      </header>

      <main className="mx-auto flex max-w-7xl items-center justify-center px-8 py-24">
        <div
          className="rounded-lg px-8 py-12 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            Próximamente
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            La sección &quot;{title}&quot; está en construcción.
          </p>
        </div>
      </main>
    </div>
  );
}
