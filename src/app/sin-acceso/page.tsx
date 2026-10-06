// Solo se llega aquí si la cuenta todavía no tiene ningún módulo asignado
// (si tiene alguno, el middleware lo lleva directo a ese módulo).
export default function SinAccesoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center" style={{ background: "var(--page)" }}>
      <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
        Tu cuenta aún no tiene módulos habilitados
      </h2>
      <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-muted)" }}>
        Cuando se te asignen módulos, aparecerán aquí automáticamente. Escríbele a quien te dio acceso al panel.
      </p>
    </div>
  );
}
