"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", key: "dashboard" },
  { label: "Reporte Diario", href: "/reporte-diario", key: "reporte-diario" },
  { label: "Distribución", href: "/distribucion", key: "distribucion" },
  { label: "Proyección", href: "/proyeccion", key: "proyeccion" },
  { label: "Gráficos", href: "/graficos", key: "graficos" },
  { label: "Status API", href: "/status-api", key: "status-api" },
] as const;

interface CurrentUser {
  full_name: string;
  email: string;
  role: "superadmin" | "admin";
  module_permissions: string[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/login") return;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setUser(json.data);
      })
      .catch(() => {});
  }, [pathname]);

  if (pathname === "/login") return null;

  const isSuperAdmin = user?.role === "superadmin";
  const visibleItems = NAV_ITEMS.filter((item) => !user || isSuperAdmin || user.module_permissions.includes(item.key));

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

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

        <nav className="flex flex-1 flex-col gap-1">
          {visibleItems.map((item) => {
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
          {isSuperAdmin && (
            <Link
              href="/usuarios"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium transition-colors"
              style={{
                background: pathname === "/usuarios" ? "var(--brand)" : "transparent",
                color: pathname === "/usuarios" ? "#ffffff" : "var(--text-secondary)",
              }}
            >
              Usuarios
            </Link>
          )}
        </nav>

        {user && (
          <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--gridline)" }}>
            <p className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              {user.full_name || user.email}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {isSuperAdmin ? "SuperAdmin" : "Admin"}
            </p>
            <button onClick={logout} className="mt-2 text-xs font-medium" style={{ color: "var(--critical)" }}>
              Cerrar sesión
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
