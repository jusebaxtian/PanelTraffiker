export default function SinAccesoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center" style={{ background: "var(--page)" }}>
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full text-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        🚫
      </div>
      <h2 className="mt-6 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
        Sin acceso
      </h2>
      <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-muted)" }}>
        No tienes permiso para ver este módulo. Si crees que deberías tenerlo, pídele al SuperAdmin que te lo habilite.
      </p>
    </div>
  );
}
