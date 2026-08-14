"use client";

import { useEffect, useState } from "react";
import type { ReporteDiarioOfficeComputed } from "@/lib/reporteDiario";
import { officeTotal, type Agent } from "@/lib/distribucion";
import CampaignPicker from "@/components/CampaignPicker";
import OfficePicker from "@/components/OfficePicker";
import CrmTagPicker from "@/components/CrmTagPicker";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface DistribucionOffice {
  id: string;
  name: string;
  total: number;
}

interface CrmConnection {
  id: string;
  name: string;
  location_id: string;
}

function currency(n: number) {
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function number(n: number) {
  return n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

function visualDate(dateStr: string, yesterday: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const label = new Date(year, month - 1, day).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
  return dateStr === yesterday ? `Ayer · ${capitalized}` : capitalized;
}

export default function ReporteDiarioPage() {
  const { isSuperAdmin } = useCurrentUser();
  const [dates, setDates] = useState<string[]>([]);
  const [yesterday, setYesterday] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [offices, setOffices] = useState<ReporteDiarioOfficeComputed[]>([]);
  const [distribucionOffices, setDistribucionOffices] = useState<DistribucionOffice[]>([]);
  const [crmConnections, setCrmConnections] = useState<CrmConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [campaignPickerForId, setCampaignPickerForId] = useState<string | null>(null);
  const [officePickerForId, setOfficePickerForId] = useState<string | null>(null);
  const [crmPickerForId, setCrmPickerForId] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ updatedAt: string | null; forceRemaining: number; nextWindowAt: string } | null>(
    null
  );

  function loadSnapshot(date: string, silent = false, configChange = false, manual = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const params = new URLSearchParams({ date });
    if (configChange) params.set("configChange", "1");
    if (manual) params.set("manual", "1");
    fetch(`/api/reporte-diario/snapshot?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else {
          setOffices(json.data);
          setCacheInfo(json.cache ?? null);
          setError(null);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    loadSnapshot(date);
  }

  useEffect(() => {
    fetch("/api/reporte-diario/dates")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) {
          setDates(json.data.dates);
          setYesterday(json.data.yesterday);
          selectDate(json.data.yesterday);
        }
      });
    fetch("/api/offices")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) {
          setDistribucionOffices(
            json.data.map((o: { id: string; name: string; agents: Agent[] }) => ({
              id: o.id,
              name: o.name,
              total: officeTotal({ agents: o.agents }),
            }))
          );
        }
      })
      .catch(() => {});
    fetch("/api/proyeccion/crm-connections")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setCrmConnections(json.data);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    if (selectedDate) loadSnapshot(selectedDate, true, false, true);
  }

  async function createOffice() {
    if (!newName.trim()) return;
    const res = await fetch("/api/reporte-diario/offices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asignacion: newName.trim() }),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setNewName("");
    if (selectedDate) loadSnapshot(selectedDate, true);
  }

  const CONFIG_CHANGE_FIELDS = ["campaigns", "distribucion_office_id", "ghl_tag", "crm_connection_id"];

  async function updateOffice(id: string, updates: Record<string, unknown>) {
    await fetch(`/api/reporte-diario/offices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    // Vincular una campaña, oficina o CRM nuevos debe reflejarse de
    // inmediato; el resto de ediciones usan la caché del día.
    const isConfigChange = Object.keys(updates).some((k) => CONFIG_CHANGE_FIELDS.includes(k));
    if (selectedDate) loadSnapshot(selectedDate, true, isConfigChange);
  }

  async function deleteOffice(id: string) {
    setOffices((prev) => prev.filter((o) => o.id !== id));
    await fetch(`/api/reporte-diario/offices/${id}`, { method: "DELETE" });
  }

  const totals = offices.reduce(
    (acc, o) => {
      acc.gasto += o.gasto;
      acc.leads_meta += o.leads_meta;
      acc.leads_crm += o.leads_crm;
      return acc;
    },
    { gasto: 0, leads_meta: 0, leads_crm: 0 }
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Reporte Diario
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Gasto y leads del día por campaña
        </span>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 sm:py-8">
        {yesterday && (
          <div
            className="mb-6 flex flex-wrap items-center gap-3 rounded-lg p-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <label className="flex items-center gap-2 text-sm">
              <span style={{ color: "var(--text-muted)" }}>Día</span>
              <select
                value={selectedDate ?? ""}
                onChange={(e) => selectDate(e.target.value)}
                className="rounded-md px-2 py-1 text-sm outline-none"
                style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {visualDate(d, yesterday)}
                  </option>
                ))}
              </select>
            </label>
            {selectedDate && (
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {visualDate(selectedDate, yesterday)}
              </span>
            )}
          </div>
        )}

        {!loading && !error && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile label="Gasto del día" value={currency(totals.gasto)} accent="var(--brand)" />
            <StatTile label="Leads/Meta" value={number(totals.leads_meta)} />
            <StatTile label="Leads/CRM" value={number(totals.leads_crm)} accent="var(--series-2)" />
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <>
              <input
                type="text"
                placeholder="Nombre de la campaña..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createOffice()}
                className="w-full max-w-full flex-1 rounded-lg px-3 py-2 text-sm outline-none sm:max-w-72 sm:flex-none"
                style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <button
                onClick={createOffice}
                disabled={!newName.trim()}
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: "var(--brand)", color: "#ffffff" }}
              >
                + Nueva campaña
              </button>
            </>
          )}
          <button
            onClick={refresh}
            disabled={refreshing || (cacheInfo?.forceRemaining ?? 1) <= 0}
            title={
              (cacheInfo?.forceRemaining ?? 1) <= 0
                ? "Ya usaste las actualizaciones manuales disponibles — espera a que se renueve el caché (cada 30 min)"
                : undefined
            }
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            {refreshing ? "Actualizando..." : "↻ Actualizar"}
          </button>
          {cacheInfo && <CacheStatus cacheInfo={cacheInfo} />}
        </div>

        {loading && <p style={{ color: "var(--text-secondary)" }}>Cargando...</p>}

        {error && (
          <p
            className="mb-4 rounded-lg p-4"
            style={{ background: "rgba(208,59,59,0.12)", color: "var(--critical)", border: "1px solid var(--critical)" }}
          >
            {error}
          </p>
        )}

        {!loading && (
          <div
            className="overflow-hidden rounded-lg"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <div className="overflow-x-auto">
              <table className="text-left text-sm" style={{ tableLayout: "fixed", minWidth: 1200 }}>
                <colgroup>
                  <col style={{ width: 220 }} />
                  <col style={{ width: 170 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 210 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 60 }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--gridline)" }}>
                    {["Campaña", "Oficina (Distribución)", "$ Diario", "Leads/Meta", "Leads/CRM (etiqueta GHL)", "Costo x Resultado", "Gasto del día", ""].map(
                      (h, i) => (
                        <th
                          key={i}
                          className="whitespace-nowrap px-3 py-3 text-xs font-medium uppercase tracking-wide"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {offices.map((o, idx) => (
                    <OfficeRow
                      key={o.id}
                      office={o}
                      idx={idx}
                      distribucionOffices={distribucionOffices}
                      crmConnections={crmConnections}
                      isSuperAdmin={isSuperAdmin}
                      onUpdate={(updates) => updateOffice(o.id, updates)}
                      onDelete={() => deleteOffice(o.id)}
                      onOpenCampaignPicker={() => setCampaignPickerForId(o.id)}
                      onOpenOfficePicker={() => setOfficePickerForId(o.id)}
                      onOpenCrmPicker={() => setCrmPickerForId(o.id)}
                    />
                  ))}
                  {offices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                        No hay campañas en el reporte diario todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {campaignPickerForId && (
        <CampaignPicker
          selected={offices.find((o) => o.id === campaignPickerForId)?.campaigns ?? []}
          onClose={() => setCampaignPickerForId(null)}
          onSave={(campaigns) => {
            updateOffice(campaignPickerForId, { campaigns });
            setCampaignPickerForId(null);
          }}
        />
      )}

      {officePickerForId && (
        <OfficePicker
          options={distribucionOffices}
          selectedId={offices.find((o) => o.id === officePickerForId)?.distribucion_office_id ?? null}
          onClose={() => setOfficePickerForId(null)}
          onSave={(distribucion_office_id) => {
            updateOffice(officePickerForId, { distribucion_office_id });
            setOfficePickerForId(null);
          }}
        />
      )}

      {crmPickerForId && (
        <CrmTagPicker
          connections={crmConnections}
          selectedConnectionId={offices.find((o) => o.id === crmPickerForId)?.crm_connection_id ?? null}
          selectedTag={offices.find((o) => o.id === crmPickerForId)?.ghl_tag ?? null}
          onClose={() => setCrmPickerForId(null)}
          onConnectionCreated={(connection) => setCrmConnections((prev) => [...prev, connection])}
          onConnectionUpdated={(connection) =>
            setCrmConnections((prev) => prev.map((c) => (c.id === connection.id ? connection : c)))
          }
          onSave={(crm_connection_id, ghl_tag) => {
            updateOffice(crmPickerForId, { crm_connection_id, ghl_tag });
            setCrmPickerForId(null);
          }}
        />
      )}
    </div>
  );
}

function OfficeRow({
  office,
  idx,
  distribucionOffices,
  crmConnections,
  isSuperAdmin,
  onUpdate,
  onDelete,
  onOpenCampaignPicker,
  onOpenOfficePicker,
  onOpenCrmPicker,
}: {
  office: ReporteDiarioOfficeComputed;
  idx: number;
  distribucionOffices: DistribucionOffice[];
  crmConnections: CrmConnection[];
  isSuperAdmin: boolean;
  onUpdate: (updates: Record<string, unknown>) => void;
  onDelete: () => void;
  onOpenCampaignPicker: () => void;
  onOpenOfficePicker: () => void;
  onOpenCrmPicker: () => void;
}) {
  const linkedOfficeName = distribucionOffices.find((d) => d.id === office.distribucion_office_id)?.name;
  const linkedCrmName = crmConnections.find((c) => c.id === office.crm_connection_id)?.name;
  const cellStyle = { color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" as const };
  const inputStyle = {
    background: "transparent",
    color: "var(--text-primary)",
    border: "1px solid transparent",
    fontVariantNumeric: "tabular-nums" as const,
  };

  return (
    <tr className="group" style={{ borderTop: idx === 0 ? "none" : "1px solid var(--gridline)" }}>
      <td className="px-3 py-2">
        <input
          type="text"
          defaultValue={office.asignacion}
          onBlur={(e) => onUpdate({ asignacion: e.target.value })}
          disabled={!isSuperAdmin}
          className="w-full rounded px-1 py-0.5 text-sm font-medium outline-none disabled:opacity-70"
          style={{ ...inputStyle, color: "var(--text-primary)" }}
        />
        {isSuperAdmin ? (
          <button onClick={onOpenCampaignPicker} className="mt-0.5 block text-xs" style={{ color: "var(--brand)" }}>
            {office.campaigns.length} campaña{office.campaigns.length !== 1 ? "s" : ""} ✎
          </button>
        ) : (
          <span className="mt-0.5 block text-xs" style={{ color: "var(--text-muted)" }}>
            {office.campaigns.length} campaña{office.campaigns.length !== 1 ? "s" : ""}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {isSuperAdmin ? (
          <button
            onClick={onOpenOfficePicker}
            className="block w-full truncate rounded px-1 py-0.5 text-left text-sm outline-none"
            style={{ color: linkedOfficeName ? "var(--text-primary)" : "var(--text-muted)" }}
          >
            {linkedOfficeName ?? "Sin vincular"} ✎
          </button>
        ) : (
          <span className="block truncate text-sm" style={{ color: linkedOfficeName ? "var(--text-primary)" : "var(--text-muted)" }}>
            {linkedOfficeName ?? "Sin vincular"}
          </span>
        )}
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {currency(office.diario)}
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {number(office.leads_meta)}
      </td>
      <td className="px-3 py-2" style={{ ...cellStyle, color: "var(--series-2)" }}>
        {number(office.leads_crm)}
        {isSuperAdmin ? (
          <button
            onClick={onOpenCrmPicker}
            className="mt-0.5 block truncate text-left text-xs"
            style={{ color: office.ghl_tag && linkedCrmName ? "var(--text-muted)" : "var(--brand)" }}
          >
            {linkedCrmName && office.ghl_tag ? `${linkedCrmName}: ${office.ghl_tag}` : "Elegir CRM y etiqueta"} ✎
          </button>
        ) : (
          <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {linkedCrmName && office.ghl_tag ? `${linkedCrmName}: ${office.ghl_tag}` : "Sin vincular"}
          </span>
        )}
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {currency(office.costo_x_resultado)}
      </td>
      <td className="px-3 py-2 font-medium" style={{ ...cellStyle, color: "var(--text-primary)" }}>
        {currency(office.gasto)}
      </td>
      <td className="px-3 py-2 text-right">{isSuperAdmin && <DeleteButton onConfirm={onDelete} />}</td>
    </tr>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  if (confirming) {
    return (
      <button
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
        className="whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium"
        style={{ background: "var(--critical)", color: "#ffffff" }}
      >
        ¿Eliminar?
      </button>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs opacity-0 transition-opacity group-hover:opacity-100"
      style={{ color: "var(--critical)" }}
    >
      ✕
    </button>
  );
}

function CacheStatus({ cacheInfo }: { cacheInfo: { updatedAt: string | null; forceRemaining: number } }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  if (!cacheInfo.updatedAt) {
    return (
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {Math.max(0, cacheInfo.forceRemaining)} actualizaciones manuales disponibles
      </span>
    );
  }

  const secondsAgo = Math.max(0, Math.round((Date.now() - new Date(cacheInfo.updatedAt).getTime()) / 1000));
  const agoLabel = secondsAgo < 60 ? `hace ${secondsAgo}s` : `hace ${Math.round(secondsAgo / 60)} min`;

  return (
    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
      Datos {agoLabel} · {Math.max(0, cacheInfo.forceRemaining)} actualizaciones manuales disponibles
    </span>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: accent ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
    </div>
  );
}
