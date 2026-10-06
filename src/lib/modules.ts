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

// Orden en que aparecen los módulos en el menú lateral; define a cuál se
// lleva a un usuario cuando no tiene permiso para la página que pidió.
const NAV_ORDER: ModuleKey[] = [
  "dashboard",
  "reporte-diario",
  "distribucion",
  "proyeccion",
  "graficos",
  "status-api",
  "status-ads",
];

// Ruta del primer módulo habilitado para el usuario, o null si no tiene
// ninguno. Así un Admin nunca ve una pantalla de "sin acceso": entra
// directo a lo que sí puede usar.
export function firstAllowedHref(permissions: string[] | null | undefined): string | null {
  const allowed = permissions ?? [];
  const key = NAV_ORDER.find((k) => allowed.includes(k));
  return key ? MODULES.find((m) => m.key === key)!.href : null;
}
