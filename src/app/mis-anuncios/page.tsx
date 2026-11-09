"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CPR_IDEAL, CPR_MAX, type AdDay, type AdLifetime, type AdPeriodStats, type Diagnosis } from "@/lib/adDiagnosis";

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

function cprColor(cpr: number, results: number): string {
  if (results === 0 || cpr === 0) return "var(--text-muted)";
  if (cpr <= CPR_IDEAL) return "var(--good)";
  if (cpr <= CPR_MAX) return "var(--series-3)";
  return "var(--critical)";
}

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
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const [onlyActive, setOnlyActive] = useState(true);
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
          setError(null);
        }
      })
      .catch((e) => id === requestId.current && setError(e.message))
      .finally(() => id === requestId.current && setLoadedKey(queryKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, campaignKey]);

  const scoped = useMemo(() => (onlyActive ? ads.filter((a) => a.status === "ACTIVE") : ads), [ads, onlyActive]);

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
          Tus mejores y peores anuncios del período
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
            {scoped.length === 0 && (
              <p className="rounded-xl p-6 text-center text-sm" style={{ ...cardStyle, color: "var(--text-muted)" }}>
                No hay anuncios con actividad en este período{onlyActive ? " (prueba desmarcar “Solo anuncios activos”)" : ""}.
              </p>
            )}

            {/* ---------- Tops ---------- */}
            {(best.length > 0 || worst.length > 0) && (
              <div className="grid gap-5 lg:grid-cols-2">
                <Section title="Top 5 mejores anuncios" subtitle="Menor costo por resultado con datos suficientes.">
                  {best.map((a, i) => (
                    <RankRow key={a.ad_id} rank={i + 1} ad={a} onPreview={setPreview} />
                  ))}
                </Section>
                <Section title="Top 5 peores anuncios" subtitle="Los que más cuestan o gastan sin resultados.">
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
          </div>
        )}
      </main>

      {preview && <PreviewModal ad={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/* ================= componentes ================= */

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
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
