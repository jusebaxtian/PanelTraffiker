"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdInsight } from "@/lib/metaAds";

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

export default function Home() {
  const [insights, setInsights] = useState<AdInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/insights")
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
  }, []);

  const totals = useMemo(
    () =>
      insights.reduce(
        (acc, i) => {
          acc.spend += Number(i.spend ?? 0);
          acc.impressions += Number(i.impressions ?? 0);
          acc.clicks += Number(i.clicks ?? 0);
          return acc;
        },
        { spend: 0, impressions: 0, clicks: 0 }
      ),
    [insights]
  );

  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const avgCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const accountCount = useMemo(
    () => new Set(insights.map((i) => i.account_id)).size,
    [insights]
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-8 py-4"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
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
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Meta Ads Dashboard
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-8">
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
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile label="Cuentas" value={String(accountCount)} />
              <StatTile label="Gasto total" value={currency(totals.spend)} accent="var(--brand)" />
              <StatTile label="Impresiones" value={number(totals.impressions)} />
              <StatTile label="Clics" value={number(totals.clicks)} />
              <StatTile label="CTR / CPC prom." value={`${avgCtr.toFixed(2)}% · ${currency(avgCpc)}`} />
            </div>

            <div
              className="overflow-hidden rounded-lg"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--gridline)" }}>
                      {["Cuenta", "Campaña", "Gasto", "Impresiones", "Clics", "CTR", "CPC"].map((h) => (
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
                    {insights.map((row, idx) => (
                      <tr
                        key={idx}
                        className="transition-colors"
                        style={{
                          borderTop: idx === 0 ? "none" : "1px solid var(--gridline)",
                        }}
                      >
                        <td className="px-4 py-3" style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                          {row.account_id?.replace("act_", "")}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                          {row.campaign_name ?? "-"}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                          {currency(Number(row.spend ?? 0))}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                          {number(Number(row.impressions ?? 0))}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                          {number(Number(row.clicks ?? 0))}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                          {Number(row.ctr ?? 0).toFixed(2)}%
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                          {currency(Number(row.cpc ?? 0))}
                        </td>
                      </tr>
                    ))}
                    {insights.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center" style={{ color: "var(--text-muted)" }}>
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
