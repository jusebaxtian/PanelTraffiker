"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { drawReportImage } from "@/lib/reportImage";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { bogotaYesterdayClient } from "@/lib/bogota";
import ScrollDropdown from "@/components/ScrollDropdown";

interface ReportRow {
  id: string;
  asignacion: string;
  admin: string;
  label: string;
  diario: number;
  diario_is_custom: boolean;
  diario_distribucion: number;
  include: boolean;
  position: number;
  resultados_meta: number;
  leads_crm: number;
  inversion: number;
}


const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const num = (n: number) => Math.round(n).toLocaleString("es-CO");

// dd/mm/aaaa como en el Excel
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function ReporteImagenPage() {
  const { isSuperAdmin } = useCurrentUser();
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"download" | "copy" | "share" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const y = bogotaYesterdayClient();
    Promise.resolve().then(() => setDate(y));
    fetch("/api/reporte-diario/dates")
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) setDates(json.data.dates.includes(y) ? json.data.dates : [y, ...json.data.dates]);
      })
      .catch(() => {});
  }, []);

  const queryKey = date ? `${date}|${reloadTick}` : null;
  const loading = !!queryKey && loadedKey !== queryKey;

  useEffect(() => {
    if (!date || !queryKey) return;
    const id = ++requestId.current;
    fetch(`/api/reporte-imagen?date=${date}`)
      .then((r) => r.json())
      .then((json) => {
        if (id !== requestId.current) return;
        if (json.error) {
          setError(json.error);
          setRows([]);
        } else {
          setError(null);
          setRows(json.data.rows);
        }
      })
      .catch((e) => id === requestId.current && setError(e.message))
      .finally(() => id === requestId.current && setLoadedKey(queryKey));
  }, [date, queryKey]);

  const visible = useMemo(() => rows.filter((r) => r.include), [rows]);
  const totals = useMemo(() => {
    const t = visible.reduce(
      (s, r) => ({ diario: s.diario + r.diario, meta: s.meta + r.resultados_meta, crm: s.crm + r.leads_crm, inv: s.inv + r.inversion }),
      { diario: 0, meta: 0, crm: 0, inv: 0 }
    );
    return { ...t, cpr: t.meta > 0 ? t.inv / t.meta : 0 };
  }, [visible]);

  function renderPng(): Promise<Blob> {
    return drawReportImage(date ? fmtDate(date) : "", visible, totals);
  }

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  }

  async function download() {
    setBusy("download");
    try {
      const url = URL.createObjectURL(await renderPng());
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-${date}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      flash("Imagen descargada");
    } catch (e) {
      flash(e instanceof Error ? e.message : "No se pudo generar la imagen");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    setBusy("copy");
    try {
      const blob = await renderPng();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      flash("Imagen copiada: pégala en el chat de WhatsApp con Ctrl+V");
    } catch {
      flash("Tu navegador no permite copiar imágenes; usa Descargar");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    try {
      const blob = await renderPng();
      const file = new File([blob], `reporte-${date}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Reporte ${date ? fmtDate(date) : ""}` });
      } else {
        flash("Compartir no está disponible en este navegador; usa Descargar o Copiar");
      }
    } catch {
      // el usuario canceló el menú de compartir
    } finally {
      setBusy(null);
    }
  }

  async function saveConfig(id: string, updates: Record<string, unknown>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...applyLocal(r, updates) } : r)));
    await fetch(`/api/reporte-imagen/config/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setReloadTick((t) => t + 1);
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    const reordered = [...rows];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setRows(reordered);
    await Promise.all(
      reordered.map((r, i) =>
        fetch(`/api/reporte-imagen/config/${r.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ report_position: i + 1 }),
        })
      )
    );
  }

  const btn = (active: boolean) => ({
    background: active ? "var(--brand)" : "var(--surface)",
    color: active ? "#ffffff" : "var(--text-primary)",
    border: "1px solid var(--border)",
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Reporte Imagen
        </span>
        <span className="hidden text-sm sm:block" style={{ color: "var(--text-muted)" }}>
          Reporte diario por pauta, listo para enviar por WhatsApp
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {date && dates.length > 0 && (
            <ScrollDropdown
              value={date}
              options={dates.map((d) => ({ value: d, label: fmtDate(d) }))}
              onChange={(v) => setDate(v)}
            />
          )}
          <button onClick={download} disabled={!!busy || loading || visible.length === 0} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={btn(true)}>
            {busy === "download" ? "Generando…" : "⬇ Descargar imagen"}
          </button>
          <button onClick={copy} disabled={!!busy || loading || visible.length === 0} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={btn(false)}>
            {busy === "copy" ? "Copiando…" : "📋 Copiar imagen"}
          </button>
          <button onClick={share} disabled={!!busy || loading || visible.length === 0} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" style={btn(false)}>
            {busy === "share" ? "Abriendo…" : "📤 Compartir"}
          </button>
          {isSuperAdmin && (
            <button onClick={() => setShowConfig((v) => !v)} className="ml-auto rounded-lg px-4 py-2 text-sm font-medium" style={btn(showConfig)}>
              ⚙ Ajustar filas
            </button>
          )}
        </div>

        {notice && (
          <p className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface)", color: "var(--good)", border: "1px solid var(--border)" }}>
            {notice}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface)", color: "var(--critical)", border: "1px solid var(--border)" }}>
            {error}
          </p>
        )}

        {/* ---------- La tarjeta que se exporta como imagen (siempre clara) ---------- */}
        <div className="overflow-x-auto rounded-lg" style={{ opacity: loading ? 0.6 : 1 }}>
          <div ref={cardRef} style={{ background: "#ffffff", padding: 16, width: 1080, fontFamily: "Calibri, Arial, sans-serif", color: "#111827" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th colSpan={7} style={{ background: "#f4b183", border: "1px solid #7f7f7f", padding: "6px 8px", fontSize: 16, fontWeight: 700 }}>
                    {date ? fmtDate(date) : ""}
                  </th>
                </tr>
                <tr style={{ background: "#d9d9d9" }}>
                  {["Admin", "Pautas", "Diario", "Resul Meta", "CRM", "Costo X Resultado", "Inversión"].map((h) => (
                    <th key={h} style={{ border: "1px solid #7f7f7f", padding: "5px 8px", fontWeight: 700, textAlign: h === "Admin" || h === "Pautas" ? "left" : "center" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const cpr = r.resultados_meta > 0 ? r.inversion / r.resultados_meta : 0;
                  return (
                    <tr key={r.id}>
                      <td style={cell("left")}>{r.admin}</td>
                      <td style={cell("left")}>☑ {r.label}</td>
                      <td style={cell("right")}>{money(r.diario)}</td>
                      <td style={cell("center")}>{num(r.resultados_meta)}</td>
                      <td style={cell("center")}>{num(r.leads_crm)}</td>
                      <td style={cell("center")}>{cpr > 0 ? money(cpr) : "-"}</td>
                      <td style={cell("right")}>{money(r.inversion)}</td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 700 }}>
                  <td style={cell("left")} />
                  <td style={cell("left")} />
                  <td style={cell("right")}>{money(totals.diario)}</td>
                  <td style={cell("center")}>{num(totals.meta)}</td>
                  <td style={cell("center")}>{num(totals.crm)}</td>
                  <td style={cell("center")}>{totals.cpr > 0 ? money(totals.cpr) : "-"}</td>
                  <td style={cell("right")}>{money(totals.inv)}</td>
                </tr>
              </tbody>
            </table>
            {visible.length === 0 && !loading && <p style={{ padding: 12, color: "#6b7280" }}>Sin pautas incluidas para esta fecha.</p>}
          </div>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Datos del Reporte Diario de esa fecha. Costo X Resultado = Inversión ÷ Resultados Meta; el total usa la inversión total ÷ resultados totales.
        </p>

        {/* ---------- Ajustes de cada fila (solo SuperAdmin) ---------- */}
        {isSuperAdmin && showConfig && (
          <section className="mt-6 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Ajustar filas
            </h2>
            <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
              Los cambios se guardan al salir de cada campo y quedan para todos los días. Si dejas el Diario vacío se usa el total de la Distribución.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ color: "var(--text-primary)" }}>
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
                    <th className="px-2 py-1 text-left">Incluir</th>
                    <th className="px-2 py-1 text-left">Orden</th>
                    <th className="px-2 py-1 text-left">Oficina</th>
                    <th className="px-2 py-1 text-left">Admin</th>
                    <th className="px-2 py-1 text-left">Nombre de la pauta</th>
                    <th className="px-2 py-1 text-left">Diario</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--gridline)" }}>
                      <td className="px-2 py-1">
                        <input type="checkbox" checked={r.include} onChange={(e) => saveConfig(r.id, { report_include: e.target.checked })} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-1">
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1 disabled:opacity-30">▲</button>
                        <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="px-1 disabled:opacity-30">▼</button>
                      </td>
                      <td className="px-2 py-1" style={{ color: "var(--text-secondary)" }}>{r.asignacion}</td>
                      <td className="px-2 py-1">
                        <input key={`a-${r.id}-${r.admin}`} defaultValue={r.admin} onBlur={(e) => e.target.value !== r.admin && saveConfig(r.id, { report_admin: e.target.value })} className="w-28 rounded px-2 py-1" style={inputStyle} />
                      </td>
                      <td className="px-2 py-1">
                        <input key={`l-${r.id}-${r.label}`} defaultValue={r.label} onBlur={(e) => e.target.value !== r.label && saveConfig(r.id, { report_label: e.target.value })} className="w-80 rounded px-2 py-1" style={inputStyle} />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          key={`d-${r.id}-${r.diario}-${r.diario_is_custom}`}
                          type="number"
                          defaultValue={r.diario_is_custom ? r.diario : ""}
                          placeholder={`${num(r.diario_distribucion)} (Distribución)`}
                          onBlur={(e) => {
                            const v = e.target.value;
                            const current = r.diario_is_custom ? String(r.diario) : "";
                            if (v !== current) saveConfig(r.id, { report_diario: v === "" ? null : Number(v) });
                          }}
                          className="w-44 rounded px-2 py-1"
                          style={inputStyle}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const inputStyle = { background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" } as const;

function cell(align: "left" | "right" | "center"): React.CSSProperties {
  return { border: "1px solid #7f7f7f", padding: "5px 8px", textAlign: align, whiteSpace: "nowrap" };
}

// Refleja al instante en pantalla un cambio de configuración, antes de
// que vuelva la respuesta del servidor.
function applyLocal(r: ReportRow, u: Record<string, unknown>): Partial<ReportRow> {
  const out: Partial<ReportRow> = {};
  if (typeof u.report_admin === "string") out.admin = u.report_admin;
  if (typeof u.report_label === "string") out.label = u.report_label || r.asignacion;
  if (typeof u.report_include === "boolean") out.include = u.report_include;
  if ("report_diario" in u) {
    out.diario = u.report_diario === null ? r.diario_distribucion : Number(u.report_diario);
    out.diario_is_custom = u.report_diario !== null;
  }
  return out;
}
