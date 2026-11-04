"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { GptMetrics, GptReport, GptSegment } from "@/lib/chatgptAds";

const DATE_PRESETS = [
  { label: "Hoy", value: "today" },
  { label: "Ayer", value: "yesterday" },
  { label: "7 días", value: "last_7d" },
  { label: "Este mes", value: "this_month" },
] as const;

const PLATFORM_LABEL: Record<string, string> = {
  android_app: "App Android",
  android_web: "Web Android",
  ios_app: "App iPhone",
  ios_web: "Web iPhone",
  desktop_web: "Web computador",
  windows_app: "App Windows",
  web: "Web",
  unknown: "Desconocida",
};

const DEVICE_LABEL: Record<string, string> = { mobile: "Celular", desktop: "Computador", tablet: "Tablet", unknown: "Desconocido" };

const STATUS_LABEL: Record<string, string> = { active: "Activo", paused: "Pausado", archived: "Archivado", approved: "Aprobado", pending: "En revisión", rejected: "Rechazado" };

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const num = (n: number) => Math.round(n).toLocaleString("es-CO");
const pct = (ratio: number) => `${(ratio * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;

function fmtDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const cardStyle = { background: "var(--surface)", border: "1px solid var(--border)" } as const;

export default function ChatgptAdsPage() {
  const [datePreset, setDatePreset] = useState<string>("last_7d");
  const [customRange, setCustomRange] = useState<{ since: string; until: string } | null>(null);
  const [customDraft, setCustomDraft] = useState({ since: "", until: "" });
  const [showCustom, setShowCustom] = useState(false);
  const [report, setReport] = useState<GptReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const requestId = useRef(0);

  const queryKey = customRange ? `${customRange.since}_${customRange.until}` : datePreset;
  const loading = loadedKey !== queryKey;

  useEffect(() => {
    const id = ++requestId.current;
    const qs = new URLSearchParams();
    if (customRange) {
      qs.set("since", customRange.since);
      qs.set("until", customRange.until);
    } else {
      qs.set("date_preset", datePreset);
    }
    fetch(`/api/chatgpt-ads?${qs.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (id !== requestId.current) return;
        if (json.error) {
          setReport(null);
          setError(json.error);
        } else {
          setReport(json.data);
          setError(null);
        }
      })
      .catch((e) => {
        if (id !== requestId.current) return;
        setReport(null);
        setError(e.message);
      })
      .finally(() => id === requestId.current && setLoadedKey(queryKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const totals = report?.totals;
  const maxSpend = Math.max(1, ...(report?.days ?? []).map((d) => d.spend));

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          ChatGPT Ads
        </span>
        <span className="hidden text-sm sm:block" style={{ color: "var(--text-muted)" }}>
          {report ? `${report.account.name} · ${report.account.currency} · hora de Colombia` : "Reporte diario de anuncios en ChatGPT"}
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {DATE_PRESETS.map((p) => {
            const active = !customRange && p.value === datePreset;
            return (
              <button
                key={p.value}
                onClick={() => {
                  setCustomRange(null);
                  setShowCustom(false);
                  setDatePreset(p.value);
                }}
                className="rounded-full px-4 py-1.5 text-sm font-medium"
                style={{ background: active ? "var(--brand)" : "var(--surface)", color: active ? "#ffffff" : "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                {p.label}
              </button>
            );
          })}
          <button
            onClick={() => setShowCustom((v) => !v)}
            className="rounded-full px-4 py-1.5 text-sm font-medium"
            style={{ background: customRange ? "var(--brand)" : "var(--surface)", color: customRange ? "#ffffff" : "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            {customRange ? `${customRange.since} → ${customRange.until}` : "Fechas…"}
          </button>
          {showCustom && (
            <span className="flex flex-wrap items-center gap-2">
              {(["since", "until"] as const).map((k) => (
                <input
                  key={k}
                  type="date"
                  value={customDraft[k]}
                  onChange={(e) => setCustomDraft((d) => ({ ...d, [k]: e.target.value }))}
                  className="rounded-md px-2 py-1 text-sm"
                  style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
              ))}
              <button
                disabled={!customDraft.since || !customDraft.until || customDraft.since > customDraft.until}
                onClick={() => {
                  setCustomRange({ ...customDraft });
                  setShowCustom(false);
                }}
                className="rounded-md px-3 py-1 text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--brand)", color: "#ffffff" }}
              >
                Aplicar
              </button>
            </span>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-lg p-3 text-sm" style={{ ...cardStyle, color: "var(--critical)" }}>
            {error}
          </p>
        )}

        {!report && loading && (
          <p className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Consultando ChatGPT Ads…
          </p>
        )}

        {report && totals && (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Gasto" value={money(totals.spend)} />
              <Tile label="Conversiones" value={num(totals.conversions)} />
              <Tile label="Costo por conversión" value={totals.cpa !== null ? money(totals.cpa) : "-"} />
              <Tile label="Clics" value={num(totals.clicks)} />
              <Tile label="CTR" value={pct(totals.ctr)} />
              <Tile label="Impresiones" value={num(totals.impressions)} />
            </div>

            {/* ---------- Reporte diario ---------- */}
            <section className="mb-6 rounded-xl p-4" style={cardStyle}>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Reporte diario
              </h2>
              <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
                Toca un día para ver sus anuncios.
              </p>
              {report.days.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Sin actividad en este período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    <thead>
                      <tr style={{ color: "var(--text-muted)" }}>
                        {["Día", "Gasto", "", "Impresiones", "Clics", "CTR", "CPC", "Conversiones", "Costo/conv."].map((h, i) => (
                          <th key={i} className={`whitespace-nowrap px-2 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.days.map((d) => (
                        <Fragment key={d.date}>
                          <tr
                            onClick={() => setOpenDay(openDay === d.date ? null : d.date)}
                            className="cursor-pointer"
                            style={{ borderTop: "1px solid var(--gridline)" }}
                          >
                            <td className="whitespace-nowrap px-2 py-2 text-left font-medium">
                              {openDay === d.date ? "▾" : "▸"} {fmtDay(d.date)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-right">{money(d.spend)}</td>
                            <td className="w-24 px-2 py-2">
                              <div className="h-2 min-w-20 rounded-full" style={{ background: "var(--surface-raised)" }}>
                                <div className="h-2 rounded-full" style={{ width: `${(d.spend / maxSpend) * 100}%`, background: "var(--brand)" }} />
                              </div>
                            </td>
                            <MetricCells m={d} />
                          </tr>
                          {openDay === d.date &&
                            d.ads.map((a) => (
                              <tr key={a.ad_id} style={{ background: "var(--surface-raised)", color: "var(--text-secondary)" }}>
                                <td className="whitespace-nowrap px-2 py-1.5 pl-7 text-left">{a.ad_name}</td>
                                <td className="whitespace-nowrap px-2 py-1.5 text-right">{money(a.spend)}</td>
                                <td />
                                <MetricCells m={a} />
                              </tr>
                            ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                El gasto de las últimas horas llega con retraso y las conversiones pueden tardar hasta un día en aparecer: los datos de hoy y de ayer todavía pueden subir.
              </p>
            </section>

            {/* ---------- Anuncios ---------- */}
            <section className="mb-6 rounded-xl p-4" style={cardStyle}>
              <h2 className="mb-3 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Anuncios
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {report.ads.map((a) => (
                  <div key={a.id} className="rounded-lg p-3" style={{ background: "var(--surface-raised)" }}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        {a.name}
                      </span>
                      <span className="text-[11px] font-semibold" style={{ color: a.status === "active" ? "var(--good)" : "var(--text-muted)" }}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {a.title ?? "-"}
                    </p>
                    <p className="mb-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {a.body ?? ""}
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                      <Stat label="Gasto" value={money(a.spend)} />
                      <Stat label="Conversiones" value={num(a.conversions)} />
                      <Stat label="Costo/conv." value={a.cpa !== null ? money(a.cpa) : "-"} />
                      <Stat label="Clics" value={num(a.clicks)} />
                      <Stat label="CTR" value={pct(a.ctr)} />
                      <Stat label="Impresiones" value={num(a.impressions)} />
                    </div>
                    <p className="mt-2 flex flex-wrap justify-between gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>Revisión: {STATUS_LABEL[a.review_status] ?? a.review_status}</span>
                      {a.target_url && (
                        <a href={a.target_url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>
                          Ver destino ↗
                        </a>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* ---------- Dispositivo y plataforma ---------- */}
            <div className="mb-6 grid gap-5 md:grid-cols-2">
              <SegmentCard title="Por dispositivo" rows={report.devices} labels={DEVICE_LABEL} />
              <SegmentCard title="Por plataforma" rows={report.platforms} labels={PLATFORM_LABEL} />
            </div>

            {/* ---------- Campañas ---------- */}
            <section className="rounded-xl p-4" style={cardStyle}>
              <h2 className="mb-3 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Campañas
              </h2>
              {report.campaigns.map((c) => (
                <div key={c.id} className="mb-3 text-sm last:mb-0" style={{ color: "var(--text-secondary)" }}>
                  <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {c.name} <span className="ml-1 text-xs" style={{ color: c.status === "active" ? "var(--good)" : "var(--text-muted)" }}>{STATUS_LABEL[c.status] ?? c.status}</span>
                  </p>
                  <p className="text-xs">
                    {c.daily_budget !== null ? `Presupuesto diario: ${money(c.daily_budget)}` : "Sin presupuesto diario"} · Países: {c.countries.join(", ") || "-"}
                    {c.conversion_events.length > 0 ? ` · Conversión: ${c.conversion_events.join(", ")}` : ""}
                  </p>
                  {c.context_hints.length > 0 && (
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      Temas de conversación: {c.context_hints.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function MetricCells({ m }: { m: GptMetrics }) {
  return (
    <>
      <td className="whitespace-nowrap px-2 py-2 text-right">{num(m.impressions)}</td>
      <td className="whitespace-nowrap px-2 py-2 text-right">{num(m.clicks)}</td>
      <td className="whitespace-nowrap px-2 py-2 text-right">{pct(m.ctr)}</td>
      <td className="whitespace-nowrap px-2 py-2 text-right">{money(m.cpc)}</td>
      <td className="whitespace-nowrap px-2 py-2 text-right">{num(m.conversions)}</td>
      <td className="whitespace-nowrap px-2 py-2 text-right">{m.cpa !== null ? money(m.cpa) : "-"}</td>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-4" style={cardStyle}>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function SegmentCard({ title, rows, labels }: { title: string; rows: GptSegment[]; labels: Record<string, string> }) {
  const totalImp = rows.reduce((s, r) => s + r.impressions, 0);
  return (
    <section className="rounded-xl p-4" style={cardStyle}>
      <h2 className="mb-3 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      {rows.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sin datos.
        </p>
      )}
      {rows.map((r) => {
        const share = totalImp > 0 ? (r.impressions / totalImp) * 100 : 0;
        return (
          <div key={r.key} className="mb-3 last:mb-0">
            <div className="flex justify-between text-sm" style={{ color: "var(--text-primary)" }}>
              <span>{labels[r.key] ?? r.key}</span>
              <span className="tabular-nums">{share.toFixed(0)}% de impresiones</span>
            </div>
            <div className="mt-1 h-2 rounded-full" style={{ background: "var(--surface-raised)" }}>
              <div className="h-2 rounded-full" style={{ width: `${share}%`, background: "var(--brand)" }} />
            </div>
            <p className="mt-1 text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {num(r.clicks)} clics · CTR {pct(r.ctr)} · {money(r.spend)}
            </p>
          </div>
        );
      })}
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        ChatGPT Ads no da conversiones por segmento.
      </p>
    </section>
  );
}
