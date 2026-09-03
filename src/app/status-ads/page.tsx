"use client";

import { useEffect, useMemo, useState } from "react";

interface AdAccountBilling {
  accountId: string;
  name: string;
  businessName: string | null;
  currency: string;
  amountSpent: number;
  spendCap: number;
  balance: number;
  accountStatus: number;
  disableReason: number;
  error: string | null;
}

const ACCOUNT_STATUS_LABEL: Record<number, string> = {
  1: "Activa",
  2: "Deshabilitada",
  3: "Sin liquidar",
  7: "En revisión de riesgo",
  8: "Pendiente de liquidación",
  9: "Periodo de gracia",
  100: "Pendiente de cierre",
  101: "Cerrada",
};

const DISABLE_REASON_LABEL: Record<number, string> = {
  1: "Política de integridad de anuncios",
  2: "Revisión de propiedad intelectual",
  3: "Riesgo de pago",
  4: "Cuenta gris cerrada",
  5: "Revisión AFC",
  6: "Integridad del negocio",
  7: "Cierre permanente",
  8: "Cuenta de revendedor sin uso",
  9: "Cuenta sin uso",
  10: "Cuenta paraguas",
  11: "Política de integridad del Business Manager",
  12: "Cuenta con información incorrecta",
  13: "Entidad legal desvinculada",
  14: "Bloqueo por amenaza",
  15: "Bloqueada por Meta (administrativo)",
  16: "Acuerdo de medios retirado",
};

function statusMeta(status: number, error: string | null) {
  if (error) return { color: "var(--critical)", label: "Error", dot: "⚠" };
  if (status === 1) return { color: "var(--good)", label: "Activa", dot: "●" };
  if (status === 9 || status === 3 || status === 7 || status === 8) {
    return { color: "var(--series-3)", label: ACCOUNT_STATUS_LABEL[status] ?? "Atención", dot: "●" };
  }
  return { color: "var(--critical)", label: ACCOUNT_STATUS_LABEL[status] ?? `Estado ${status}`, dot: "●" };
}

function currency(n: number, code: string) {
  if (!code) return n.toLocaleString("es-CO");
  try {
    return n.toLocaleString("es-CO", { style: "currency", currency: code, maximumFractionDigits: 0 });
  } catch {
    return `${n.toLocaleString("es-CO")} ${code}`;
  }
}

export default function StatusAdsPage() {
  const [accounts, setAccounts] = useState<AdAccountBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function load(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    fetch("/api/status-ads")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else {
          setAccounts(json.data);
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

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.trim().toLowerCase();
    return accounts.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.businessName ?? "").toLowerCase().includes(q) || a.accountId.includes(q)
    );
  }, [accounts, search]);

  const totalPending = accounts.reduce((sum, a) => sum + (a.error ? 0 : a.balance), 0);
  const pendingCurrency = accounts.find((a) => a.currency)?.currency ?? "COP";
  const withIssues = accounts.filter((a) => a.error || a.accountStatus !== 1).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Status Ads
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Facturación de cuentas publicitarias de Meta
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        {!loading && !error && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Cuentas vinculadas" value={String(accounts.length)} />
            <StatTile label="Saldo pendiente" value={currency(totalPending, pendingCurrency)} accent="var(--series-3)" />
            <StatTile label="Con problema de estado" value={String(withIssues)} accent="var(--critical)" />
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Buscar por nombre o cuenta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs flex-1 rounded-lg px-3 py-2 text-sm outline-none sm:w-64 sm:flex-none"
            style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            {refreshing ? "Actualizando..." : "↻ Actualizar"}
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
                    {["Nombre", "Estado", "Saldo pendiente"].map((h) => (
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
                  {filtered.map((a, idx) => {
                    const status = statusMeta(a.accountStatus, a.error);
                    const reason = DISABLE_REASON_LABEL[a.disableReason];
                    return (
                      <tr key={a.accountId} style={{ borderTop: idx === 0 ? "none" : "1px solid var(--gridline)" }}>
                        <td className="px-4 py-3">
                          <div style={{ color: "var(--text-primary)" }}>{a.name}</div>
                          {a.businessName && (
                            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {a.businessName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ color: status.color, background: "rgba(255,255,255,0.06)" }}
                            title={a.error ?? reason ?? undefined}
                          >
                            <span>{status.dot}</span>
                            {status.label}
                          </span>
                          {reason && (
                            <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                              {reason}
                            </div>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 font-medium"
                          style={{ color: a.balance > 0 ? "var(--critical)" : "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}
                        >
                          {a.error ? "-" : currency(a.balance, a.currency)}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                        {accounts.length === 0 ? "No hay cuentas publicitarias vinculadas todavía." : "Ninguna cuenta coincide con la búsqueda."}
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

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: accent ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
    </div>
  );
}
