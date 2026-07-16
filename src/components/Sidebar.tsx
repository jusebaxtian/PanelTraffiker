"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Reporte Diario", href: "/reporte-diario" },
  { label: "Proyección", href: "/proyeccion" },
  { label: "Distribución", href: "/distribucion" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-screen w-60 shrink-0 flex-col px-4 py-5"
      style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
    >
      <div className="mb-8 flex items-center gap-2 px-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold"
          style={{ background: "var(--brand)", color: "#ffffff" }}
        >
          PT
        </div>
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          PanelTraffiker
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium transition-colors"
              style={{
                background: active ? "var(--brand)" : "transparent",
                color: active ? "#ffffff" : "var(--text-secondary)",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
