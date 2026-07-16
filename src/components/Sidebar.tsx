"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Gráficos", href: "/graficos" },
  { label: "Reporte Diario", href: "/reporte-diario" },
  { label: "Proyección", href: "/proyeccion" },
  { label: "Distribución", href: "/distribucion" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3 md:hidden"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold"
            style={{ background: "var(--brand)", color: "#ffffff" }}
          >
            PT
          </div>
          <span className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            PanelTraffiker
          </span>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="rounded-md p-2 text-xl leading-none"
          style={{ color: "var(--text-secondary)" }}
        >
          ☰
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col overflow-y-auto px-4 py-5 transition-transform duration-200 md:sticky md:top-0 md:z-0 md:h-screen md:w-60 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
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
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="text-lg md:hidden"
            style={{ color: "var(--text-secondary)" }}
          >
            ✕
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
    </>
  );
}
