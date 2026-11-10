"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { CPR_IDEAL, CPR_MAX } from "@/lib/adDiagnosis";
import { adRates, adTips, adsetTips, freqBand, segmentTip, summaryTips, type AdMetricKey, type Tip } from "@/lib/analizarTips";
import { AD_BANDS, bandOf, DIMENSION_LABEL, type AdRow, type Band, type CampaignAnalysis, type Finding, type Segment } from "@/lib/analizarCampanaTypes";

interface CampaignOption {
  account_id: string;
  account_name?: string;
  campaign_id: string;
  campaign_name: string;
  status?: string;
}

const DATE_PRESETS = [
  { label: "Desde que inició", value: "lifetime" },
  { label: "Hoy", value: "today" },
  { label: "Ayer", value: "yesterday" },
  { label: "7 días", value: "last_7d" },
  { label: "Este mes", value: "this_month" },
] as const;

const TABS: { key: string; label: string }[] = [
  { key: "anuncios", label: "Anuncios" },
  { key: "copys", label: "Copys" },
  { key: "ubicaciones", label: "Ubicaciones" },
  { key: "publico", label: "Público" },
  { key: "departamentos", label: "Departamentos" },
  { key: "edad", label: "Edad y género" },
  { key: "horas", label: "Horas" },
  { key: "dispositivos", label: "Dispositivos" },
  { key: "dias", label: "Día a día" },
];

const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_LEADS: "Clientes potenciales",
  OUTCOME_ENGAGEMENT: "Interacción",
  OUTCOME_SALES: "Ventas",
  OUTCOME_TRAFFIC: "Tráfico",
  OUTCOME_AWARENESS: "Reconocimiento",
  MESSAGES: "Mensajes",
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const dec = (n: number, d = 2) => n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
const cpr = (s: { spend: number; results: number }) => (s.results > 0 ? s.spend / s.results : 0);

function cprColor(value: number, results: number): string {
  if (results === 0 || value === 0) return "var(--text-muted)";
  if (value <= CPR_IDEAL) return "var(--good)";
  if (value <= CPR_MAX) return "var(--series-3)";
  return "var(--critical)";
}

const cardStyle = { background: "var(--surface)", border: "1px solid var(--border)" } as const;

export default function AnalizarCampanaPage() {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [picked, setPicked] = useState<CampaignOption | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const [datePreset, setDatePreset] = useState<string>("lifetime");
  const [customRange, setCustomRange] = useState<{ since: string; until: string } | null>(null);
  const [customDraft, setCustomDraft] = useState({ since: "", until: "" });
  const [showCustom, setShowCustom] = useState(false);

  const [data, setData] = useState<CampaignAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [tab, setTab] = useState("anuncios");
  const requestId = useRef(0);

  useEffect(() => {
    fetch("/api/proyeccion/campaigns")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) return;
        const list: CampaignOption[] = json.data ?? [];
        list.sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") || (a.campaign_name ?? "").localeCompare(b.campaign_name ?? ""));
        setCampaigns(list);
      })
      .catch(() => {});
  }, []);

  const rangeKey = customRange ? `${customRange.since}_${customRange.until}` : datePreset;
  const queryKey = picked ? `${picked.campaign_id}|${rangeKey}` : "";
  const loading = !!picked && loadedKey !== queryKey;

  useEffect(() => {
    if (!picked) return;
    const id = ++requestId.current;
    const qs = new URLSearchParams({ account_id: picked.account_id, campaign_id: picked.campaign_id });
    if (customRange) {
      qs.set("since", customRange.since);
      qs.set("until", customRange.until);
    } else qs.set("date_preset", datePreset);
    fetch(`/api/analizar-campana?${qs.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (id !== requestId.current) return;
        if (json.error) setError(json.error);
        else {
          setData(json.data);
          setError(null);
        }
      })
      .catch((e) => id === requestId.current && setError(e.message))
      .finally(() => id === requestId.current && setLoadedKey(queryKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, rangeKey]);

  const filtered = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return q ? campaigns.filter((c) => (c.campaign_name ?? "").toLowerCase().includes(q) || (c.account_name ?? "").toLowerCase().includes(q)) : campaigns;
  }, [campaigns, pickerSearch]);

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8" style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}>
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Analizar Campaña
        </span>
        <span className="hidden text-sm sm:block" style={{ color: "var(--text-muted)" }}>
          Qué funcionó y qué no, para replicarlo
        </span>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        {/* ---------- Selección ---------- */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="max-w-[22rem] truncate rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--brand)", color: "#ffffff" }}
            >
              {picked ? picked.campaign_name : "Elige una campaña"} ▾
            </button>
            {pickerOpen && (
              <div className="absolute left-0 z-30 mt-2 w-96 max-w-[90vw] rounded-lg p-3 shadow-xl" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar campaña o cuenta…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="mb-2 w-full rounded-md px-3 py-1.5 text-sm outline-none"
                  style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
                <div className="max-h-80 overflow-y-auto">
                  {filtered.length === 0 && (
                    <p className="px-2 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
                      {campaigns.length === 0 ? "Cargando campañas…" : "Sin coincidencias."}
                    </p>
                  )}
                  {filtered.map((c) => (
                    <button
                      key={c.campaign_id}
                      onClick={() => {
                        setPicked(c);
                        setPickerOpen(false);
                        setData(null);
                      }}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-sm"
                      style={{ background: picked?.campaign_id === c.campaign_id ? "var(--surface)" : "transparent", color: "var(--text-primary)" }}
                    >
                      <span className="block break-words">{c.campaign_name}</span>
                      <span className="text-xs" style={{ color: c.status === "ACTIVE" ? "var(--good)" : "var(--text-muted)" }}>
                        {c.status === "ACTIVE" ? "Activa" : "Pausada"} · {c.account_name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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
              <input type="date" value={customDraft.since} onChange={(e) => setCustomDraft((d) => ({ ...d, since: e.target.value }))} className="rounded-md px-2 py-1 text-sm" style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              <input type="date" value={customDraft.until} onChange={(e) => setCustomDraft((d) => ({ ...d, until: e.target.value }))} className="rounded-md px-2 py-1 text-sm" style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
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

        {!picked && (
          <p className="rounded-xl p-10 text-center text-sm" style={{ ...cardStyle, color: "var(--text-muted)" }}>
            Elige una campaña para ver qué copy, anuncio, ubicación, público, departamento y horario le funcionó y qué no.
          </p>
        )}

        {picked && !data && loading && (
          <p className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Analizando la campaña…
          </p>
        )}

        {data && (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <Summary data={data} />
            <Verdicts data={data} />

            {/* ---------- Pestañas ---------- */}
            <div className="mt-6 flex gap-1 overflow-x-auto border-b pb-px" style={{ borderColor: "var(--border)" }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="shrink-0 rounded-t-md px-3 py-2 text-sm font-medium"
                  style={{
                    color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
                    borderBottom: tab === t.key ? "2px solid var(--brand)" : "2px solid transparent",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === "anuncios" && <AdsTab data={data} />}
              {tab === "copys" && (
                <>
                  <SegmentTable dimension="copy" title="Textos (copy)" hint="Cada texto principal que usó la campaña." rows={data.segments.copy} totals={data.totals} wrap />
                  <SegmentTable dimension="titulo" title="Titulares" rows={data.segments.titulo} totals={data.totals} />
                  {data.segments.mensaje.length > 0 && (
                    <SegmentTable dimension="mensaje" title="Mensaje que llega a WhatsApp" hint="El texto prellenado con el que la persona inicia la conversación." rows={data.segments.mensaje} totals={data.totals} wrap />
                  )}
                  <SegmentTable dimension="formato" title="Formato" rows={data.segments.formato} totals={data.totals} />
                </>
              )}
              {tab === "ubicaciones" && (
                <>
                  <SegmentTable dimension="plataforma" title="Plataforma" rows={data.segments.plataforma} totals={data.totals} />
                  <SegmentTable dimension="ubicacion" title="Ubicación" rows={data.segments.ubicacion} totals={data.totals} />
                </>
              )}
              {tab === "publico" && <AudienceTab data={data} />}
              {tab === "departamentos" && (
                <>
                  <SegmentTable dimension="pais" title="País" rows={data.segments.pais} totals={data.totals} />
                  <SegmentTable dimension="region" title="Departamento / estado" rows={data.segments.region} totals={data.totals} limit={25} />
                </>
              )}
              {tab === "edad" && (
                <>
                  <SegmentTable dimension="genero" title="Género" rows={data.segments.genero} totals={data.totals} />
                  <SegmentTable dimension="edad" title="Edad" rows={[...data.segments.edad].sort((a, b) => a.key.localeCompare(b.key))} totals={data.totals} />
                  <SegmentTable dimension="edad_genero" title="Edad y género" rows={data.segments.edad_genero} totals={data.totals} />
                </>
              )}
              {tab === "horas" && <HoursTab rows={data.segments.hora} totals={data.totals} />}
              {tab === "dispositivos" && <SegmentTable dimension="dispositivo" title="Dispositivo" rows={data.segments.dispositivo} totals={data.totals} />}
              {tab === "dias" && <DaysTab data={data} />}
            </div>

            {data.notes.length > 0 && (
              <div className="mt-6 rounded-xl p-4 text-xs leading-relaxed" style={{ ...cardStyle, color: "var(--text-muted)" }}>
                {data.notes.map((n) => (
                  <p key={n}>• {n}</p>
                ))}
                <p>
                  • Verde: costo por resultado hasta {money(CPR_IDEAL)}; amarillo: hasta {money(CPR_MAX)}; rojo: más de {money(CPR_MAX)}. Un segmento solo se juzga si gastó al menos el 3% de la campaña.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* ================= secciones ================= */

function Summary({ data }: { data: CampaignAnalysis }) {
  const c = data.campaign;
  const t = data.totals;
  const value = cpr(t);
  const st = summaryTips(t);
  return (
    <>
      <div className="mb-3 rounded-xl p-4" style={cardStyle}>
        <p className="break-words text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          {c.name}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          <span style={{ color: c.status === "ACTIVE" ? "var(--good)" : "var(--text-muted)" }}>{c.status === "ACTIVE" ? "Activa" : "Pausada"}</span>
          {" · "}
          {c.account_name}
          {c.objective && ` · ${OBJECTIVE_LABEL[c.objective] ?? c.objective}`}
          {c.daily_budget ? ` · presupuesto ${money(c.daily_budget)}/día` : c.lifetime_budget ? ` · presupuesto total ${money(c.lifetime_budget)}` : ""}
          {c.start_time && ` · inició ${c.start_time.slice(0, 10)}`}
          {` · período ${data.range.since} al ${data.range.until}`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Gasto" value={money(t.spend)} />
        <Tile label="Resultados" value={t.results.toLocaleString("es-CO")} />
        <Tile label="Costo por resultado" value={value > 0 ? money(value) : "-"} color={cprColor(value, t.results)} tip={st.cpr} />
        <Tile label="CTR enlace" value={`${dec(t.ctr)}%`} color={BAND_COLOR[bandOf(t.ctr, AD_BANDS.ctr)]} tip={st.ctr} />
        <Tile label="CPM" value={money(t.cpm)} />
        <Tile label="Frecuencia" value={dec(t.frequency)} color={t.frequency > 2 ? BAND_COLOR[freqBand(t.frequency)] : undefined} tip={st.freq} />
      </div>
    </>
  );
}

function Verdicts({ data }: { data: CampaignAnalysis }) {
  if (data.totals.results === 0) {
    return (
      <p className="mt-5 rounded-xl p-4 text-sm" style={{ ...cardStyle, color: "var(--text-muted)" }}>
        La campaña no tiene resultados en este período: todavía no se puede comparar qué funciona.
      </p>
    );
  }
  return (
    <>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <FindingList title="✅ Lo que funcionó" subtitle="Más barato que el promedio de la campaña: repítelo." items={data.works} empty="Ningún segmento sale claramente más barato que el promedio." good totals={data.totals} />
        <FindingList title="❌ Lo que no funcionó" subtitle="Más caro que el promedio o sin resultados: recórtalo o cámbialo." items={data.fails} empty="Ningún segmento sale claramente más caro que el promedio. 👏" totals={data.totals} />
      </div>
      {data.recipe.length > 0 && (
        <section className="mt-5 rounded-xl p-4" style={{ ...cardStyle, borderColor: "var(--brand)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            🧪 Receta para replicar
          </h2>
          <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
            Lo mejor de cada parte de la campaña. Úsalo como base para la próxima campaña o para nuevos anuncios.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.recipe.map((f) => (
              <div key={`${f.dimension}|${f.label}`} className="rounded-lg p-3" style={{ background: "var(--surface-raised)" }}>
                <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  {DIMENSION_LABEL[f.dimension]}
                </p>
                <p className="mt-0.5 line-clamp-3 break-words text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {f.label}
                </p>
                <p className="mt-1 text-xs tabular-nums" style={{ color: cprColor(f.cpr, f.results) }}>
                  {money(f.cpr)} · {f.results} resultados
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function FindingList({ title, subtitle, items, empty, good, totals }: { title: string; subtitle: string; items: Finding[]; empty: string; good?: boolean; totals: { spend: number; results: number } }) {
  return (
    <section className="rounded-xl p-4" style={cardStyle}>
      <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h2>
      <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
        {subtitle}
      </p>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {empty}
        </p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 12).map((f) => (
            <div key={`${f.dimension}|${f.label}`} className="rounded-lg p-2.5" style={{ background: "var(--surface-raised)", borderLeft: `3px solid ${good ? "var(--good)" : "var(--critical)"}` }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  {DIMENSION_LABEL[f.dimension]}
                </span>
                <span className="min-w-0 break-words text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {f.label}
                </span>
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {f.text}
              </p>
              {!good && (() => {
                const fix = segmentTip(f.dimension, { label: f.label, spend: f.spend, results: f.results }, totals);
                return fix ? (
                  <p className="mt-1.5 text-xs" style={{ color: "var(--text-primary)" }}>
                    💡 <b>Qué hacer:</b> {fix.text.replace(/^.*?\. (?=[A-ZÁÉÍÓÚ¿“])/, "")}
                  </p>
                ) : null;
              })()}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AdsTab({ data }: { data: CampaignAnalysis }) {
  const minSpend = data.totals.spend * 0.03;
  const best =
    [...data.ads].filter((a) => a.results >= 5 && a.spend >= minSpend).sort((a, b) => a.spend / a.results - b.spend / b.results)[0] ?? null;
  const ctx = { totalSpend: data.totals.spend, avgCpr: cpr(data.totals), best };
  return (
    <div className="space-y-3">
      {data.ads.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sin anuncios con actividad.
        </p>
      )}
      {data.ads.map((a) => (
        <AdCard key={a.ad_id} ad={a} totalSpend={data.totals.spend} ctx={ctx} />
      ))}
    </div>
  );
}

function rankColor(label: string | null) {
  if (!label) return "var(--text-muted)";
  if (label.startsWith("Superior")) return "var(--good)";
  if (label.startsWith("Promedio")) return "var(--series-3)";
  return "var(--critical)";
}

const BAND_COLOR: Record<Band, string> = {
  rojo: "var(--critical)",
  amarillo: "var(--series-3)",
  verde: "var(--good)",
  sin_dato: "var(--text-muted)",
};

const pct = (n: number | null) => (n === null ? "-" : `${dec(n, 1)}%`);

// Tarjeta con sugerencia: al pasar el cursor (o tocar en el celular)
// muestra qué ajustar. Solo aparece cuando hay un indicador en amarillo o rojo.
function Hint({ tip, children, wide }: { tip?: Tip; children: React.ReactNode; wide?: boolean }) {
  if (!tip) return <>{children}</>;
  return (
    <span className="group relative inline-flex" tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-0 top-full z-40 mt-1 hidden rounded-lg p-3 text-xs leading-relaxed shadow-xl group-hover:block group-focus:block ${wide ? "w-96" : "w-80"} max-w-[85vw]`}
        style={{ background: "var(--surface-raised)", border: `1px solid ${BAND_COLOR[tip.level]}`, color: "var(--text-primary)" }}
      >
        <b style={{ color: BAND_COLOR[tip.level] }}>💡 {tip.title}.</b> {tip.text}
      </span>
    </span>
  );
}

function TipList({ tips, title = "Qué ajustar" }: { tips: Tip[]; title?: string }) {
  if (tips.length === 0) return null;
  const sorted = [...tips].sort((a, b) => (a.level === b.level ? 0 : a.level === "rojo" ? -1 : 1));
  return (
    <div className="mt-3 rounded-lg p-3" style={{ background: "var(--surface-raised)", border: "1px dashed var(--border)" }}>
      <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
        💡 {title}
      </p>
      <ul className="space-y-1.5 text-xs leading-relaxed">
        {sorted.map((t) => (
          <li key={t.title + t.text.slice(0, 20)} className="pl-2" style={{ borderLeft: `3px solid ${BAND_COLOR[t.level]}`, color: "var(--text-secondary)" }}>
            <b style={{ color: BAND_COLOR[t.level] }}>{t.title}:</b> {t.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Hook rate, hold rate, CTR y tasa de conversión del anuncio con los
// rangos de AD_BANDS. Hook y hold solo aplican a video.
function CreativeRates({ ad, tips }: { ad: AdRow; tips: Partial<Record<AdMetricKey, Tip>> }) {
  const r = adRates(ad);
  const items: { key: AdMetricKey; label: string; value: number | null; band: Band; def: string }[] = [
    ...(r.isVideo
      ? [
          { key: "hook" as const, label: "Hook rate", value: r.hook, band: bandOf(r.hook, AD_BANDS.hook), def: `Reproducciones de 3 s ÷ impresiones. Rojo < ${AD_BANDS.hook.red}%, verde > ${AD_BANDS.hook.green}%` },
          { key: "hold" as const, label: "Hold rate", value: r.hold, band: bandOf(r.hold, AD_BANDS.hold), def: `ThruPlays ÷ reproducciones de 3 s. Rojo < ${AD_BANDS.hold.red}%, verde > ${AD_BANDS.hold.green}%` },
        ]
      : []),
    { key: "ctr", label: "CTR", value: r.ctr, band: bandOf(r.ctr, AD_BANDS.ctr), def: `Clics en el enlace ÷ impresiones. Rojo < ${AD_BANDS.ctr.red}%, verde > ${AD_BANDS.ctr.green}%` },
    { key: "conv", label: "Tasa de conversión", value: r.conv, band: bandOf(r.conv, AD_BANDS.conv), def: `Conversaciones iniciadas ÷ clics en el enlace. Rojo < ${AD_BANDS.conv.red}%, verde > ${AD_BANDS.conv.green}%` },
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((it) => (
        <Hint key={it.key} tip={tips[it.key]}>
          <div title={tips[it.key] ? undefined : it.def} className="rounded-md px-2.5 py-1" style={{ background: "var(--surface-raised)", borderLeft: `3px solid ${BAND_COLOR[it.band]}`, cursor: tips[it.key] ? "help" : undefined }}>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              {it.label} {tips[it.key] && "💡"}
            </p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: BAND_COLOR[it.band] }}>
              {pct(it.value)}
            </p>
          </div>
        </Hint>
      ))}
      {!r.isVideo && (
        <p className="self-center text-[11px]" style={{ color: "var(--text-muted)" }}>
          Hook y hold rate solo aplican a video.
        </p>
      )}
    </div>
  );
}

function AdCard({ ad, totalSpend, ctx }: { ad: AdRow; totalSpend: number; ctx: Parameters<typeof adTips>[1] }) {
  const value = cpr(ad);
  const tips = adTips(ad, ctx);
  const fColor = BAND_COLOR[freqBand(ad.frequency)];
  return (
    <div className="rounded-xl p-3" style={{ ...cardStyle, borderLeft: `3px solid ${cprColor(value, ad.results)}` }}>
      <div className="flex gap-3">
        <a
          href={ad.preview_link ?? undefined}
          target="_blank"
          rel="noreferrer"
          title="Ver el anuncio"
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
        >
          {ad.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.thumbnail} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
          )}
          {ad.format === "VIDEO" && (
            <span className="absolute bottom-0.5 right-0.5 rounded px-1 text-[9px] font-bold" style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>
              ▶
            </span>
          )}
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {ad.name}
            </p>
            {ad.status !== "ACTIVE" && (
              <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                Pausado
              </span>
            )}
          </div>
          <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {ad.adset_name} · {ad.format === "VIDEO" ? "Video" : ad.format === "IMAGEN" ? "Imagen" : "Otro"}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
            <span>
              Gasto <b style={{ color: "var(--text-primary)" }}>{money(ad.spend)}</b> ({totalSpend > 0 ? Math.round((ad.spend / totalSpend) * 100) : 0}%)
            </span>
            <span>
              Resultados <b style={{ color: "var(--text-primary)" }}>{ad.results}</b>
            </span>
            <Hint tip={tips.cpr} wide>
              <span style={{ cursor: tips.cpr ? "help" : undefined }}>
                Costo/res. <b style={{ color: cprColor(value, ad.results) }}>{ad.results > 0 ? money(value) : "-"}</b>
                {tips.cpr && " 💡"}
              </span>
            </Hint>
            <Hint tip={tips.freq}>
              <span style={{ cursor: tips.freq ? "help" : undefined }}>
                Frecuencia <b style={{ color: fColor === "var(--good)" ? "var(--text-primary)" : fColor }}>{dec(ad.frequency)}</b>
                {tips.freq && " 💡"}
              </span>
            </Hint>
          </div>
          <CreativeRates ad={ad} tips={tips} />
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
            {(
              [
                ["Calidad", ad.quality, tips.calidad],
                ["Interacción", ad.engagement, tips.interaccion],
                ["Conversión", ad.conversion, tips.conversion],
              ] as const
            ).map(([k, v, t]) => (
              <Hint key={k} tip={t}>
                <span className="rounded-full px-2 py-0.5 font-semibold" style={{ color: rankColor(v), border: `1px solid ${rankColor(v)}`, cursor: t ? "help" : undefined }}>
                  {k}: {v ?? "sin dato"}
                  {t && " 💡"}
                </span>
              </Hint>
            ))}
          </div>
        </div>
      </div>
      {(ad.body || ad.title || ad.message) && (
        <div className="mt-2 rounded-md p-2 text-xs" style={{ background: "var(--surface-raised)", color: "var(--text-secondary)" }}>
          {ad.title && (
            <p>
              <b style={{ color: "var(--text-primary)" }}>Titular:</b> {ad.title}
            </p>
          )}
          {ad.body && (
            <p className="mt-1 whitespace-pre-line">
              <b style={{ color: "var(--text-primary)" }}>Texto:</b> {ad.body}
            </p>
          )}
          {ad.message && (
            <p className="mt-1">
              <b style={{ color: "var(--text-primary)" }}>Mensaje a WhatsApp:</b> {ad.message}
            </p>
          )}
        </div>
      )}
      <TipList tips={Object.values(tips).filter((t): t is Tip => !!t)} />
    </div>
  );
}

function AudienceTab({ data }: { data: CampaignAnalysis }) {
  return (
    <div className="space-y-3">
      {data.adsets.map((s) => {
        const value = cpr(s);
        return (
          <div key={s.adset_id} className="rounded-xl p-4" style={{ ...cardStyle, borderLeft: `3px solid ${cprColor(value, s.results)}` }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {s.name}{" "}
                <span className="text-xs font-normal" style={{ color: s.status === "ACTIVE" ? "var(--good)" : "var(--text-muted)" }}>
                  {s.status === "ACTIVE" ? "Activo" : "Pausado"}
                </span>
              </p>
              <p className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                {money(s.spend)} · {s.results} resultados ·{" "}
                <b style={{ color: cprColor(value, s.results) }}>{s.results > 0 ? money(value) : "-"}</b>
                {s.daily_budget ? ` · ${money(s.daily_budget)}/día` : ""}
              </p>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[10rem_1fr]">
              {s.audience.map((x) => (
                <div key={x.label} className="contents">
                  <dt style={{ color: "var(--text-muted)" }}>{x.label}</dt>
                  <dd className="break-words" style={{ color: "var(--text-primary)" }}>
                    {x.value}
                  </dd>
                </div>
              ))}
            </dl>
            <TipList tips={adsetTips(s)} title="Qué ajustar en este público" />
          </div>
        );
      })}
      {data.adsets.length > 1 && <SegmentTable dimension="conjunto" title="Comparación de públicos" rows={data.segments.conjunto} totals={data.totals} />}
    </div>
  );
}

function SegmentTable({ dimension, title, hint, rows, totals, wrap, limit }: { dimension: string; title: string; hint?: string; rows: Segment[]; totals: { spend: number; results: number }; wrap?: boolean; limit?: number }) {
  const [all, setAll] = useState(false);
  const avg = cpr(totals);
  const shown = limit && !all ? rows.slice(0, limit) : rows;
  const maxSpend = Math.max(1, ...rows.map((r) => r.spend));
  return (
    <section className="mb-4 rounded-xl p-4" style={cardStyle}>
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {hint && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Meta no devolvió datos para esta vista.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-xs tabular-nums">
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th className="pb-2 text-left font-medium">Segmento</th>
                <th className="pb-2 text-right font-medium">Gasto</th>
                <th className="pb-2 text-right font-medium">% gasto</th>
                <th className="pb-2 text-right font-medium">Resultados</th>
                <th className="pb-2 text-right font-medium">% result.</th>
                <th className="pb-2 text-right font-medium">Costo/res.</th>
                <th className="pb-2 text-right font-medium">vs prom.</th>
                <th className="pb-2 text-right font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const v = cpr(r);
                const delta = avg > 0 && v > 0 ? ((v - avg) / avg) * 100 : null;
                const tip = segmentTip(dimension, r, totals);
                return (
                  <Fragment key={r.key}>
                  <tr className="border-t align-top" style={{ borderColor: "var(--gridline)" }}>
                    <td className="py-2 pr-3" style={{ color: "var(--text-primary)" }}>
                      <span className={wrap ? "block max-w-xl whitespace-pre-line break-words" : "block max-w-xs truncate"} title={r.label}>
                        {r.label}
                      </span>
                      {r.sub && <span style={{ color: "var(--text-muted)" }}>{r.sub}</span>}
                      <span className="mt-1 block h-1 rounded" style={{ width: `${(r.spend / maxSpend) * 100}%`, background: "var(--series-4)", opacity: 0.5 }} />
                    </td>
                    <td className="py-2 text-right" style={{ color: "var(--text-secondary)" }}>
                      {money(r.spend)}
                    </td>
                    <td className="py-2 text-right" style={{ color: "var(--text-muted)" }}>
                      {totals.spend > 0 ? Math.round((r.spend / totals.spend) * 100) : 0}%
                    </td>
                    <td className="py-2 text-right" style={{ color: "var(--text-primary)" }}>
                      {r.results}
                    </td>
                    <td className="py-2 text-right" style={{ color: "var(--text-muted)" }}>
                      {totals.results > 0 ? Math.round((r.results / totals.results) * 100) : 0}%
                    </td>
                    <td className="py-2 text-right font-semibold" style={{ color: cprColor(v, r.results) }}>
                      {r.results > 0 ? money(v) : "-"}
                    </td>
                    <td className="py-2 text-right" style={{ color: delta === null ? "var(--text-muted)" : delta <= -10 ? "var(--good)" : delta >= 10 ? "var(--critical)" : "var(--text-secondary)" }}>
                      {delta === null ? "-" : `${delta > 0 ? "+" : ""}${Math.round(delta)}%`}
                    </td>
                    <td className="py-2 text-right" style={{ color: "var(--text-secondary)" }}>
                      {r.impressions > 0 ? `${dec((r.clicks / r.impressions) * 100)}%` : "-"}
                    </td>
                  </tr>
                  {tip && (
                    <tr>
                      <td colSpan={8} className="pb-2 pt-0">
                        <p className="rounded-md px-2 py-1.5 text-[11px] leading-relaxed" style={{ background: "var(--surface-raised)", borderLeft: `3px solid ${BAND_COLOR[tip.level]}`, color: "var(--text-secondary)" }}>
                          <b style={{ color: BAND_COLOR[tip.level] }}>💡 {tip.title}:</b> {tip.text}
                        </p>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {limit && rows.length > limit && (
            <button onClick={() => setAll((v) => !v)} className="mt-2 text-xs" style={{ color: "var(--brand)" }}>
              {all ? "Ver menos" : `Ver los ${rows.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function HoursTab({ rows, totals }: { rows: Segment[]; totals: { spend: number; results: number } }) {
  const byHour = new Map(rows.map((r) => [r.key, r]));
  const hours = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
  const maxResults = Math.max(1, ...rows.map((r) => r.results));
  const W = 720;
  const H = 150;
  const bw = W / 24;
  return (
    <>
      <section className="mb-4 rounded-xl p-4" style={cardStyle}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Resultados por hora del día
        </h3>
        <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Hora de la cuenta publicitaria. El color de la barra es el costo por resultado de esa hora.
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Resultados por hora">
          {hours.map((h, i) => {
            const r = byHour.get(h);
            const res = r?.results ?? 0;
            const height = (res / maxResults) * (H - 30);
            return (
              <g key={h}>
                <rect x={i * bw + 3} y={H - 18 - height} width={bw - 6} height={height} rx={2} fill={r ? cprColor(cpr(r), res) : "var(--gridline)"} opacity={0.85}>
                  <title>{`${h}:00 · ${res} resultados · ${r && res > 0 ? money(cpr(r)) : "-"}`}</title>
                </rect>
                {i % 2 === 0 && (
                  <text x={i * bw + bw / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                    {h}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </section>
      <SegmentTable dimension="hora" title="Detalle por hora" rows={rows} totals={totals} />
    </>
  );
}

function DaysTab({ data }: { data: CampaignAnalysis }) {
  const days = data.daily.filter((d) => d.spend > 0);
  const rows: Segment[] = [...days].reverse().map((d) => ({ ...d, key: d.date, label: d.date }));
  if (days.length < 2) return <SegmentTable dimension="dia" title="Día a día" rows={rows} totals={data.totals} />;
  const W = 720;
  const H = 150;
  const pad = 24;
  const maxSpend = Math.max(...days.map((d) => d.spend));
  const cprs = days.map((d) => (d.results > 0 ? d.spend / d.results : null));
  const maxCpr = Math.max(CPR_MAX * 1.3, ...cprs.filter((c): c is number => c !== null));
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, days.length - 1);
  const bw = Math.max(4, (W - pad * 2) / days.length - 6);
  const y = (c: number) => H - 18 - (c / maxCpr) * (H - 34);
  const pts = cprs.map((c, i) => (c === null ? null : `${x(i)},${y(c)}`)).filter(Boolean).join(" ");
  return (
    <>
      <section className="mb-4 rounded-xl p-4" style={cardStyle}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Evolución diaria
        </h3>
        <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Barras = gasto; línea = costo por resultado; punteada = tu máximo de {money(CPR_MAX)}.
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolución diaria de la campaña">
          {days.map((d, i) => (
            <g key={d.date}>
              <rect x={x(i) - bw / 2} y={H - 18 - (d.spend / maxSpend) * (H - 34)} width={bw} height={(d.spend / maxSpend) * (H - 34)} fill="var(--series-4)" opacity={0.35}>
                <title>{`${d.date} · ${money(d.spend)} · ${d.results} resultados`}</title>
              </rect>
              {(days.length <= 16 || i % Math.ceil(days.length / 16) === 0) && (
                <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
                  {d.date.slice(5)}
                </text>
              )}
            </g>
          ))}
          <line x1={pad} x2={W - pad} y1={y(CPR_MAX)} y2={y(CPR_MAX)} stroke="var(--critical)" strokeDasharray="4 4" opacity={0.6} />
          {pts && <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth={2} />}
        </svg>
      </section>
      <SegmentTable dimension="dia" title="Día a día" rows={rows} totals={data.totals} />
    </>
  );
}

function Tile({ label, value, color, tip }: { label: string; value: string; color?: string; tip?: Tip }) {
  const box = (
    <div className="w-full rounded-xl p-4" style={{ ...cardStyle, cursor: tip ? "help" : undefined }}>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label} {tip && "💡"}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
  return tip ? (
    <Hint tip={tip} wide>
      {box}
    </Hint>
  ) : (
    box
  );
}
