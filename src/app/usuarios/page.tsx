export default function UsuariosPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Usuarios
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Gestión de usuarios y permisos
        </span>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-24 text-center sm:px-8">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-2xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          🔒
        </div>
        <h2 className="mt-6 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Próximamente
        </h2>
        <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-muted)" }}>
          Este módulo está en construcción. Aquí vas a poder crear usuarios, asignar roles y controlar el acceso
          a cada sección del panel.
        </p>
      </main>
    </div>
  );
}
