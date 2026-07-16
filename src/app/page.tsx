"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AdInsight } from "@/lib/metaAds";
import { conversationsStarted } from "@/lib/metaAds";

interface EnrichedInsight extends AdInsight {
  result: number;
  status?: string;
  objective?: string;
  daily_budget?: string;
  today_spend: number;
}

function currency(n: number) {
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function number(n: number) {
  return n.toLocaleString("es-CO");
}

function humanize(value?: string) {
  if (!value) return "-";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function statusColor(status?: string) {
  switch (status) {
    case "ACTIVE":
      return "var(--good)";
    case "PAUSED":
      return "var(--text-muted)";
    case "DELETED":
    case "ARCHIVED":
      return "var(--critical)";
    default:
      return "var(--series-3)";
  }
}

const DATE_PRESETS = [
  { label: "Hoy", value: "today" },
  { label: "Ayer", value: "yesterday" },
  { label: "7 días", value: "last_7d" },
  { label: "Este mes", value: "this_month" },
  { label: "Mes anterior", value: "last_month" },
] as const;

const COLUMNS = [
  { key: "campaign", label: "Campaña", defaultWidth: 260 },
  { key: "status", label: "Estado", defaultWidth: 110 },
  { key: "objective", label: "Objetivo", defaultWidth: 150 },
  { key: "result", label: "Resultado", defaultWidth: 110 },
  { key: "costPerResult", label: "Costo/resultado", defaultWidth: 140 },
  { key: "spend", label: "Gasto", defaultWidth: 120 },
  { key: "dailyBudget", label: "Gasto diario", defaultWidth: 120 },
  { key: "todaySpend", label: "Gasto hoy", defaultWidth: 120 },
  { key: "ctr", label: "CTR", defaultWidth: 90 },
  { key: "frequency", label: "Frecuencia", defaultWidth: 100 },
  { key: "uniqueClicks", label: "Clics únicos", defaultWidth: 110 },
] as const;

const COLUMN_WIDTHS_STORAGE_KEY = "paneltraffiker.columnWidths";
const MIN_COLUMN_WIDTH = 70;

function useColumnWidths() {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const defaults = Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]));
    if (typeof window === "undefined") return defaults;
    try {
      const stored = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  });

  const resizing = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent | MouseEvent) {
      if (!resizing.current) return;
      const { key, startX, startWidth } = resizing.current;
      const next = Math.max(MIN_COLUMN_WIDTH, startWidth + (e.clientX - startX));
      setWidths((prev) => {
        const updated = { ...prev, [key]: next };
        window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    }
    function onUp() {
      resizing.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startResize(key: string, startX: number) {
    resizing.current = { key, startX, startWidth: widths[key] };
  }

  return { widths, startResize };
}

export default function Home() {
  const [insights, setInsights] = useState<EnrichedInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<string>("last_7d");
  const [customRange, setCustomRange] = useState<{ since: string; until: string } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const { widths, startResize } = useColumnWidths();

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = customRange
      ? `since=${customRange.since}&until=${customRange.until}`
      : `date_preset=${datePreset}`;
    fetch(`/api/insights?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setInsights(json.data);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [datePreset, customRange]);

  const statusOptions = useMemo(() => {
    const present = new Set(insights.map((i) => i.status).filter(Boolean) as string[]);
    return Array.from(present).sort();
  }, [insights]);

  const filteredInsights = useMemo(() => {
    let rows = insights;
    if (statusFilter !== "ALL") {
      rows = rows.filter((i) => i.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((i) => i.campaign_name?.toLowerCase().includes(q));
    }
    return rows;
  }, [insights, search, statusFilter]);

  const totals = useMemo(
    () =>
      filteredInsights.reduce(
        (acc, i) => {
          acc.spend += Number(i.spend ?? 0);
          acc.impressions += Number(i.impressions ?? 0);
          acc.clicks += Number(i.clicks ?? 0);
          acc.reach += Number(i.reach ?? 0);
          acc.conversations += conversationsStarted(i);
          return acc;
        },
        { spend: 0, impressions: 0, clicks: 0, reach: 0, conversations: 0 }
      ),
    [filteredInsights]
  );

  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const costPerResult = totals.conversations > 0 ? totals.spend / totals.conversations : 0;
  const accountCount = useMemo(
    () => new Set(filteredInsights.map((i) => i.account_id)).size,
    [filteredInsights]
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Dashboard
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Meta Ads Dashboard
        </span>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {DATE_PRESETS.map((preset) => {
            const active = !customRange && preset.value === datePreset;
            return (
              <button
                key={preset.value}
                onClick={() => {
                  setCustomRange(null);
                  setDatePreset(preset.value);
                }}
                className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: active ? "var(--brand)" : "var(--surface)",
                  color: active ? "#ffffff" : "var(--text-secondary)",
                  border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                }}
              >
                {preset.label}
              </button>
            );
          })}

          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{
              background: customRange ? "var(--brand)" : "var(--surface)",
              border: `1px solid ${customRange ? "var(--brand)" : "var(--border)"}`,
            }}
          >
            <input
              type="date"
              aria-label="Desde"
              value={customRange?.since ?? ""}
              onChange={(e) =>
                setCustomRange((prev) => ({ since: e.target.value, until: prev?.until ?? e.target.value }))
              }
              className="bg-transparent text-sm outline-none"
              style={{ color: customRange ? "#ffffff" : "var(--text-secondary)", colorScheme: "dark" }}
            />
            <span style={{ color: customRange ? "#ffffff" : "var(--text-muted)" }}>–</span>
            <input
              type="date"
              aria-label="Hasta"
              value={customRange?.until ?? ""}
              onChange={(e) =>
                setCustomRange((prev) => ({ since: prev?.since ?? e.target.value, until: e.target.value }))
              }
              className="bg-transparent text-sm outline-none"
              style={{ color: customRange ? "#ffffff" : "var(--text-secondary)", colorScheme: "dark" }}
            />
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Buscar campaña..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg px-3 py-2 text-sm outline-none sm:w-72"
            style={{
              background: "var(--surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            <option value="ALL">Todos los estados</option>
            {Array.from(new Set(["ACTIVE", ...statusOptions])).map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <p style={{ color: "var(--text-secondary)" }}>Cargando métricas...</p>
        )}

        {error && (
          <p
            className="rounded-lg p-4"
            style={{ background: "rgba(208,59,59,0.12)", color: "var(--critical)", border: "1px solid var(--critical)" }}
          >
            Error: {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile label="Cuentas" value={String(accountCount)} />
              <StatTile label="Inversión total" value={currency(totals.spend)} accent="var(--brand)" />
              <StatTile label="Alcance" value={number(totals.reach)} />
              <StatTile label="Costo por resultado" value={currency(costPerResult)} />
              <StatTile label="Conversaciones iniciadas" value={number(totals.conversations)} accent="var(--series-2)" />
              <StatTile label="CTR" value={`${avgCtr.toFixed(2)}%`} />
            </div>

            <div
              className="overflow-hidden rounded-lg"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
            >
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left text-sm"
                  style={{ tableLayout: "fixed", minWidth: 880 }}
                >
                  <colgroup>
                    {COLUMNS.map((col) => (
                      <col key={col.key} style={{ width: widths[col.key] }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--gridline)" }}>
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className="relative select-none whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {col.label}
                          <span
                            onPointerDown={(e) => {
                              e.preventDefault();
                              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                              startResize(col.key, e.clientX);
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              startResize(col.key, e.clientX);
                            }}
                            className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                            style={{ userSelect: "none", touchAction: "none" }}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInsights.map((row, idx) => {
                      const costPerRowResult = row.result > 0 ? Number(row.spend ?? 0) / row.result : 0;
                      return (
                        <tr
                          key={idx}
                          style={{ borderTop: idx === 0 ? "none" : "1px solid var(--gridline)" }}
                        >
                          <td className="overflow-hidden px-4 py-3">
                            <div className="truncate" style={{ color: "var(--text-primary)" }}>
                              {row.campaign_name ?? "-"}
                            </div>
                            <div
                              className="text-xs"
                              style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}
                            >
                              {row.account_id?.replace("act_", "")}
                            </div>
                          </td>
                          <td className="overflow-hidden px-4 py-3">
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                color: statusColor(row.status),
                                background: "rgba(255,255,255,0.06)",
                              }}
                            >
                              {humanize(row.status)}
                            </span>
                          </td>
                          <td className="overflow-hidden truncate px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                            {humanize(row.objective)}
                          </td>
                          <td className="overflow-hidden px-4 py-3" style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                            {number(row.result)}
                          </td>
                          <td className="overflow-hidden px-4 py-3" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                            {currency(costPerRowResult)}
                          </td>
                          <td className="overflow-hidden px-4 py-3" style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                            {currency(Number(row.spend ?? 0))}
                          </td>
                          <td className="overflow-hidden px-4 py-3" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                            {row.daily_budget ? currency(Number(row.daily_budget)) : "-"}
                          </td>
                          <td className="overflow-hidden px-4 py-3" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                            {currency(row.today_spend)}
                          </td>
                          <td className="overflow-hidden px-4 py-3" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                            {Number(row.ctr ?? 0).toFixed(2)}%
                          </td>
                          <td className="overflow-hidden px-4 py-3" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                            {Number(row.frequency ?? 0).toFixed(2)}
                          </td>
                          <td className="overflow-hidden px-4 py-3" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                            {number(Number(row.unique_clicks ?? 0))}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredInsights.length === 0 && (
                      <tr>
                        <td colSpan={COLUMNS.length} className="px-4 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                          No hay datos disponibles
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold"
        style={{ color: accent ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}
