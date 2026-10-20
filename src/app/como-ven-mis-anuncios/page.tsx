"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GeoMap, { cprOf, type MapSelection, type Metric, type ZoneAgg } from "@/components/GeoMap";
import { GENDER_LABEL, countryLabel, regionKey, regionLabel } from "@/lib/geoNames";

interface GeoAdRow {
  account_id: string;
  account_name: string;
  campaign_id: string;
  campaign_name: string;
  ad_id: string;
  ad_name: string;
  country: string;
  region: string;
  spend: number;
  impressions: number;
  results: number;
}

interface DemoRow {
  age: string;
  gender: string;
  spend: number;
  impressions: number;
  results: number;
}

interface GeoData {
  ads: GeoAdRow[];
  demo: DemoRow[];
  errors: string[];
  range: { since: string; until: string };
}

interface CampaignOption {
  campaign_id: string;
  campaign_name: string;
  account_name?: string;
  status?: string;
}

const DATE_PRESETS = [
  { label: "Hoy", value: "today" },
  { label: "Ayer", value: "yesterday" },
  { label: "7 días", value: "last_7d" },
  { label: "Este mes", value: "this_month" },
] as const;

const METRICS: { label: string; value: Metric }[] = [
  { label: "Gasto", value: "spend" },
  { label: "Resultados", value: "results" },
  { label: "Costo por resultado", value: "cpr" },
];

const CPR_IDEAL = 5000;
const CPR_MAX = 6500;
const LOW_SAMPLE = 5;

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

function cprColor(cpr: number, results: number): string {
  if (results < LOW_SAMPLE || cpr === 0) return "var(--text-muted)";
  if (cpr <= CPR_IDEAL) return "var(--good)";
  if (cpr <= CPR_MAX) return "var(--series-3)";
  return "var(--critical)";
}

function add(a: ZoneAgg | undefined, spend: number, results: number, impressions: number): ZoneAgg {
  const cur = a ?? { spend: 0, results: 0, impressions: 0 };
  cur.spend += spend;
  cur.results += results;
  cur.impressions += impressions;
  return cur;
}

export default function ComoVenMisAnunciosPage() {
  const [datePreset, setDatePreset] = useState<string>("last_7d");
  const [customRange, setCustomRange] = useState<{ since: string; until: string } | null>(null);
  const [customDraft, setCustomDraft] = useState({ since: "", until: "" });
  const [showCustom, setShowCustom] = useState(false);
  const [metric, setMetric] = useState<Metric>("spend");

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [pickedCampaigns, setPickedCampaigns] = useState<string[]>([]);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState("");

  const [data, setData] = useState<GeoData | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [focusCountry, setFocusCountry] = useState<string | null>(null);
  const [selected, setSelected] = useState<MapSelection | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    fetch("/api/proyeccion/campaigns")
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) {
          const list: CampaignOption[] = json.data ?? [];
          list.sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") || (a.campaign_name ?? "").localeCompare(b.campaign_name ?? ""));
          setCampaigns(list);
        }
      })
      .catch(() => {});
  }, []);

  const campaignKey = pickedCampaigns.join(",");
  const rangeKey = customRange ? `${customRange.since}_${customRange.until}` : datePreset;
  const queryKey = `${rangeKey}|${campaignKey}`;
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
    if (campaignKey) qs.set("campaign_ids", campaignKey);
    fetch(`/api/como-ven?${qs.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (id !== requestId.current) return;
        if (json.error) {
          setError(json.error);
        } else {
          setData(json.data);
          setError(null);
        }
      })
      .catch((e) => id === requestId.current && setError(e.message))
      .finally(() => id === requestId.current && setLoadedKey(queryKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, campaignKey]);

  const agg = useMemo(() => {
    const countryAgg: Record<string, ZoneAgg> = {};
    const regionAgg: Record<string, ZoneAgg> = {};
    const regionNames: Record<string, string> = {};
    for (const r of data?.ads ?? []) {
      countryAgg[r.country] = add(countryAgg[r.country], r.spend, r.results, r.impressions);
      const key = regionKey(r.country, r.region);
      regionAgg[key] = add(regionAgg[key], r.spend, r.results, r.impressions);
      regionNames[key] = regionLabel(r.country, r.region);
    }
    return { countryAgg, regionAgg, regionNames };
  }, [data]);

  const totals = useMemo(() => {
    const t = { spend: 0, results: 0, impressions: 0 };
    for (const a of Object.values(agg.countryAgg)) {
      t.spend += a.spend;
      t.results += a.results;
      t.impressions += a.impressions;
    }
    return t;
  }, [agg]);

  const zoneRows = useMemo(() => {
    const rows: { key: string; label: string; sel: MapSelection; agg: ZoneAgg; indent: boolean }[] = [];
    const countries = Object.entries(agg.countryAgg).sort((a, b) => b[1].spend - a[1].spend);
    for (const [code, a] of countries) {
      rows.push({ key: code, label: countryLabel(code), sel: { country: code, regionKey: null }, agg: a, indent: false });
      const regs = Object.entries(agg.regionAgg)
        .filter(([k]) => k.startsWith(code + "|"))
        .sort((x, y) => y[1].spend - x[1].spend)
        .slice(0, 8);
      for (const [k, ra] of regs) {
        rows.push({ key: k, label: agg.regionNames[k] ?? k, sel: { country: code, regionKey: k }, agg: ra, indent: true });
      }
    }
    return rows;
  }, [agg]);

  const selectedLabel = useMemo(() => {
    if (!selected) return null;
    return selected.regionKey
      ? `${agg.regionNames[selected.regionKey] ?? selected.regionKey} · ${countryLabel(selected.country)}`
      : countryLabel(selected.country);
  }, [selected, agg]);

  const selectedAds = useMemo(() => {
    if (!selected || !data) return [];
    const byAd = new Map<string, { ad_id: string; ad_name: string; campaign_name: string; account_name: string; spend: number; results: number; impressions: number }>();
    for (const r of data.ads) {
      if (r.country !== selected.country) continue;
      if (selected.regionKey && regionKey(r.country, r.region) !== selected.regionKey) continue;
      const cur = byAd.get(r.ad_id) ?? { ad_id: r.ad_id, ad_name: r.ad_name, campaign_name: r.campaign_name, account_name: r.account_name, spend: 0, results: 0, impressions: 0 };
      cur.spend += r.spend;
      cur.results += r.results;
      cur.impressions += r.impressions;
      byAd.set(r.ad_id, cur);
    }
    return [...byAd.values()].sort((a, b) => b.spend - a.spend);
  }, [selected, data]);

  const selectedAgg = selected ? (selected.regionKey ? agg.regionAgg[selected.regionKey] : agg.countryAgg[selected.country]) : undefined;

  const demo = useMemo(() => {
    const byGender = new Map<string, ZoneAgg>();
    const byAge = new Map<string, ZoneAgg>();
    for (const r of data?.demo ?? []) {
      byGender.set(r.gender, add(byGender.get(r.gender), r.spend, r.results, r.impressions));
      byAge.set(r.age, add(byAge.get(r.age), r.spend, r.results, r.impressions));
    }
    const genders = [...byGender.entries()].sort((a, b) => b[1].impressions - a[1].impressions);
    const ages = [...byAge.entries()].sort((a, b) => a[0].localeCompare(b[0], "es", { numeric: true }));
    const totImp = genders.reduce((s, [, a]) => s + a.impressions, 0);
    const totRes = genders.reduce((s, [, a]) => s + a.results, 0);
    return { genders, ages, totImp, totRes };
  }, [data]);

  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase();
    return q ? campaigns.filter((c) => (c.campaign_name ?? "").toLowerCase().includes(q)) : campaigns;
  }, [campaigns, campaignSearch]);

  function toggleCampaign(id: string) {
    setPickedCampaigns((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setSelected(null);
  }

  const campaignLabel =
    pickedCampaigns.length === 0
      ? "Todas las campañas"
      : pickedCampaigns.length === 1
        ? (campaigns.find((c) => c.campaign_id === pickedCampaigns[0])?.campaign_name ?? "1 campaña")
        : `${pickedCampaigns.length} campañas`;

  const cardStyle = { background: "var(--surface)", border: "1px solid var(--border)" } as const;

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Mapa Geográfica
        </span>
        <span className="hidden text-sm sm:block" style={{ color: "var(--text-muted)" }}>
          Dónde se muestran y cuánto cuestan por zona
        </span>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
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
                  setSelected(null);
                }}
                className="rounded-full px-4 py-1.5 text-sm font-medium"
                style={{
                  background: active ? "var(--brand)" : "var(--surface)",
                  color: active ? "#ffffff" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                {p.label}
              </button>
            );
          })}
          <button
            onClick={() => setShowCustom((v) => !v)}
            className="rounded-full px-4 py-1.5 text-sm font-medium"
            style={{
              background: customRange ? "var(--brand)" : "var(--surface)",
              color: customRange ? "#ffffff" : "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            {customRange ? `${customRange.since} → ${customRange.until}` : "Fechas…"}
          </button>
          {showCustom && (
            <span className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customDraft.since}
                onChange={(e) => setCustomDraft((d) => ({ ...d, since: e.target.value }))}
                className="rounded-md px-2 py-1 text-sm"
                style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <input
                type="date"
                value={customDraft.until}
                onChange={(e) => setCustomDraft((d) => ({ ...d, until: e.target.value }))}
                className="rounded-md px-2 py-1 text-sm"
                style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <button
                disabled={!customDraft.since || !customDraft.until || customDraft.since > customDraft.until}
                onClick={() => {
                  setCustomRange({ ...customDraft });
                  setShowCustom(false);
                  setSelected(null);
                }}
                className="rounded-md px-3 py-1 text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--brand)", color: "#ffffff" }}
              >
                Aplicar
              </button>
            </span>
          )}

          <div className="relative ml-auto">
            <button
              onClick={() => setCampaignOpen((v) => !v)}
              className="max-w-[18rem] truncate rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            >
              {campaignLabel} ▾
            </button>
            {campaignOpen && (
              <div
                className="absolute right-0 z-30 mt-2 w-80 max-w-[90vw] rounded-lg p-3 shadow-xl"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
              >
                <input
                  type="text"
                  placeholder="Buscar campaña…"
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                  className="mb-2 w-full rounded-md px-3 py-1.5 text-sm outline-none"
                  style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
                <button
                  onClick={() => {
                    setPickedCampaigns([]);
                    setSelected(null);
                  }}
                  className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm font-medium"
                  style={{ background: pickedCampaigns.length === 0 ? "var(--brand)" : "transparent", color: pickedCampaigns.length === 0 ? "#ffffff" : "var(--text-secondary)" }}
                >
                  Todas las campañas
                </button>
                <div className="max-h-72 overflow-y-auto">
                  {filteredCampaigns.map((c) => {
                    const on = pickedCampaigns.includes(c.campaign_id);
                    return (
                      <label key={c.campaign_id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm" style={{ color: "var(--text-primary)" }}>
                        <input type="checkbox" checked={on} onChange={() => toggleCampaign(c.campaign_id)} className="mt-1" />
                        <span className="min-w-0">
                          <span className="block break-words">{c.campaign_name}</span>
                          <span className="text-xs" style={{ color: c.status === "ACTIVE" ? "var(--good)" : "var(--text-muted)" }}>
                            {c.status === "ACTIVE" ? "Activa" : "Pausada"} · {c.account_name}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCampaignOpen(false)}
                  className="mt-2 w-full rounded-md px-3 py-1.5 text-sm font-medium"
                  style={{ background: "var(--brand)", color: "#ffffff" }}
                >
                  Listo
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface)", color: "var(--critical)", border: "1px solid var(--border)" }}>
            {error}
          </p>
        )}
        {data && data.errors.length > 0 && (
          <p className="mb-4 rounded-lg p-3 text-xs" style={{ background: "var(--surface)", color: "var(--series-3)", border: "1px solid var(--border)" }}>
            Algunas cuentas no respondieron: {data.errors.join(" · ")}
          </p>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Gasto" value={loading && !data ? "…" : money(totals.spend)} />
          <Tile label="Resultados" value={loading && !data ? "…" : totals.results.toLocaleString("es-CO")} />
          <Tile
            label="Costo por resultado"
            value={loading && !data ? "…" : totals.results > 0 ? money(totals.spend / totals.results) : "-"}
            color={cprColor(totals.results > 0 ? totals.spend / totals.results : 0, totals.results)}
          />
          <Tile label="Países" value={loading && !data ? "…" : String(Object.keys(agg.countryAgg).length)} />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-xl p-4 lg:col-span-2" style={cardStyle}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1">
                {METRICS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMetric(m.value)}
                    className="rounded-md px-3 py-1 text-xs font-medium"
                    style={{
                      background: metric === m.value ? "var(--brand)" : "var(--surface-raised)",
                      color: metric === m.value ? "#ffffff" : "var(--text-secondary)",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <Legend metric={metric} />
            </div>
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <GeoMap
                countryAgg={agg.countryAgg}
                regionAgg={agg.regionAgg}
                regionNames={agg.regionNames}
                metric={metric}
                focusCountry={focusCountry}
                onFocus={setFocusCountry}
                selected={selected}
                onSelect={setSelected}
              />
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Toca Colombia o México para ver sus departamentos/estados. Meta no desglosa por ciudad: el detalle más fino es la región (p. ej. Antioquia incluye Medellín).
            </p>
          </section>

          <section className="rounded-xl p-4" style={cardStyle}>
            {selected && selectedLabel ? (
              <>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                    {selectedLabel}
                  </h2>
                  <button onClick={() => setSelected(null)} className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Cerrar ✕
                  </button>
                </div>
                {selectedAgg && (
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    <Mini label="Gasto" value={money(selectedAgg.spend)} />
                    <Mini label="Resultados" value={selectedAgg.results.toLocaleString("es-CO")} />
                    <Mini
                      label="Costo/res."
                      value={selectedAgg.results > 0 ? money(cprOf(selectedAgg)) : "-"}
                      color={cprColor(cprOf(selectedAgg), selectedAgg.results)}
                    />
                  </div>
                )}
                <p className="mb-1 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Anuncios que salen aquí
                </p>
                <div className="max-h-96 overflow-y-auto">
                  {selectedAds.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Sin anuncios en este período.
                    </p>
                  ) : (
                    selectedAds.map((a) => {
                      const cpr = a.results > 0 ? a.spend / a.results : 0;
                      return (
                        <div key={a.ad_id} className="border-b py-2" style={{ borderColor: "var(--gridline)" }}>
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {a.ad_name}
                          </p>
                          <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                            {a.campaign_name}
                          </p>
                          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                            <span>{money(a.spend)}</span>
                            <span>{a.results} res.</span>
                            <span style={{ color: cprColor(cpr, a.results) }}>{cpr > 0 ? `${money(cpr)}/res.` : "sin resultados"}</span>
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                <h2 className="mb-3 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Zonas con mayor gasto
                </h2>
                <div className="max-h-[28rem] overflow-y-auto">
                  {zoneRows.length === 0 && (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {loading ? "Cargando…" : "Sin datos en este período."}
                    </p>
                  )}
                  {zoneRows.map((z) => (
                    <button
                      key={z.key}
                      onClick={() => {
                        if (!z.indent && (z.sel.country === "CO" || z.sel.country === "MX")) setFocusCountry(z.sel.country);
                        setSelected(z.sel);
                      }}
                      className="flex w-full items-center justify-between gap-2 border-b py-1.5 text-left text-sm"
                      style={{ borderColor: "var(--gridline)", paddingLeft: z.indent ? 14 : 0 }}
                    >
                      <span className="min-w-0 truncate" style={{ color: z.indent ? "var(--text-secondary)" : "var(--text-primary)", fontWeight: z.indent ? 400 : 600 }}>
                        {z.label}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {money(z.agg.spend)} ·{" "}
                        <span style={{ color: cprColor(cprOf(z.agg), z.agg.results) }}>
                          {z.agg.results > 0 ? money(cprOf(z.agg)) : "-"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <section className="mt-5 rounded-xl p-4" style={cardStyle}>
          <h2 className="mb-1 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Quién ve los anuncios: género y edad
          </h2>
          <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
            Corresponde a {pickedCampaigns.length === 0 ? "todas las campañas" : campaignLabel.toLowerCase()} en el período elegido. Meta no permite cruzar género o edad con una zona, así que no cambia al tocar un país o región.
          </p>
          {demo.genders.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {loading ? "Cargando…" : "Sin datos en este período."}
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Por género
                </p>
                {demo.genders.map(([g, a]) => {
                  const share = demo.totImp > 0 ? (a.impressions / demo.totImp) * 100 : 0;
                  const cpr = a.results > 0 ? a.spend / a.results : 0;
                  return (
                    <div key={g} className="mb-3">
                      <div className="flex justify-between text-sm" style={{ color: "var(--text-primary)" }}>
                        <span>{GENDER_LABEL[g] ?? g}</span>
                        <span className="tabular-nums">{share.toFixed(0)}% de impresiones</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full" style={{ background: "var(--surface-raised)" }}>
                        <div className="h-2 rounded-full" style={{ width: `${share}%`, background: g === "female" ? "var(--series-7)" : g === "male" ? "var(--brand)" : "var(--text-muted)" }} />
                      </div>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {a.results} resultados ({demo.totRes > 0 ? ((a.results / demo.totRes) * 100).toFixed(0) : 0}%) · {money(a.spend)} ·{" "}
                        <span style={{ color: cprColor(cpr, a.results) }}>{cpr > 0 ? `${money(cpr)}/res.` : "-"}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Por edad
                </p>
                {demo.ages.map(([age, a]) => {
                  const maxRes = Math.max(1, ...demo.ages.map(([, x]) => x.results));
                  const cpr = a.results > 0 ? a.spend / a.results : 0;
                  return (
                    <div key={age} className="mb-2 flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <span className="w-12 shrink-0" style={{ color: "var(--text-primary)" }}>
                        {age}
                      </span>
                      <div className="h-2 flex-1 rounded-full" style={{ background: "var(--surface-raised)" }}>
                        <div className="h-2 rounded-full" style={{ width: `${(a.results / maxRes) * 100}%`, background: "var(--series-4)" }} />
                      </div>
                      <span className="w-14 shrink-0 text-right tabular-nums">{a.results} res.</span>
                      <span className="w-20 shrink-0 text-right tabular-nums" style={{ color: cprColor(cpr, a.results) }}>
                        {cpr > 0 ? money(cpr) : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
          Costo por resultado = gasto ÷ conversaciones iniciadas. Verde ≤ {money(CPR_IDEAL)} · naranja ≤ {money(CPR_MAX)} · rojo por encima. Zonas con menos de {LOW_SAMPLE} resultados se muestran en gris porque el costo no es confiable. Los datos de Meta pueden tardar unas horas en actualizarse.
        </p>
      </main>
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: "var(--surface-raised)" }}>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function Legend({ metric }: { metric: Metric }) {
  if (metric === "cpr") {
    const items = [
      { c: "var(--good)", t: `≤ ${money(CPR_IDEAL)}` },
      { c: "var(--series-3)", t: `≤ ${money(CPR_MAX)}` },
      { c: "var(--critical)", t: `> ${money(CPR_MAX)}` },
      { c: "rgba(137,135,129,0.55)", t: `< ${LOW_SAMPLE} res.` },
    ];
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
        {items.map((i) => (
          <span key={i.t} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: i.c }} />
            {i.t}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
      <span>Menos</span>
      <span className="inline-block h-3 w-24 rounded-sm" style={{ background: "linear-gradient(90deg, rgba(57,135,229,0.25), rgba(57,135,229,1))" }} />
      <span>Más</span>
    </div>
  );
}
