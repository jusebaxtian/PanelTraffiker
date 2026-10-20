"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CPR_IDEAL,
  CPR_MAX,
  CTA_LABEL,
  FATIGUE_LABEL,
  HEALTH_LABEL,
  TREND_LABEL,
  VERDICT_META,
  winnerPatterns,
  type AdDay,
  type AdLifetime,
  type AdPeriodStats,
  type Diagnosis,
  type Verdict,
} from "@/lib/adDiagnosis";

interface AdReport {
  ad_id: string;
  ad_name: string;
  account_id: string;
  account_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_name: string | null;
  status: string;
  created_time: string | null;
  thumbnail: string | null;
  image_url: string | null;
  format: string;
  cta: string | null;
  body: string | null;
  title: string | null;
  preview_link: string | null;
  cur: AdPeriodStats;
  prev: AdPeriodStats | null;
  lifetime: AdLifetime | null;
  daily: AdDay[];
  diagnosis: Diagnosis;
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

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const dec = (n: number, d = 2) => n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}%`;

function cprColor(cpr: number, results: number): string {
  if (results === 0 || cpr === 0) return "var(--text-muted)";
  if (cpr <= CPR_IDEAL) return "var(--good)";
  if (cpr <= CPR_MAX) return "var(--series-3)";
  return "var(--critical)";
}

const FORMAT_LABEL: Record<string, string> = { VIDEO: "Video", IMAGEN: "Imagen", OTRO: "Otro" };

export default function MisAnunciosPage() {
  const [datePreset, setDatePreset] = useState<string>("last_7d");
  const [customRange, setCustomRange] = useState<{ since: string; until: string } | null>(null);
  const [customDraft, setCustomDraft] = useState({ since: "", until: "" });
  const [showCustom, setShowCustom] = useState(false);

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignSearch, setCampaignSearch] = useState("");

  const [ads, setAds] = useState<AdReport[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [range, setRange] = useState<{ since: string; until: string } | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const [onlyActive, setOnlyActive] = useState(true);
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "todos">("todos");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"gasto" | "cpr" | "puntaje" | "frecuencia">("gasto");
  const [preview, setPreview] = useState<AdReport | null>(null);

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

  const campaignKey = picked.join(",");
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
    fetch(`/api/mis-anuncios?${qs.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (id !== requestId.current) return;
        if (json.error) setError(json.error);
        else {
          setAds(json.data.ads);
          setErrors(json.data.errors);
          setRange(json.data.range);
          setError(null);
        }
      })
      .catch((e) => id === requestId.current && setError(e.message))
      .finally(() => id === requestId.current && setLoadedKey(queryKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, campaignKey]);

  const scoped = useMemo(() => (onlyActive ? ads.filter((a) => a.status === "ACTIVE") : ads), [ads, onlyActive]);

  const counts = useMemo(() => {
    const c: Record<Verdict, number> = { escalar: 0, mantener: 0, vigilar: 0, renovar: 0, apagar: 0, prueba: 0 };
    for (const a of scoped) c[a.diagnosis.verdict]++;
    return c;
  }, [scoped]);

  const totals = useMemo(() => {
    const spend = scoped.reduce((s, a) => s + a.cur.spend, 0);
    const results = scoped.reduce((s, a) => s + a.cur.results, 0);
    return { spend, results, cpr: results > 0 ? spend / results : 0 };
  }, [scoped]);

  const best = useMemo(
    () =>
      scoped
        .filter((a) => a.cur.results >= 5 && (a.cur.spend >= 80000 || a.cur.results >= 10))
        .sort((a, b) => b.diagnosis.score - a.diagnosis.score || a.diagnosis.cpr - b.diagnosis.cpr)
        .slice(0, 5),
    [scoped]
  );

  const worst = useMemo(
    () =>
      scoped
        .filter((a) => a.cur.spend >= 100000 && (a.cur.results === 0 || a.diagnosis.cpr > CPR_MAX))
        .sort((a, b) => {
          const ka = a.cur.results === 0 ? a.cur.spend * 1000 : a.diagnosis.cpr;
          const kb = b.cur.results === 0 ? b.cur.spend * 1000 : b.diagnosis.cpr;
          return kb - ka;
        })
        .slice(0, 5),
    [scoped]
  );

  const byVerdict = (v: Verdict) => scoped.filter((a) => a.diagnosis.verdict === v).sort((a, b) => b.cur.spend - a.cur.spend);

  const wasted = useMemo(() => byVerdict("apagar").reduce((s, a) => s + a.cur.spend, 0), [scoped]); // eslint-disable-line react-hooks/exhaustive-deps

  const patterns = useMemo(() => {
    const toPattern = (a: AdReport) => ({
      verdict: a.diagnosis.verdict,
      cpr: a.diagnosis.cpr,
      results: a.cur.results,
      spend: a.cur.spend,
      ctr: a.cur.ctr,
      cpm: a.cur.cpm,
      format: a.format,
      cta: a.cta,
      body: a.body,
      title: a.title,
    });
    return winnerPatterns(best.map(toPattern), worst.map(toPattern));
  }, [best, worst]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = scoped.filter(
      (a) =>
        (verdictFilter === "todos" || a.diagnosis.verdict === verdictFilter) &&
        (!q || a.ad_name.toLowerCase().includes(q) || a.campaign_name.toLowerCase().includes(q))
    );
    const key = {
      gasto: (a: AdReport) => -a.cur.spend,
      cpr: (a: AdReport) => (a.cur.results === 0 ? Infinity : a.diagnosis.cpr),
      puntaje: (a: AdReport) => -a.diagnosis.score,
      frecuencia: (a: AdReport) => -a.cur.frequency,
    }[sort];
    return [...filtered].sort((a, b) => key(a) - key(b));
  }, [scoped, verdictFilter, search, sort]);

  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase();
    return q ? campaigns.filter((c) => (c.campaign_name ?? "").toLowerCase().includes(q)) : campaigns;
  }, [campaigns, campaignSearch]);

  const campaignLabel =
    picked.length === 0
      ? "Todas las campañas"
      : picked.length === 1
        ? (campaigns.find((c) => c.campaign_id === picked[0])?.campaign_name ?? "1 campaña")
        : `${picked.length} campañas`;

  const cardStyle = { background: "var(--surface)", border: "1px solid var(--border)" } as const;
  const showSkeleton = loading && ads.length === 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Mis Anuncios
        </span>
        <span className="hidden text-sm sm:block" style={{ color: "var(--text-muted)" }}>
          Qué anuncios funcionan, cuáles se cansaron y qué hacer con cada uno
        </span>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        {/* ---------- Filtros ---------- */}
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
                }}
                className="rounded-md px-3 py-1 text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--brand)", color: "#ffffff" }}
              >
                Aplicar
              </button>
            </span>
          )}

          <label className="ml-2 flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
            Solo anuncios activos
          </label>

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
                  onClick={() => setPicked([])}
                  className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm font-medium"
                  style={{ background: picked.length === 0 ? "var(--brand)" : "transparent", color: picked.length === 0 ? "#ffffff" : "var(--text-secondary)" }}
                >
                  Todas las campañas
                </button>
                <div className="max-h-72 overflow-y-auto">
                  {filteredCampaigns.map((c) => (
                    <label key={c.campaign_id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm" style={{ color: "var(--text-primary)" }}>
                      <input
                        type="checkbox"
                        checked={picked.includes(c.campaign_id)}
                        onChange={() => setPicked((p) => (p.includes(c.campaign_id) ? p.filter((x) => x !== c.campaign_id) : [...p, c.campaign_id]))}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="block break-words">{c.campaign_name}</span>
                        <span className="text-xs" style={{ color: c.status === "ACTIVE" ? "var(--good)" : "var(--text-muted)" }}>
                          {c.status === "ACTIVE" ? "Activa" : "Pausada"} · {c.account_name}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <button onClick={() => setCampaignOpen(false)} className="mt-2 w-full rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: "var(--brand)", color: "#ffffff" }}>
                  Listo
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg p-3 text-sm" style={{ ...cardStyle, color: "var(--critical)" }}>
            {error}
          </p>
        )}
        {errors.length > 0 && (
          <p className="mb-4 rounded-lg p-3 text-xs" style={{ ...cardStyle, color: "var(--series-3)" }}>
            Algunas cuentas no respondieron: {errors.join(" · ")}
          </p>
        )}

        {showSkeleton ? (
          <p className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Analizando tus anuncios…
          </p>
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            {/* ---------- Resumen ---------- */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Anuncios analizados" value={String(scoped.length)} />
              <Tile label="Gasto" value={money(totals.spend)} />
              <Tile label="Costo por resultado" value={totals.cpr > 0 ? money(totals.cpr) : "-"} color={cprColor(totals.cpr, totals.results)} />
              <Tile label="Gasto en anuncios a apagar" value={money(wasted)} color={wasted > 0 ? "var(--critical)" : undefined} />
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              {(["escalar", "mantener", "vigilar", "renovar", "apagar", "prueba"] as Verdict[]).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setVerdictFilter(verdictFilter === v ? "todos" : v);
                    document.getElementById("todos-los-anuncios")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: verdictFilter === v ? VERDICT_META[v].color : "var(--surface)",
                    color: verdictFilter === v ? "#ffffff" : VERDICT_META[v].color,
                    border: `1px solid ${VERDICT_META[v].color}`,
                  }}
                >
                  {VERDICT_META[v].short} · {counts[v]}
                </button>
              ))}
            </div>

            {scoped.length === 0 && (
              <p className="rounded-xl p-6 text-center text-sm" style={{ ...cardStyle, color: "var(--text-muted)" }}>
                No hay anuncios con actividad en este período{onlyActive ? " (prueba desmarcar “Solo anuncios activos”)" : ""}.
              </p>
            )}

            {/* ---------- Qué hacer hoy ---------- */}
            {(byVerdict("apagar").length > 0 || byVerdict("renovar").length > 0 || byVerdict("escalar").length > 0) && (
              <Section title="Qué hacer hoy" subtitle="Las acciones más importantes, en orden de prioridad.">
                <ActionGroup title="Apagar" hint={`Gastan sin rendir. Liberas ${money(wasted)} para los mejores.`} ads={byVerdict("apagar")} onPreview={setPreview} totalSpend={totals.spend} />
                <ActionGroup title="Cambiar el creativo (fatigados)" hint="Funcionaron, pero la gente ya se cansó de verlos." ads={byVerdict("renovar")} onPreview={setPreview} totalSpend={totals.spend} />
                <ActionGroup title="Escalar (muy buenos)" hint="Dales más presupuesto de a poco y crea variantes." ads={byVerdict("escalar")} onPreview={setPreview} totalSpend={totals.spend} />
              </Section>
            )}

            {/* ---------- Tops ---------- */}
            {(best.length > 0 || worst.length > 0) && (
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <Section title="Top 5 mejores anuncios" subtitle="Menor costo por resultado con datos suficientes." compact>
                  {best.map((a, i) => (
                    <RankRow key={a.ad_id} rank={i + 1} ad={a} onPreview={setPreview} />
                  ))}
                </Section>
                <Section title="Top 5 peores anuncios" subtitle="Los que más cuestan o gastan sin resultados." compact>
                  {worst.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Ningún anuncio supera tu máximo de {money(CPR_MAX)} con gasto relevante. 👏
                    </p>
                  ) : (
                    worst.map((a, i) => <RankRow key={a.ad_id} rank={i + 1} ad={a} onPreview={setPreview} bad />)
                  )}
                </Section>
              </div>
            )}

            {/* ---------- Qué replicar ---------- */}
            {best.length > 0 && (
              <Section title="Qué replicar: lo que tienen en común tus mejores anuncios" subtitle="Úsalo de referencia para crear contenido nuevo parecido a lo que ya funciona.">
                {patterns.length > 0 ? (
                  <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm" style={{ color: "var(--text-primary)" }}>
                    {patterns.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
                    Todavía no hay un patrón claro entre tus mejores y peores anuncios; mira cada ganador abajo.
                  </p>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {best.slice(0, 4).map((a) => (
                    <div key={a.ad_id} className="rounded-lg p-3" style={{ background: "var(--surface-raised)" }}>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {a.ad_name}
                      </p>
                      <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        {FORMAT_LABEL[a.format]} · {a.cta ? (CTA_LABEL[a.cta] ?? a.cta) : "sin botón"} · {money(a.diagnosis.cpr)} por resultado · CTR {dec(a.cur.ctr)}%
                      </p>
                      {a.title && (
                        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                          <span style={{ color: "var(--text-muted)" }}>Titular: </span>
                          {a.title}
                        </p>
                      )}
                      {a.body && (
                        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--text-muted)" }}>Texto: </span>
                          {a.body.length > 220 ? a.body.slice(0, 220) + "…" : a.body}
                        </p>
                      )}
                      <p className="mt-2 text-xs" style={{ color: "var(--series-2)" }}>
                        Para crear uno parecido: conserva el formato ({FORMAT_LABEL[a.format].toLowerCase()}), el ángulo del titular y el botón; cambia la imagen o los primeros segundos y la primera frase del texto.
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ---------- Todos ---------- */}
            <div id="todos-los-anuncios" className="mt-6 scroll-mt-20">
              <Section title="Todos los anuncios" subtitle="Toca un anuncio para ver su detalle, su evolución y la recomendación completa.">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Buscar anuncio o campaña…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-xs rounded-lg px-3 py-1.5 text-sm outline-none"
                    style={{ background: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                    className="rounded-lg px-3 py-1.5 text-sm"
                    style={{ background: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  >
                    <option value="gasto">Ordenar: mayor gasto</option>
                    <option value="cpr">Ordenar: menor costo por resultado</option>
                    <option value="puntaje">Ordenar: mejor puntaje</option>
                    <option value="frecuencia">Ordenar: mayor frecuencia</option>
                  </select>
                  {verdictFilter !== "todos" && (
                    <button onClick={() => setVerdictFilter("todos")} className="text-xs" style={{ color: "var(--brand)" }}>
                      Quitar filtro “{VERDICT_META[verdictFilter].short}” ✕
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {list.map((a) => (
                    <AdCard key={a.ad_id} ad={a} onPreview={setPreview} expandable spendShare={totals.spend > 0 ? a.cur.spend / totals.spend : undefined} />
                  ))}
                  {list.length === 0 && (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Sin resultados con ese filtro.
                    </p>
                  )}
                </div>
              </Section>
            </div>

            <div className="mt-6 rounded-xl p-4 text-xs leading-relaxed" style={{ ...cardStyle, color: "var(--text-muted)" }}>
              <p className="mb-1 font-semibold" style={{ color: "var(--text-secondary)" }}>
                Cómo leer este análisis
              </p>
              <p>
                <b>Costo por resultado</b>: gasto ÷ conversaciones iniciadas. Tu ideal es {money(CPR_IDEAL)} y tu máximo {money(CPR_MAX)}. <b>Frecuencia</b>: cuántas veces, en promedio, vio el anuncio cada persona alcanzada; por encima de 2 empieza el cansancio. <b>CTR</b>: de cada 100 veces que se muestra, cuántas personas hacen clic. <b>CPM</b>: lo que cuesta mostrar el anuncio 1.000 veces. <b>Fatiga</b>: cuando el anuncio ya se vio demasiado y rinde peor: baja el CTR, sube el CPM o sube el costo por resultado. <b>Quemado</b>: fatiga extrema, ya no tiene recorrido. Con menos de {money(150000)} de gasto o menos de 5 resultados el anuncio se marca “en prueba” porque aún no se puede juzgar. Período analizado: {range ? `${range.since} al ${range.until}` : "-"}; la tendencia compara la primera con la segunda mitad del período y, si hay datos, con el período anterior equivalente.
              </p>
            </div>
          </div>
        )}
      </main>

      {preview && <PreviewModal ad={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* ================= componentes ================= */

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

function Section({ title, subtitle, children, compact }: { title: string; subtitle?: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <section className={`rounded-xl p-4 ${compact ? "" : "mt-6 first:mt-0"}`} style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      {subtitle && (
        <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      )}
      {children}
    </section>
  );
}

function ActionGroup({ title, hint, ads, onPreview, totalSpend }: { title: string; hint: string; ads: AdReport[]; onPreview: (a: AdReport) => void; totalSpend: number }) {
  if (ads.length === 0) return null;
  return (
    <div className="mb-5 last:mb-0">
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {title} <span style={{ color: "var(--text-muted)" }}>({ads.length})</span>
      </p>
      <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
        {hint}
      </p>
      <div className="space-y-3">
        {ads.slice(0, 6).map((a) => (
          <AdCard key={a.ad_id} ad={a} onPreview={onPreview} spendShare={totalSpend > 0 ? a.cur.spend / totalSpend : undefined} />
        ))}
        {ads.length > 6 && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            y {ads.length - 6} más en “Todos los anuncios”.
          </p>
        )}
      </div>
    </div>
  );
}

function RankRow({ rank, ad, onPreview, bad }: { rank: number; ad: AdReport; onPreview: (a: AdReport) => void; bad?: boolean }) {
  const cpr = ad.diagnosis.cpr;
  return (
    <div className="flex items-center gap-3 border-b py-2 last:border-b-0" style={{ borderColor: "var(--gridline)" }}>
      <span className="w-5 shrink-0 text-center text-sm font-bold" style={{ color: bad ? "var(--critical)" : "var(--good)" }}>
        {rank}
      </span>
      <Thumb ad={ad} size={44} onClick={() => onPreview(ad)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {ad.ad_name}
        </p>
        <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
          {ad.campaign_name}
        </p>
      </div>
      <div className="shrink-0 text-right text-xs tabular-nums">
        <p style={{ color: cprColor(cpr, ad.cur.results), fontWeight: 600 }}>{ad.cur.results > 0 ? money(cpr) : "Sin resultados"}</p>
        <p style={{ color: "var(--text-muted)" }}>
          {money(ad.cur.spend)} · frec. {dec(ad.cur.frequency)}
        </p>
      </div>
    </div>
  );
}

function Thumb({ ad, size, onClick }: { ad: AdReport; size: number; onClick?: () => void }) {
  const src = ad.thumbnail ?? ad.image_url;
  return (
    <button
      onClick={onClick}
      title="Ver el anuncio"
      className="relative shrink-0 overflow-hidden rounded-md"
      style={{ width: size, height: size, background: "var(--surface-raised)", border: "1px solid var(--border)" }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          sin imagen
        </span>
      )}
      {ad.format === "VIDEO" && (
        <span className="absolute bottom-0.5 right-0.5 rounded px-1 text-[9px] font-bold" style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>
          ▶
        </span>
      )}
    </button>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color, border: `1px solid ${color}` }}>
      {text}
    </span>
  );
}

function AdCard({ ad, onPreview, expandable, spendShare }: { ad: AdReport; onPreview: (a: AdReport) => void; expandable?: boolean; spendShare?: number }) {
  const [open, setOpen] = useState(!expandable);
  const d = ad.diagnosis;
  const v = VERDICT_META[d.verdict];
  const fatigueColor = d.fatigue === "ninguna" ? "var(--good)" : d.fatigue === "inicial" ? "var(--series-3)" : "var(--critical)";
  const trendColor = d.trend === "mejorando" ? "var(--good)" : d.trend === "empeorando" ? "var(--critical)" : "var(--text-muted)";

  return (
    <div className="rounded-lg p-3" style={{ background: "var(--surface-raised)", borderLeft: `3px solid ${v.color}` }}>
      <div className="flex gap-3">
        <Thumb ad={ad} size={64} onClick={() => onPreview(ad)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {ad.ad_name}
            </p>
            <Badge text={v.label} color={v.color} />
            {ad.status !== "ACTIVE" && <Badge text="Pausado" color="var(--text-muted)" />}
          </div>
          <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {ad.campaign_name} · {ad.account_name} · {FORMAT_LABEL[ad.format]}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
            <span>
              Gasto <b style={{ color: "var(--text-primary)" }}>{money(ad.cur.spend)}</b>
            </span>
            <span>
              Resultados <b style={{ color: "var(--text-primary)" }}>{ad.cur.results}</b>
            </span>
            <span>
              Costo/res.{" "}
              <b style={{ color: cprColor(d.cpr, ad.cur.results) }}>{ad.cur.results > 0 ? money(d.cpr) : "-"}</b>
            </span>
            <span>
              Frecuencia <b style={{ color: d.fatigue === "ninguna" ? "var(--text-primary)" : fatigueColor }}>{dec(ad.cur.frequency)}</b>
            </span>
            <span>
              CTR <b style={{ color: "var(--text-primary)" }}>{dec(ad.cur.ctr)}%</b>
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge text={`Fatiga: ${FATIGUE_LABEL[d.fatigue]}`} color={fatigueColor} />
            <Badge text={`Tendencia: ${TREND_LABEL[d.trend]}`} color={trendColor} />
            <Badge text={`Rendimiento: ${HEALTH_LABEL[d.health]}`} color={cprColor(d.cpr, ad.cur.results)} />
          </div>
        </div>
        {expandable && (
          <button onClick={() => setOpen((o) => !o)} className="h-fit shrink-0 text-xs" style={{ color: "var(--brand)" }}>
            {open ? "Cerrar ▲" : "Detalle ▼"}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--gridline)" }}>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Por qué
          </p>
          <ul className="mb-3 list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--text-primary)" }}>
            {d.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
            {spendShare !== undefined && spendShare >= 0.15 && ad.cur.results > 0 && d.cpr > CPR_MAX && (
              <li>
                Concentra el {Math.round(spendShare * 100)}% de todo tu gasto con un costo sobre tu máximo: es la prioridad para reemplazar o mejorar.
              </li>
            )}
          </ul>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Qué hacer
          </p>
          <p className="mb-3 text-sm" style={{ color: "var(--text-primary)" }}>
            {d.recommendation}
          </p>

          {expandable && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Mini label="Impresiones" value={ad.cur.impressions.toLocaleString("es-CO")} />
                <Mini label="Personas alcanzadas" value={ad.cur.reach.toLocaleString("es-CO")} />
                <Mini label="CPM" value={money(ad.cur.cpm)} delta={d.cpmDeltaPct} invert />
                <Mini label="CTR enlace" value={`${dec(ad.cur.ctr)}%`} delta={d.ctrDeltaPct} />
                <Mini label="Frecuencia (vida)" value={ad.lifetime ? dec(ad.lifetime.frequency) : "-"} />
                <Mini label="Gasto total (vida)" value={ad.lifetime ? money(ad.lifetime.spend) : "-"} />
                <Mini label="Costo/res. período previo" value={ad.prev && ad.prev.results > 0 ? money(ad.prev.spend / ad.prev.results) : "-"} />
                <Mini label="Creado" value={ad.created_time ? ad.created_time.slice(0, 10) : "-"} />
              </div>
              <DailyChart daily={ad.daily} />
              {(ad.title || ad.body) && (
                <div className="mt-3 rounded-md p-2 text-xs" style={{ background: "var(--surface)", color: "var(--text-secondary)" }}>
                  {ad.title && (
                    <p>
                      <b style={{ color: "var(--text-primary)" }}>Titular:</b> {ad.title}
                    </p>
                  )}
                  {ad.body && (
                    <p className="mt-1">
                      <b style={{ color: "var(--text-primary)" }}>Texto:</b> {ad.body}
                    </p>
                  )}
                  {ad.cta && (
                    <p className="mt-1">
                      <b style={{ color: "var(--text-primary)" }}>Botón:</b> {CTA_LABEL[ad.cta] ?? ad.cta}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => onPreview(ad)} className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--brand)", color: "#ffffff" }}>
              Ver el anuncio
            </button>
            {ad.preview_link && (
              <a
                href={ad.preview_link}
                target="_blank"
                rel="noreferrer"
                className="rounded-md px-3 py-1.5 text-xs font-semibold"
                style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                Abrir enlace ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, delta, invert }: { label: string; value: string; delta?: number | null; invert?: boolean }) {
  const good = delta === null || delta === undefined ? null : invert ? delta < 0 : delta > 0;
  return (
    <div className="rounded-md p-2" style={{ background: "var(--surface)" }}>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
        {value}
        {delta !== null && delta !== undefined && Math.abs(delta) >= 5 && (
          <span className="ml-1 text-[11px] font-medium" style={{ color: good ? "var(--good)" : "var(--critical)" }}>
            {signed(delta)}
          </span>
        )}
      </p>
    </div>
  );
}

function DailyChart({ daily }: { daily: AdDay[] }) {
  const days = daily.filter((d) => d.spend > 0);
  if (days.length < 2) {
    return (
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Muy pocos días con datos para mostrar la evolución.
      </p>
    );
  }
  const W = 560;
  const H = 110;
  const pad = 22;
  const maxSpend = Math.max(...days.map((d) => d.spend));
  const cprs = days.map((d) => (d.results > 0 ? d.spend / d.results : null));
  const maxCpr = Math.max(CPR_MAX * 1.3, ...cprs.filter((c): c is number => c !== null));
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, days.length - 1);
  const bw = Math.max(4, (W - pad * 2) / days.length - 6);
  const pts = cprs.map((c, i) => (c === null ? null : `${x(i)},${H - 18 - (c / maxCpr) * (H - 34)}`));
  const line = pts.filter(Boolean).join(" ");
  const maxLineY = H - 18 - (CPR_MAX / maxCpr) * (H - 34);
  return (
    <div>
      <p className="mb-1 text-xs" style={{ color: "var(--text-muted)" }}>
        Día a día: barras = gasto, línea = costo por resultado (la línea punteada es tu máximo de {money(CPR_MAX)}).
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolución diaria del anuncio">
        {days.map((d, i) => (
          <g key={d.date}>
            <rect x={x(i) - bw / 2} y={H - 18 - (d.spend / maxSpend) * (H - 34)} width={bw} height={(d.spend / maxSpend) * (H - 34)} fill="var(--series-4)" opacity={0.35} />
            <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
              {d.date.slice(5)}
            </text>
          </g>
        ))}
        <line x1={pad} x2={W - pad} y1={maxLineY} y2={maxLineY} stroke="var(--critical)" strokeDasharray="4 4" opacity={0.6} />
        {line && <polyline points={line} fill="none" stroke="var(--brand)" strokeWidth={2} />}
        {pts.map((p, i) => {
          if (!p) return null;
          const [px, py] = p.split(",").map(Number);
          return <circle key={i} cx={px} cy={py} r={2.5} fill="var(--brand)" />;
        })}
      </svg>
    </div>
  );
}

function PreviewModal({ ad, onClose }: { ad: AdReport; onClose: () => void }) {
  const [format, setFormat] = useState("MOBILE_FEED_STANDARD");
  const [state, setState] = useState<{ key: string; src?: string; width?: number; height?: number; error?: string } | null>(null);
  const key = `${ad.ad_id}|${format}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/mis-anuncios/preview?ad_id=${ad.ad_id}&account_id=${ad.account_id}&format=${format}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) setState({ key, error: json.error });
        else setState({ key, ...json.data });
      })
      .catch((e) => !cancelled && setState({ key, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [ad.ad_id, ad.account_id, format, key]);

  const ready = state?.key === key ? state : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {ad.ad_name}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
              {ad.campaign_name}
            </p>
          </div>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>
        <div className="mb-3 flex gap-1">
          {[
            ["MOBILE_FEED_STANDARD", "Facebook"],
            ["INSTAGRAM_STANDARD", "Instagram"],
            ["INSTAGRAM_STORY", "Historia"],
          ].map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className="rounded-md px-3 py-1 text-xs font-medium"
              style={{ background: format === f ? "var(--brand)" : "var(--surface-raised)", color: format === f ? "#ffffff" : "var(--text-secondary)" }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex min-h-64 items-center justify-center">
          {!ready && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Cargando vista previa…
            </p>
          )}
          {ready?.error && (
            <p className="text-center text-sm" style={{ color: "var(--critical)" }}>
              {ready.error}
            </p>
          )}
          {ready?.src && (
            <iframe src={ready.src} width={ready.width} height={ready.height} style={{ border: 0, background: "#fff", borderRadius: 8, maxWidth: "100%" }} title="Vista previa del anuncio" />
          )}
        </div>
        {ad.preview_link && (
          <a href={ad.preview_link} target="_blank" rel="noreferrer" className="mt-3 block text-center text-xs" style={{ color: "var(--brand)" }}>
            Abrir enlace público del anuncio ↗
          </a>
        )}
      </div>
    </div>
  );
}
