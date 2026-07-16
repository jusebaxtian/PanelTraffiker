"use client";

import { useEffect, useState } from "react";
import type { AdInsight } from "@/lib/metaAds";

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

  const totals = insights.reduce(
    (acc, i) => {
      acc.spend += Number(i.spend ?? 0);
      acc.impressions += Number(i.impressions ?? 0);
      acc.clicks += Number(i.clicks ?? 0);
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0 }
  );

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <main className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-2xl font-semibold text-black dark:text-zinc-50">
          PanelTraffiker — Meta Ads Dashboard
        </h1>

        {loading && <p className="text-zinc-600 dark:text-zinc-400">Cargando métricas...</p>}
        {error && (
          <p className="rounded bg-red-100 p-4 text-red-700 dark:bg-red-950 dark:text-red-300">
            Error: {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <p className="text-sm text-zinc-500">Gasto total</p>
                <p className="text-2xl font-semibold">${totals.spend.toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <p className="text-sm text-zinc-500">Impresiones</p>
                <p className="text-2xl font-semibold">{totals.impressions.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <p className="text-sm text-zinc-500">Clics</p>
                <p className="text-2xl font-semibold">{totals.clicks.toLocaleString()}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-900">
                  <tr>
                    <th className="p-3">Cuenta</th>
                    <th className="p-3">Campaña</th>
                    <th className="p-3">Gasto</th>
                    <th className="p-3">Impresiones</th>
                    <th className="p-3">Clics</th>
                    <th className="p-3">CTR</th>
                    <th className="p-3">CPC</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.map((row, idx) => (
                    <tr key={idx} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="p-3">{row.account_id}</td>
                      <td className="p-3">{row.campaign_name ?? "-"}</td>
                      <td className="p-3">${Number(row.spend ?? 0).toFixed(2)}</td>
                      <td className="p-3">{Number(row.impressions ?? 0).toLocaleString()}</td>
                      <td className="p-3">{Number(row.clicks ?? 0).toLocaleString()}</td>
                      <td className="p-3">{row.ctr ?? "-"}%</td>
                      <td className="p-3">${row.cpc ?? "-"}</td>
                    </tr>
                  ))}
                  {insights.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-3 text-center text-zinc-500">
                        No hay datos disponibles
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
