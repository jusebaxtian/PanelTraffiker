"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

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
  const { isSuperAdmin } = useCurrentUser();
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [reuseFromId, setReuseFromId] = useState("");
  const [tokenReused, setTokenReused] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPhoneId, setEditPhoneId] = useState("");
  const [editWabaId, setEditWabaId] = useState("");
  const [editToken, setEditToken] = useState("");

  const [search, setSearch] = useState("");
  const [qualityFilter, setQualityFilter] = useState("ALL");
  const [groupByPortfolio, setGroupByPortfolio] = useState(false);

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
    setReuseFromId("");
    setTokenReused(false);
    setAdding(false);
  }

  async function reuseToken(sourceId: string) {
    setReuseFromId(sourceId);
    if (!sourceId) {
      setAccessToken("");
      setTokenReused(false);
      return;
    }
    const res = await fetch(`/api/api-status/${sourceId}/token`);
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setAccessToken(json.access_token);
    setTokenReused(true);
  }

  async function deleteConnection(id: string) {
    if (!window.confirm("¿Eliminar esta conexión? Esta acción no se puede deshacer.")) return;
    setConnections((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/api-status/${id}`, { method: "DELETE" });
  }

  const qualityOptions = useMemo(() => {
    const present = new Set(connections.map((c) => c.quality_rating ?? "UNKNOWN"));
    return Array.from(present);
  }, [connections]);

  const filteredConnections = useMemo(() => {
    let rows = connections;
    if (qualityFilter !== "ALL") {
      rows = rows.filter((c) => (c.quality_rating ?? "UNKNOWN") === qualityFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          (c.verified_name ?? "").toLowerCase().includes(q) ||
          (c.display_phone_number ?? "").toLowerCase().includes(q) ||
          c.phone_number_id.includes(q)
      );
    }
    return rows;
  }, [connections, search, qualityFilter]);

  const groups = useMemo(() => {
    if (!groupByPortfolio) return [{ portfolio: null as string | null, rows: filteredConnections }];
    const map = new Map<string, ApiConnection[]>();
    for (const c of filteredConnections) {
      const key = c.business_name ?? "Sin portafolio";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([portfolio, rows]) => ({ portfolio, rows }));
  }, [filteredConnections, groupByPortfolio]);

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
          {!isSuperAdmin ? null : !adding ? (
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
              <select
                value={reuseFromId}
                onChange={(e) => reuseToken(e.target.value)}
                className="min-w-48 flex-1 rounded-md px-3 py-2 text-sm outline-none"
                style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                <option value="">Copiar token de... (mismo portafolio)</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type={tokenReused ? "text" : "password"}
                placeholder="Access Token"
                value={accessToken}
                onChange={(e) => {
                  setAccessToken(e.target.value);
                  setTokenReused(false);
                  setReuseFromId("");
                }}
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
                  setReuseFromId("");
                  setTokenReused(false);
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

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Buscar por nombre o número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs flex-1 rounded-lg px-3 py-2 text-sm outline-none sm:w-64 sm:flex-none"
            style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <select
            value={qualityFilter}
            onChange={(e) => setQualityFilter(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          >
            <option value="ALL">Todas las calidades</option>
            {qualityOptions.map((q) => (
              <option key={q} value={q}>
                {qualityMeta(q as ApiConnection["quality_rating"], null).label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setGroupByPortfolio((v) => !v)}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              background: groupByPortfolio ? "var(--brand)" : "var(--surface)",
              color: groupByPortfolio ? "#ffffff" : "var(--text-secondary)",
              border: `1px solid ${groupByPortfolio ? "var(--brand)" : "var(--border)"}`,
            }}
          >
            Agrupar por portafolio
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
                  {groups.map((g) => (
                    <Fragment key={g.portfolio ?? "all"}>
                      {groupByPortfolio && g.portfolio && (
                        <tr key={`header-${g.portfolio}`}>
                          <td
                            colSpan={5}
                            className="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}
                          >
                            {g.portfolio} · {g.rows.length}
                          </td>
                        </tr>
                      )}
                      {g.rows.map((c, idx) => {
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
                          {isSuperAdmin && (
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
                          )}
                        </td>
                      </tr>
                    );
                      })}
                    </Fragment>
                  ))}
                  {filteredConnections.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                        {connections.length === 0
                          ? "No hay cuentas vinculadas todavía."
                          : "Ninguna cuenta coincide con los filtros."}
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
