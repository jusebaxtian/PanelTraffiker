"use client";

import { useEffect, useState } from "react";

interface ApiConnection {
  id: string;
  label: string;
  phone_number_id: string;
  waba_id: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  business_name: string | null;
  quality_rating: "GREEN" | "YELLOW" | "RED" | "UNKNOWN" | null;
  error: string | null;
}

function qualityMeta(q: ApiConnection["quality_rating"], error: string | null) {
  if (error) return { color: "var(--critical)", label: "Error", dot: "⚠" };
  switch (q) {
    case "GREEN":
      return { color: "var(--good)", label: "Verde", dot: "●" };
    case "YELLOW":
      return { color: "var(--series-3)", label: "Amarillo", dot: "●" };
    case "RED":
      return { color: "var(--critical)", label: "Rojo", dot: "●" };
    default:
      return { color: "var(--text-muted)", label: "Desconocido", dot: "○" };
  }
}

export default function StatusApiPage() {
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPhoneId, setEditPhoneId] = useState("");
  const [editWabaId, setEditWabaId] = useState("");
  const [editToken, setEditToken] = useState("");

  function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    fetch("/api/api-status")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else {
          setConnections(json.data);
          setError(null);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }

  useEffect(() => load(), []);

  async function createConnection() {
    if (!label.trim() || !phoneNumberId.trim() || !accessToken.trim()) return;
    const res = await fetch("/api/api-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label.trim(),
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || undefined,
        access_token: accessToken.trim(),
      }),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setConnections((prev) => [...prev, json.data]);
    setLabel("");
    setPhoneNumberId("");
    setWabaId("");
    setAccessToken("");
    setAdding(false);
  }

  async function deleteConnection(id: string) {
    if (!window.confirm("¿Eliminar esta conexión? Esta acción no se puede deshacer.")) return;
    setConnections((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/api-status/${id}`, { method: "DELETE" });
  }

  function startEdit(c: ApiConnection) {
    setEditingId(c.id);
    setEditLabel(c.label);
    setEditPhoneId(c.phone_number_id);
    setEditWabaId(c.waba_id ?? "");
    setEditToken("");
  }

  async function saveEdit(id: string) {
    const payload: Record<string, string> = {
      label: editLabel.trim(),
      phone_number_id: editPhoneId.trim(),
      waba_id: editWabaId.trim(),
    };
    if (editToken.trim()) payload.access_token = editToken.trim();

    const res = await fetch(`/api/api-status/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setConnections((prev) => prev.map((c) => (c.id === id ? json.data : c)));
    setEditingId(null);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Status API
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Calidad de WhatsApp Business API
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: "var(--brand)", color: "#ffffff" }}
            >
              + Vincular cuenta
            </button>
          ) : (
            <div
              className="flex w-full flex-wrap items-center gap-2 rounded-lg p-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <input
                type="text"
                placeholder="Nombre (ej: Cliente A - Ventas)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="min-w-48 flex-1 rounded-md px-3 py-2 text-sm outline-none"
                style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <input
                type="text"
                placeholder="Phone Number ID"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="min-w-40 flex-1 rounded-md px-3 py-2 text-sm outline-none"
                style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <input
                type="text"
                placeholder="WABA ID (opcional, para ver portafolio)"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="min-w-40 flex-1 rounded-md px-3 py-2 text-sm outline-none"
                style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <input
                type="password"
                placeholder="Access Token"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="min-w-40 flex-1 rounded-md px-3 py-2 text-sm outline-none"
                style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <button
                onClick={createConnection}
                className="rounded-md px-3 py-2 text-sm font-medium"
                style={{ background: "var(--brand)", color: "#ffffff" }}
              >
                Guardar
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setLabel("");
                  setPhoneNumberId("");
                  setWabaId("");
                  setAccessToken("");
                }}
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Cancelar
              </button>
            </div>
          )}

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            {refreshing ? "Actualizando..." : "↻ Actualizar calidad"}
          </button>
        </div>

        {loading && <p style={{ color: "var(--text-secondary)" }}>Cargando...</p>}

        {error && (
          <p
            className="mb-4 rounded-lg p-4"
            style={{ background: "rgba(208,59,59,0.12)", color: "var(--critical)", border: "1px solid var(--critical)" }}
          >
            {error}
          </p>
        )}

        {!loading && (
          <div
            className="overflow-hidden rounded-lg"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" style={{ minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--gridline)" }}>
                    {["Número de API", "Nombre", "Portafolio", "Calidad", ""].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-medium uppercase tracking-wide"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {connections.map((c, idx) => {
                    const q = qualityMeta(c.quality_rating, c.error);
                    const isEditing = editingId === c.id;
                    return isEditing ? (
                      <tr key={c.id} style={{ borderTop: idx === 0 ? "none" : "1px solid var(--gridline)" }}>
                        <td colSpan={5} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={editPhoneId}
                              onChange={(e) => setEditPhoneId(e.target.value)}
                              placeholder="Phone Number ID"
                              className="min-w-40 flex-1 rounded-md px-2 py-1.5 text-sm outline-none"
                              style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                            />
                            <input
                              type="text"
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              placeholder="Nombre"
                              className="min-w-40 flex-1 rounded-md px-2 py-1.5 text-sm outline-none"
                              style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                            />
                            <input
                              type="text"
                              value={editWabaId}
                              onChange={(e) => setEditWabaId(e.target.value)}
                              placeholder="WABA ID"
                              className="min-w-40 flex-1 rounded-md px-2 py-1.5 text-sm outline-none"
                              style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                            />
                            <input
                              type="password"
                              value={editToken}
                              onChange={(e) => setEditToken(e.target.value)}
                              placeholder="Nuevo token (opcional)"
                              className="min-w-40 flex-1 rounded-md px-2 py-1.5 text-sm outline-none"
                              style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                            />
                            <button
                              onClick={() => saveEdit(c.id)}
                              className="text-sm font-medium"
                              style={{ color: "var(--brand)" }}
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-sm"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={c.id} className="group" style={{ borderTop: idx === 0 ? "none" : "1px solid var(--gridline)" }}>
                        <td className="px-4 py-3" style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                          {c.display_phone_number ?? c.phone_number_id}
                        </td>
                        <td className="px-4 py-3">
                          <div style={{ color: "var(--text-primary)" }}>{c.label}</div>
                          {c.verified_name && (
                            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {c.verified_name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                          {c.business_name ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ color: q.color, background: "rgba(255,255,255,0.06)" }}
                            title={c.error ?? undefined}
                          >
                            <span>{q.dot}</span>
                            {q.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => startEdit(c)}
                              className="text-xs"
                              style={{ color: "var(--text-muted)" }}
                              title="Editar conexión"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => deleteConnection(c.id)}
                              className="text-xs"
                              style={{ color: "var(--critical)" }}
                              title="Eliminar conexión"
                            >
                              ✕
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {connections.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                        No hay cuentas vinculadas todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
