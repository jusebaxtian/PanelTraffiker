// Lista de módulos que se pueden habilitar/deshabilitar por usuario Admin.
// Separado de lib/auth.ts (que depende de next/headers, server-only) para
// que también se pueda importar desde componentes de cliente.
export const MODULES = [
  { key: "dashboard", label: "Dashboard", href: "/" },
  { key: "graficos", label: "Gráficos", href: "/graficos" },
  { key: "reporte-diario", label: "Reporte Diario", href: "/reporte-diario" },
  { key: "distribucion", label: "Distribución", href: "/distribucion" },
  { key: "proyeccion", label: "Proyección", href: "/proyeccion" },
  { key: "status-api", label: "Status API", href: "/status-api" },
  { key: "status-ads", label: "Status Ads", href: "/status-ads" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
