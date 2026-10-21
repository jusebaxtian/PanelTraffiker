"use client";

import { useEffect, useState } from "react";
import { MODULES } from "@/lib/modules";
import { LOGIN_EVENT_LABEL } from "@/lib/inactivity";

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: "superadmin" | "admin";
  active: boolean;
  module_permissions: string[];
  created_at: string;
  is_protected?: boolean;
  last_activity?: {
    at: string;
    ip: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    user_agent: string | null;
    exact: boolean;
  } | null;
}

interface LoginRecord {
  id: string;
  logged_in_at: string;
  city: string | null;
  region: string | null;
  country: string | null;
  ip_address: string | null;
  user_agent: string | null;
  event?: string;
}

// Tipo de equipo (PC / Celular / Tablet) más sistema y navegador, a partir
// del user-agent que se guarda en cada ingreso.
function deviceLabel(ua: string | null): string {
  if (!ua) return "Dispositivo desconocido";
  const isTablet = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const isMobile = !isTablet && /Mobi|iPhone|iPod|Android/i.test(ua);
  const kind = isTablet ? "🖥️ Tablet" : isMobile ? "📱 Celular" : "💻 PC";

  const os = /Windows/i.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Android/i.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS/.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;

  return [kind, os, browser].filter(Boolean).join(" · ");
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

// "Hoy 4:24 p. m." / "Ayer 9:10 a. m." / "20 oct 4:24 p. m." en hora de Colombia.
function fmtLastActivity(iso: string): string {
  const tz = "America/Bogota";
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: tz });
  const time = new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz });
  const d = new Date(iso);
  const today = day(new Date());
  const yesterday = day(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (day(d) === today) return `Hoy ${time}`;
  if (day(d) === yesterday) return `Ayer ${time}`;
  const date = d.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: tz });
  return `${date} ${time}`;
}

// "Hace 5 min", "Hace 3 h", "Hace 2 días".
function fmtAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [historyForId, setHistoryForId] = useState<string | null>(null);

  function loadUsers() {
    setLoading(true);
    fetch("/api/usuarios")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else {
          setUsers(json.data);
          setError(null);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateUser(id: string, updates: Record<string, unknown>) {
    await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    loadUsers();
  }

  async function deleteUser(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
    if (!res.ok) loadUsers();
  }

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
          Roles, permisos y actividad
        </span>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: "var(--brand)", color: "#ffffff" }}
            >
              + Nuevo usuario
            </button>
          ) : (
            <NewUserForm
              onCancel={() => setCreating(false)}
              onCreated={() => {
                setCreating(false);
                loadUsers();
              }}
            />
          )}
        </div>

        {error && (
          <p
            className="mb-4 rounded-lg p-4"
            style={{ background: "rgba(208,59,59,0.12)", color: "var(--critical)", border: "1px solid var(--critical)" }}
          >
            {error}
          </p>
        )}

        {loading && <p style={{ color: "var(--text-secondary)" }}>Cargando...</p>}

        {!loading && (
          <div className="space-y-3">
            {users.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                onUpdate={(updates) => updateUser(u.id, updates)}
                onDelete={() => deleteUser(u.id)}
                onToggleHistory={() => setHistoryForId(historyForId === u.id ? null : u.id)}
                showHistory={historyForId === u.id}
              />
            ))}
            {users.length === 0 && <p style={{ color: "var(--text-muted)" }}>No hay usuarios todavía.</p>}
          </div>
        )}
      </main>
    </div>
  );
}

function NewUserForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"superadmin" | "admin">("admin");
  const [modules, setModules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleModule(key: string) {
    setModules((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName, role, module_permissions: modules }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.error) {
      setError(json.error);
      return;
    }
    onCreated();
  }

  return (
    <div className="max-w-lg space-y-3 rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Nombre completo
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Correo
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Contraseña (mínimo 8 caracteres)
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Rol
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "superadmin" | "admin")}
          className="w-full rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          <option value="admin">Admin (solo lectura)</option>
          <option value="superadmin">SuperAdmin (acceso total)</option>
        </select>
      </div>

      {role === "admin" && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Módulos permitidos
          </p>
          <div className="grid grid-cols-2 gap-1">
            {MODULES.map((m) => (
              <label key={m.key} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={modules.includes(m.key)} onChange={() => toggleModule(m.key)} />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "var(--critical)" }}>{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving || !email.trim() || password.length < 8}
          className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--brand)", color: "#ffffff" }}
        >
          {saving ? "Creando..." : "Crear usuario"}
        </button>
        <button onClick={onCancel} className="rounded-md px-4 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function UserCard({
  user,
  onUpdate,
  onDelete,
  onToggleHistory,
  showHistory,
}: {
  user: UserRow;
  onUpdate: (updates: Record<string, unknown>) => void;
  onDelete: () => void;
  onToggleHistory: () => void;
  showHistory: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Reloj para marcar "En línea" (actividad en los últimos 5 minutos).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [newPassword, setNewPassword] = useState("");
  const [history, setHistory] = useState<LoginRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  useEffect(() => {
    if (!showHistory) return;
    setLoadingHistory(true);
    fetch(`/api/usuarios/${user.id}/logins`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setHistory(json.data);
      })
      .finally(() => setLoadingHistory(false));
  }, [showHistory, user.id]);

  function toggleModule(key: string) {
    const next = user.module_permissions.includes(key)
      ? user.module_permissions.filter((m) => m !== key)
      : [...user.module_permissions, key];
    onUpdate({ module_permissions: next });
  }

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {user.full_name || user.email}{" "}
            <span
              className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium"
              style={{
                background: user.role === "superadmin" ? "var(--brand)" : "var(--page)",
                color: user.role === "superadmin" ? "#ffffff" : "var(--text-secondary)",
                border: user.role === "superadmin" ? "none" : "1px solid var(--border)",
              }}
            >
              {user.role === "superadmin" ? "SuperAdmin" : "Admin"}
            </span>
            {user.is_protected && (
              <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium" style={{ background: "var(--page)", color: "var(--good)", border: "1px solid var(--good)" }}>
                Cuenta principal
              </span>
            )}
            {!user.active && (
              <span className="ml-2 rounded px-1.5 py-0.5 text-xs font-medium" style={{ background: "var(--critical)", color: "#fff" }}>
                Inactivo
              </span>
            )}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {user.email}
          </p>
          {user.last_activity ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span>
                {now - new Date(user.last_activity.at).getTime() < 5 * 60 * 1000 && (
                  <span className="mr-1 rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color: "var(--good)", border: "1px solid var(--good)" }}>
                    En línea
                  </span>
                )}
                <b style={{ color: "var(--text-primary)" }}>Última actividad:</b> {fmtLastActivity(user.last_activity.at)}{" "}
                <span style={{ color: "var(--text-muted)" }}>({fmtAgo(user.last_activity.at)})</span>
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                {[user.last_activity.city, user.last_activity.region, user.last_activity.country].filter(Boolean).join(", ") || "Ciudad desconocida"}
              </span>
              <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>IP {user.last_activity.ip ?? "desconocida"}</span>
              <span style={{ color: "var(--text-muted)" }}>{deviceLabel(user.last_activity.user_agent)}</span>
              {!user.last_activity.exact && (
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  (ciudad, IP y dispositivo del último ingreso; se actualizan solos cuando vuelva a usar el panel)
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              <b>Última actividad:</b> sin registro
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!user.is_protected && (
            <button
              onClick={() => onUpdate({ active: !user.active })}
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--page)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {user.active ? "Desactivar" : "Activar"}
            </button>
          )}
          <button
            onClick={onToggleHistory}
            className="rounded-md px-3 py-1.5 text-xs font-medium"
            style={{ background: "var(--page)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            {showHistory ? "Ocultar historial de actividad" : "Ver historial de actividad"}
          </button>
          {user.is_protected ? null : confirmingDelete ? (
            <button
              onClick={() => {
                setConfirmingDelete(false);
                onDelete();
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--critical)", color: "#ffffff" }}
            >
              ¿Eliminar?
            </button>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} className="text-xs" style={{ color: "var(--critical)" }}>
              Eliminar
            </button>
          )}
        </div>
      </div>

      {user.role === "admin" && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--gridline)" }}>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Módulos permitidos
          </p>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {MODULES.map((m) => (
              <label key={m.key} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={user.module_permissions.includes(m.key)} onChange={() => toggleModule(m.key)} />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--gridline)" }}>
        <input
          type="password"
          placeholder="Nueva contraseña..."
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="rounded-md px-2 py-1 text-xs outline-none"
          style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />
        <button
          onClick={() => {
            if (newPassword.length >= 8) {
              onUpdate({ password: newPassword });
              setNewPassword("");
            }
          }}
          disabled={newPassword.length < 8}
          className="rounded-md px-3 py-1 text-xs font-medium disabled:opacity-50"
          style={{ background: "var(--page)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          Cambiar contraseña
        </button>
      </div>

      {showHistory && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--gridline)" }}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Historial de actividad
          </p>
          {loadingHistory && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Cargando...</p>}
          {!loadingHistory && history.length === 0 && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Todavía no se ha conectado.
            </p>
          )}
          {!loadingHistory && history.length > 0 && (
            <div className="space-y-1">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span>
                    {fmtDateTime(h.logged_in_at)}{" "}
                    <span
                      className="ml-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
                      style={{
                        color: h.event === "timeout" ? "var(--series-3)" : h.event === "resume" ? "var(--series-4)" : "var(--good)",
                        border: "1px solid currentColor",
                      }}
                    >
                      {LOGIN_EVENT_LABEL[h.event ?? "login"] ?? "Inició sesión"}
                    </span>
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {[h.city, h.region, h.country].filter(Boolean).join(", ") || "Ciudad desconocida"}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                    IP {h.ip_address ?? "desconocida"}
                  </span>
                  <span>{deviceLabel(h.user_agent)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
