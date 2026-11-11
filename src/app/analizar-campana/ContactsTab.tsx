"use client";

// Pestaña "Contactos": qué contactos de GHL llegaron por cada anuncio de la
// campaña, con su conjunto, campaña, red social y el mensaje que escribieron.
import { useEffect, useMemo, useState } from "react";
import type { CampaignAnalysis } from "@/lib/analizarCampanaTypes";
import { ftdDays, ghlContactUrl, type ContactoCampana, type ContactosResponse } from "@/lib/campanaContactosTypes";

const PAGE = 50;
const cardStyle = { background: "var(--surface)", border: "1px solid var(--border)" } as const;
const RED_COLOR: Record<string, string> = { Facebook: "#1877F2", Instagram: "#E1306C", "Sin dato": "var(--text-muted)" };

// Enlace al anuncio dentro del Administrador de anuncios de Meta.
const adsManagerUrl = (accountId: string, adId: string) =>
  `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${accountId.replace(/^act_/, "")}&selected_ad_ids=${adId}`;

const linkBtn = { background: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border)" } as const;

function daysLabel(d: number | null) {
  if (d === null) return "-";
  return d === 0 ? "0 (mismo día)" : String(d);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function ContactsTab({ data }: { data: CampaignAnalysis }) {
  const adIds = useMemo(() => data.ads.map((a) => a.ad_id), [data.ads]);
  const queryKey = `${data.campaign.id}|${data.range.since}|${data.range.until}|${adIds.join(",")}`;
  const [result, setResult] = useState<{ key: string; data?: ContactosResponse; error?: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<Record<string, string | null>>({});
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [onlyFtd, setOnlyFtd] = useState(false);

  useEffect(() => {
    if (!adIds.length) return;
    let cancelled = false;
    const q = new URLSearchParams({ campaign_id: data.campaign.id, since: data.range.since, until: data.range.until, ad_ids: adIds.join(",") });
    fetch(`/api/analizar-campana/contactos?${q}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setResult(json.error ? { key: queryKey, error: json.error } : { key: queryKey, data: json.data });
      })
      .catch(() => !cancelled && setResult({ key: queryKey, error: "No se pudo consultar GoHighLevel" }));
    return () => {
      cancelled = true;
    };
  }, [queryKey, adIds, data.campaign.id, data.range.since, data.range.until]);

  const current = result?.key === queryKey ? result : null;
  const contacts = useMemo(() => current?.data?.contacts ?? [], [current]);

  const groups = useMemo(() => {
    const byAd = new Map<string, ContactoCampana[]>();
    contacts.filter((c) => !onlyFtd || c.ftd).forEach((c) => byAd.set(c.ad_id, [...(byAd.get(c.ad_id) ?? []), c]));
    return data.ads
      .map((ad) => ({ ad, list: [...(byAd.get(ad.ad_id) ?? [])].sort((a, b) => Number(!!b.ftd) - Number(!!a.ftd) || b.date.localeCompare(a.date)) }))
      .filter((g) => g.list.length > 0 || (!onlyFtd && g.ad.results > 0))
      .sort((a, b) => b.list.length - a.list.length || b.ad.results - a.ad.results);
  }, [contacts, data.ads, onlyFtd]);

  // Pide el mensaje de los contactos visibles que aún no lo tienen.
  async function loadMessages(list: ContactoCampana[]) {
    const missing = list.filter((c) => !(c.id in messages));
    if (!missing.length) return;
    setLoadingMsgs(true);
    const byCrm = new Map<string, string[]>();
    missing.forEach((c) => byCrm.set(c.crm_id, [...(byCrm.get(c.crm_id) ?? []), c.id]));
    const found: Record<string, string | null> = {};
    await Promise.all(
      [...byCrm.entries()].map(async ([crm, ids]) => {
        for (let i = 0; i < ids.length; i += PAGE) {
          const chunk = ids.slice(i, i + PAGE);
          try {
            const json = await (await fetch(`/api/analizar-campana/contactos/mensajes?crm_id=${crm}&ids=${chunk.join(",")}`)).json();
            Object.assign(found, json.data ?? Object.fromEntries(chunk.map((id) => [id, null])));
          } catch {
            chunk.forEach((id) => (found[id] = null));
          }
        }
      })
    );
    setMessages((m) => ({ ...m, ...found }));
    setLoadingMsgs(false);
  }

  function toggle(adId: string, list: ContactoCampana[]) {
    if (open === adId) return setOpen(null);
    setOpen(adId);
    loadMessages(list.slice(0, shown[adId] ?? PAGE));
  }

  function more(adId: string, list: ContactoCampana[]) {
    const n = (shown[adId] ?? PAGE) + PAGE;
    setShown((s) => ({ ...s, [adId]: n }));
    loadMessages(list.slice(0, n));
  }

  if (!adIds.length) {
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>La campaña no tiene anuncios con actividad en este período.</p>;
  }
  if (!current) {
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Buscando en GoHighLevel los contactos que llegaron por estos anuncios…</p>;
  }
  if (current.error) {
    return <p className="text-sm" style={{ color: "var(--critical)" }}>{current.error}</p>;
  }

  const res = current.data!;
  const metaTotal = data.totals.results;
  const fb = contacts.filter((c) => c.red === "Facebook").length;
  const ig = contacts.filter((c) => c.red === "Instagram").length;
  const ftds = contacts.filter((c) => c.ftd);
  const days = ftds.map(ftdDays).filter((d): d is number => d !== null);
  const avgDays = days.length ? days.reduce((a, b) => a + b, 0) / days.length : null;
  const anyApprox = ftds.some((c) => !c.ftd_date_exact);

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-4" style={cardStyle}>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          <b>{contacts.length.toLocaleString("es-CO")}</b> contactos llegaron al CRM por los anuncios de esta campaña
          {metaTotal > 0 && (
            <>
              {" "}
              · Meta reporta <b>{metaTotal.toLocaleString("es-CO")}</b> conversaciones ({Math.round((contacts.length / metaTotal) * 100)}% llegó)
            </>
          )}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Subcuenta: {res.crms.length ? res.crms.join(", ") : "ninguna con contactos de estos anuncios"} · Facebook {fb} · Instagram {ig}
          {contacts.length - fb - ig > 0 && ` · sin dato ${contacts.length - fb - ig}`} · Del {data.range.since} al {data.range.until}
        </p>
        {res.ftd_field ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: "var(--text-primary)" }}>
            <span>
              <b style={{ color: "var(--good)" }}>{ftds.length}</b> FTDs (ID Plataforma lleno)
            </span>
            {contacts.length > 0 && <span style={{ color: "var(--text-secondary)" }}>{((ftds.length / contacts.length) * 100).toFixed(1)}% de los que llegaron</span>}
            {avgDays !== null && <span style={{ color: "var(--text-secondary)" }}>Demoran en promedio {avgDays.toFixed(1)} días</span>}
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={onlyFtd} onChange={(e) => setOnlyFtd(e.target.checked)} />
              Ver solo FTDs
            </label>
          </div>
        ) : (
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Esta subcuenta no tiene el campo &quot;ID Plataforma&quot;, por eso no se pueden contar FTDs.
          </p>
        )}
        {res.truncated && (
          <p className="mt-1 text-xs" style={{ color: "var(--series-3)" }}>
            El período tiene demasiados contactos; se muestran los más recientes. Acorta las fechas para ver todo.
          </p>
        )}
        {res.errors.length > 0 && (
          <p className="mt-1 text-xs" style={{ color: "var(--critical)" }}>
            No se pudo leer: {res.errors.join(" · ")}
          </p>
        )}
      </div>

      {groups.map(({ ad, list }) => {
        const isOpen = open === ad.ad_id;
        const n = shown[ad.ad_id] ?? PAGE;
        const adFb = list.filter((c) => c.red === "Facebook").length;
        const adIg = list.filter((c) => c.red === "Instagram").length;
        const adFtd = list.filter((c) => c.ftd).length;
        return (
          <div key={ad.ad_id} className="rounded-xl" style={cardStyle}>
            <div className="flex flex-wrap items-center gap-3 p-3">
              {ad.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ad.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-md" style={{ background: "var(--surface-raised)" }} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {ad.name}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <b style={{ color: "var(--text-primary)" }}>{list.length}</b>{" "}
                  {onlyFtd ? (list.length === 1 ? "FTD" : "FTDs") : list.length === 1 ? "conversación llegó al CRM" : "conversaciones llegaron al CRM"}
                  {" "}· Meta reporta {ad.results}
                  {list.length > 0 && (
                    <>
                      {" "}· <span style={{ color: RED_COLOR.Facebook }}>Facebook {adFb}</span> · <span style={{ color: RED_COLOR.Instagram }}>Instagram {adIg}</span>
                    </>
                  )}
                  {res.ftd_field && !onlyFtd && (
                    <>
                      {" "}· <b style={{ color: adFtd ? "var(--good)" : "var(--text-muted)" }}>{adFtd} {adFtd === 1 ? "FTD" : "FTDs"}</b>
                    </>
                  )}
                </p>
              </div>
              {ad.preview_link && (
                <a href={ad.preview_link} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium" style={linkBtn}>
                  Ver anuncio ↗
                </a>
              )}
              {list.length > 0 && (
                <button
                  onClick={() => toggle(ad.ad_id, list)}
                  className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium"
                  style={{ background: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                >
                  {isOpen ? "Ocultar" : "Ver más"}
                </button>
              )}
            </div>

            {isOpen && (
              <div className="overflow-x-auto border-t px-3 pb-3" style={{ borderColor: "var(--gridline)" }}>
                <table className="w-full min-w-[1250px] text-xs">
                  <thead>
                    <tr style={{ color: "var(--text-muted)" }}>
                      <th className="py-2 text-left font-medium">Contacto</th>
                      <th className="py-2 text-left font-medium">ID Plataforma (FTD)</th>
                      <th className="py-2 text-left font-medium">Asesor</th>
                      <th className="py-2 text-left font-medium">Entró al CRM</th>
                      <th className="py-2 text-left font-medium">Llenó FTD</th>
                      <th className="py-2 pr-4 text-right font-medium">Días</th>
                      <th className="py-2 text-left font-medium">Anuncio</th>
                      <th className="py-2 text-left font-medium">Conjunto</th>
                      <th className="py-2 text-left font-medium">Campaña</th>
                      <th className="py-2 text-left font-medium">Red</th>
                      <th className="py-2 text-left font-medium">Mensaje que escribió</th>
                      <th className="py-2 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.slice(0, n).map((c) => (
                      <tr key={c.id} className="border-t align-top" style={{ borderColor: "var(--gridline)", background: c.ftd ? "color-mix(in srgb, var(--good) 10%, transparent)" : undefined }}>
                        <td className="py-2 pr-2">
                          <p className="font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                          {c.phone && <p style={{ color: "var(--text-muted)" }}>{c.phone}</p>}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2 font-semibold tabular-nums" style={{ color: c.ftd ? "var(--good)" : "var(--text-muted)" }}>
                          {c.ftd ?? "-"}
                        </td>
                        <td className="py-2 pr-2" style={{ color: "var(--text-secondary)" }}>
                          {c.asesor ?? <span style={{ color: "var(--text-muted)" }}>Sin asignar</span>}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2" style={{ color: "var(--text-secondary)" }}>{fmtDate(c.date)}</td>
                        <td
                          className="whitespace-nowrap py-2 pr-2"
                          style={{ color: "var(--text-secondary)" }}
                          title={c.ftd && !c.ftd_date_exact ? "Aproximado: última vez que se editó el contacto" : undefined}
                        >
                          {c.ftd && c.ftd_date ? fmtDate(c.ftd_date) + (c.ftd_date_exact ? "" : " *") : "-"}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums" style={{ color: "var(--text-primary)" }}>
                          {daysLabel(ftdDays(c))}
                        </td>
                        <td className="py-2 pr-2">
                          <a
                            href={ad.preview_link ?? adsManagerUrl(data.campaign.account_id, ad.ad_id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-dotted underline-offset-2"
                            style={{ color: "var(--brand)" }}
                            title="Ver el anuncio"
                          >
                            {ad.name} ↗
                          </a>
                        </td>
                        <td className="py-2 pr-2" style={{ color: "var(--text-secondary)" }}>{ad.adset_name}</td>
                        <td className="py-2 pr-2" style={{ color: "var(--text-secondary)" }}>{data.campaign.name}</td>
                        <td className="py-2 pr-2 font-medium" style={{ color: RED_COLOR[c.red] }}>{c.red}</td>
                        <td className="max-w-[280px] py-2 pr-2" style={{ color: "var(--text-secondary)" }}>
                          {c.id in messages ? (messages[c.id] ?? <span style={{ color: "var(--text-muted)" }}>Sin mensaje</span>) : <span style={{ color: "var(--text-muted)" }}>{loadingMsgs ? "Cargando…" : "-"}</span>}
                        </td>
                        <td className="py-2 text-right">
                          <a
                            href={ghlContactUrl(c.location_id, c.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="whitespace-nowrap rounded-md px-2 py-1 font-medium"
                            style={{ background: "var(--brand)", color: "#fff" }}
                          >
                            Ver contacto
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {list.length > n && (
                  <button onClick={() => more(ad.ad_id, list)} className="mt-2 text-xs font-medium" style={{ color: "var(--brand)" }}>
                    Mostrar {Math.min(PAGE, list.length - n)} más de {list.length - n} restantes
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {anyApprox && (
          <>
            * Fecha aproximada: GoHighLevel no guarda cuándo se llenó un campo, así que se usa la última vez que se editó el contacto. Para tener la fecha
            exacta, crea en la subcuenta un campo de fecha llamado &quot;Fecha FTD&quot; y un flujo que lo llene cuando se llene ID Plataforma; el panel lo
            usará solo.{" "}
          </>
        )}
        Cómo se cruza: GoHighLevel guarda en cada contacto el número del anuncio que lo trajo y el enlace de la publicación (Facebook o Instagram). Meta no informa la ubicación exacta (Reels, Feed, Historias) de cada persona, por eso no se muestra aquí.
      </p>
    </div>
  );
}
