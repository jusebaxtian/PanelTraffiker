"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdInsight } from "@/lib/metaAds";
import { conversationsStarted } from "@/lib/metaAds";
import CostPerLeadChart, { type CostPerLeadDatum } from "@/components/CostPerLeadChart";
import AgentTypePieChart from "@/components/AgentTypePieChart";
import type { Office } from "@/lib/distribucion";
import { fmtDate, getCurrentRange, getPreviousRange } from "@/lib/dateRanges";

function currency(n: number) {
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

interface EnrichedInsight extends AdInsight {
  result: number;
  status?: string;
  objective?: string;
  daily_budget?: string;
  today_spend: number;
}

function humanize(value?: string) {
  if (!value) return "-";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const DATE_PRESETS = [
  { label: "Hoy", value: "today" },
  { label: "Ayer", value: "yesterday" },
  { label: "7 días", value: "last_7d" },
  { label: "Este mes", value: "this_month" },
  { label: "Mes anterior", value: "last_month" },
] as const;

export default function GraficosPage() {
  const [insights, setInsights] = useState<EnrichedInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<string>("last_7d");
  const [customRange, setCustomRange] = useState<{ since: string; until: string } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [threshold, setThreshold] = useState(6000);
  const [offices, setOffices] = useState<Office[]>([]);
  const [previousSpend, setPreviousSpend] = useState<number | null>(null);
  const [previousLoading, setPreviousLoading] = useState(true);

  useEffect(() => {
    fetch("/api/offices")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setOffices(json.data);
      })
      .catch(() => {});
  }, []);

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

  const currentRange = useMemo(
    () => getCurrentRange(datePreset, customRange, new Date()),
    [datePreset, customRange]
  );
  const previousRange = useMemo(
    () => getPreviousRange(datePreset, customRange, currentRange),
    [datePreset, customRange, currentRange]
  );

  useEffect(() => {
    setPreviousLoading(true);
    const since = fmtDate(previousRange.since);
    const until = fmtDate(previousRange.until);
    fetch(`/api/insights?since=${since}&until=${until}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) {
          const total = (json.data as EnrichedInsight[]).reduce(
            (sum, i) => sum + Number(i.spend ?? 0),
            0
          );
          setPreviousSpend(total);
        }
      })
      .catch(() => setPreviousSpend(null))
      .finally(() => setPreviousLoading(false));
  }, [previousRange]);

  const currentSpend = useMemo(
    () => insights.reduce((sum, i) => sum + Number(i.spend ?? 0), 0),
    [insights]
  );

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

  const chartData = useMemo<CostPerLeadDatum[]>(
    () =>
      filteredInsights.map((i) => ({
        campaign: i.campaign_name ?? "-",
        account: i.account_id?.replace("act_", "") ?? "",
        spend: Number(i.spend ?? 0),
        leads: conversationsStarted(i),
      })),
    [filteredInsights]
  );

  const agentTypeData = useMemo(() => {
    const allAgents = offices.flatMap((o) => o.agents);
    return {
      ejecutivos: allAgents.filter((a) => a.type === "ejecutivo").length,
      junior: allAgents.filter((a) => a.type === "junior").length,
    };
  }, [offices]);

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Gráficos
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

        <div className="mb-8 flex flex-wrap gap-2">
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

          <label
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <span className="whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
              Tope $
            </span>
            <input
              type="number"
              min={0}
              step={500}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 bg-transparent text-right outline-none"
              style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
            />
          </label>
        </div>

        {loading && <p style={{ color: "var(--text-secondary)" }}>Cargando métricas...</p>}

        {error && (
          <p
            className="rounded-lg p-4"
            style={{ background: "rgba(208,59,59,0.12)", color: "var(--critical)", border: "1px solid var(--critical)" }}
          >
            Error: {error}
          </p>
        )}

        {!loading && !error && (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SpendTile label="Gasto período actual" period={currentRange.label} value={currentSpend} accent="var(--brand)" />
            <SpendTile
              label="Gasto mismo período (mes anterior)"
              period={previousRange.label}
              value={previousSpend}
              loading={previousLoading}
              compareTo={currentSpend}
            />
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
            <div className="xl:flex-[2]">
              <CostPerLeadChart data={chartData} threshold={threshold} />
            </div>
            <div className="flex xl:flex-1">
              <AgentTypePieChart data={agentTypeData} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SpendTile({
  label,
  period,
  value,
  loading,
  accent,
  compareTo,
}: {
  label: string;
  period: string;
  value: number | null;
  loading?: boolean;
  accent?: string;
  compareTo?: number;
}) {
  const delta =
    compareTo !== undefined && value !== null && value > 0 ? ((compareTo - value) / value) * 100 : null;

  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {period}
        </span>
      </div>
      <p
        className="mt-1 text-2xl font-semibold"
        style={{ color: accent ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
      >
        {loading ? "…" : value !== null ? currency(value) : "-"}
      </p>
      {delta !== null && (
        <p
          className="mt-1 text-xs font-medium"
          style={{ color: delta > 0 ? "var(--critical)" : delta < 0 ? "var(--good)" : "var(--text-muted)" }}
        >
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "–"} {Math.abs(delta).toFixed(1)}% vs. este período
        </p>
      )}
    </div>
  );
}
