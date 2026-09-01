"use client";

import { useEffect, useState } from "react";
import type { ProyeccionOfficeComputed } from "@/lib/proyeccion";
import { officeTotal, type Agent } from "@/lib/distribucion";
import CampaignPicker from "@/components/CampaignPicker";
import OfficePicker from "@/components/OfficePicker";
import CrmTagPicker from "@/components/CrmTagPicker";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { bogotaNowClient } from "@/lib/bogota";
import ScrollDropdown from "@/components/ScrollDropdown";

interface Config {
  id: string;
  month_key: string;
  month_label: string;
  days_remaining: number;
  costo_ftd_mes: number;
  closed: boolean;
  locked: boolean;
  closed_at: string | null;
}

interface MonthOption {
  id: string;
  month_key: string;
  month_label: string;
}

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

export default function ProyeccionPage() {
  const { isSuperAdmin } = useCurrentUser();
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [offices, setOffices] = useState<ProyeccionOfficeComputed[]>([]);
  const [distribucionOffices, setDistribucionOffices] = useState<DistribucionOffice[]>([]);
  const [crmConnections, setCrmConnections] = useState<CrmConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOfficeName, setNewOfficeName] = useState("");
  const [campaignPickerForId, setCampaignPickerForId] = useState<string | null>(null);
  const [officePickerForId, setOfficePickerForId] = useState<string | null>(null);
  const [crmPickerForId, setCrmPickerForId] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ updatedAt: string; forceRemaining: number; nextWindowAt: string } | null>(null);
  const [closing, setClosing] = useState(false);

  function loadConfig(monthKey: string) {
    return fetch(`/api/proyeccion/config/${monthKey}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setConfig(json.data);
        return json;
      });
  }

  function loadOffices(configId: string, silent = false, force = false, configChange = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const params = new URLSearchParams({ config_id: configId });
    if (force) params.set("force", "1");
    if (configChange) params.set("configChange", "1");
    const url = `/api/proyeccion/offices?${params.toString()}`;
    fetch(url)
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

  async function selectMonth(monthKey: string) {
    setSelectedMonthKey(monthKey);
    setLoading(true);
    const configJson = await loadConfig(monthKey);
    if (configJson?.data?.id) {
      loadOffices(configJson.data.id);
    } else {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/proyeccion/months")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) {
          setMonths(json.data.months);
          selectMonth(json.data.currentMonthKey);
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
    if (config) loadOffices(config.id, true, true);
  }

  async function saveConfig(updates: Partial<Config>) {
    if (!config) return;
    const res = await fetch(`/api/proyeccion/config/${config.month_key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (!json.error) {
      setConfig(json.data);
      setMonths((prev) => prev.map((m) => (m.id === json.data.id ? { ...m, month_label: json.data.month_label } : m)));
      loadOffices(json.data.id, true);
    }
  }

  async function setMonthClosed(action: "close" | "reopen") {
    if (!config) return;
    setClosing(true);
    const res = await fetch(`/api/proyeccion/config/${config.month_key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    setClosing(false);
    if (json.error) {
      setError(json.error);
      return;
    }
    setConfig(json.data);
    loadOffices(json.data.id, true);
  }

  async function createOffice() {
    if (!newOfficeName.trim() || !config) return;
    const res = await fetch("/api/proyeccion/offices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asignacion: newOfficeName.trim(), config_id: config.id }),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setNewOfficeName("");
    loadOffices(config.id, true);
  }

  const CONFIG_CHANGE_FIELDS = ["campaigns", "distribucion_office_id", "ghl_tag", "crm_connection_id"];

  async function updateOffice(id: string, updates: Record<string, unknown>) {
    await fetch(`/api/proyeccion/offices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    // Vincular una campaña, oficina o CRM nuevos debe reflejarse de
    // inmediato; el resto de ediciones (ej. FTDs Real) usan la caché.
    const isConfigChange = Object.keys(updates).some((k) => CONFIG_CHANGE_FIELDS.includes(k));
    if (config) loadOffices(config.id, true, false, isConfigChange);
  }

  async function deleteOffice(id: string) {
    setOffices((prev) => prev.filter((o) => o.id !== id));
    await fetch(`/api/proyeccion/offices/${id}`, { method: "DELETE" });
  }

  const totals = offices.reduce(
    (acc, o) => {
      acc.gasto_total_hoy += o.gasto_total_hoy;
      acc.total_mes += o.total_mes;
      acc.leads_crm += o.leads_crm;
      acc.ftd_real += o.ftd_real;
      acc.ftd_estimado += o.ftd_estimado;
      return acc;
    },
    { gasto_total_hoy: 0, total_mes: 0, leads_crm: 0, ftd_real: 0, ftd_estimado: 0 }
  );

  // El mes en curso solo se puede cerrar el último día (hora de
  // Colombia), para no cerrarlo por error a mitad de mes. Un mes ya
  // pasado (meses anteriores) siempre se puede cerrar.
  const now = bogotaNowClient();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const isCurrentMonth = config?.month_key === currentMonthKey;
  const canCloseMonth = !isCurrentMonth || now.getDate() === lastDayOfMonth;

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Proyección
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Gasto y FTD por oficina
        </span>
      </header>

      <main className="mx-auto max-w-[1700px] px-4 py-6 sm:px-8 sm:py-8">
        {config && (
          <div
            className="mb-6 flex flex-wrap items-center gap-3 rounded-lg p-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <label className="flex items-center gap-2 text-sm">
              <span style={{ color: "var(--text-muted)" }}>Mes</span>
              <ScrollDropdown
                value={selectedMonthKey}
                onChange={selectMonth}
                options={months.map((m) => ({ value: m.month_key, label: m.month_label }))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span style={{ color: "var(--series-3)", fontWeight: 600 }}>Días faltantes</span>
              <input
                key={config.id}
                type="number"
                defaultValue={config.days_remaining}
                onBlur={(e) => saveConfig({ days_remaining: Number(e.target.value) || 0 })}
                className="w-20 rounded-md px-2 py-1 text-sm font-semibold outline-none disabled:opacity-50"
                style={{ background: "var(--page)", color: "var(--series-3)", border: "1px solid var(--border)" }}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span style={{ color: "var(--good)", fontWeight: 600 }}>$ FTD</span>
              <input
                key={config.id}
                type="number"
                defaultValue={config.costo_ftd_mes}
                onBlur={(e) => saveConfig({ costo_ftd_mes: Number(e.target.value) || 0 })}
                className="w-32 rounded-md px-2 py-1 text-sm font-semibold outline-none disabled:opacity-50"
                style={{ background: "var(--page)", color: "var(--good)", border: "1px solid var(--border)" }}
              />
            </label>
          </div>
        )}

        {!loading && !error && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="Gasto total hoy" value={currency(totals.gasto_total_hoy)} accent="var(--brand)" />
            <StatTile label="Total mes proyectado" value={currency(totals.total_mes)} />
            <StatTile label="Leads CRM" value={number(totals.leads_crm)} accent="var(--series-2)" />
            <StatTile label="FTDs reales" value={number(totals.ftd_real)} accent="var(--good)" />
            <StatTile label="FTDs estimados" value={number(totals.ftd_estimado)} />
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {isSuperAdmin && !config?.closed && (
            <>
              <input
                type="text"
                placeholder="Nombre de la nueva oficina..."
                value={newOfficeName}
                onChange={(e) => setNewOfficeName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createOffice()}
                className="w-full max-w-full flex-1 rounded-lg px-3 py-2 text-sm outline-none sm:max-w-72 sm:flex-none"
                style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <button
                onClick={createOffice}
                disabled={!newOfficeName.trim()}
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: "var(--brand)", color: "#ffffff" }}
              >
                + Nueva oficina
              </button>
            </>
          )}
          {!config?.closed && (
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
          )}
          {!config?.closed && cacheInfo && <CacheStatus cacheInfo={cacheInfo} />}

          {isSuperAdmin && config && !config.closed && canCloseMonth && (
            <button
              onClick={() => setMonthClosed("close")}
              disabled={closing}
              title="Congela el gasto, los leads y el $ diario en vivo, y deja los valores listos para ajustar a mano"
              className="ml-auto rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--critical)", color: "#ffffff" }}
            >
              {closing ? "Cerrando..." : "🔒 Cerrar mes"}
            </button>
          )}
          {isSuperAdmin && config && !config.closed && !canCloseMonth && (
            <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
              El cierre se habilita el último día del mes
            </span>
          )}
          {isSuperAdmin && config?.closed && config.locked && (
            <button
              onClick={() => setMonthClosed("reopen")}
              disabled={closing}
              className="ml-auto rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              🔓 Reabrir mes
            </button>
          )}
          {isSuperAdmin && config?.closed && !config.locked && (
            <>
              <span className="ml-auto text-xs" style={{ color: "var(--series-3)" }}>
                Editando cierre — nada en vivo, los cambios se guardan directo
              </span>
              <button
                onClick={() => setMonthClosed("close")}
                disabled={closing}
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: "var(--brand)", color: "#ffffff" }}
              >
                {closing ? "Guardando..." : "🔒 Bloquear cierre"}
              </button>
            </>
          )}
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
          <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
            <div className="overflow-x-auto">
              <table className="text-left text-sm" style={{ tableLayout: "fixed", minWidth: 1850 }}>
                <colgroup>
                  <col style={{ width: 190 }} />
                  <col style={{ width: 170 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 170 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 60 }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--gridline)" }}>
                    {[
                      "Asignación / Campañas",
                      "Oficina (Distribución)",
                      "Gasto Total Hoy",
                      "Proyección Cierre",
                      "Gasto Proyección",
                      "Leads/CRM (etiqueta GHL)",
                      "Costo x Lead",
                      "FTD Estimado",
                      "FTDs Real",
                      "Costo FTD Actual",
                      "FTD Balance",
                      "FTD Meta Mes",
                      "",
                    ].map((h, i) => (
                      <th
                        key={i}
                        className="whitespace-nowrap px-3 py-3 text-xs font-medium uppercase tracking-wide"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {offices.map((o, idx) => (
                    <OfficeRow
                      key={o.id}
                      office={o}
                      idx={idx}
                      distribucionOffices={distribucionOffices}
                      onUpdate={(updates) => updateOffice(o.id, updates)}
                      onDelete={() => deleteOffice(o.id)}
                      crmConnections={crmConnections}
                      isSuperAdmin={isSuperAdmin}
                      closed={config?.closed ?? false}
                      editable={!!config?.closed && !config.locked}
                      onOpenCampaignPicker={() => setCampaignPickerForId(o.id)}
                      onOpenOfficePicker={() => setOfficePickerForId(o.id)}
                      onOpenCrmPicker={() => setCrmPickerForId(o.id)}
                    />
                  ))}
                  {offices.length === 0 && (
                    <tr>
                      <td colSpan={13} className="px-4 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                        No hay oficinas en la proyección todavía.
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
  onUpdate,
  onDelete,
  isSuperAdmin,
  closed,
  editable,
  onOpenCampaignPicker,
  onOpenOfficePicker,
  onOpenCrmPicker,
}: {
  office: ProyeccionOfficeComputed;
  idx: number;
  distribucionOffices: DistribucionOffice[];
  crmConnections: CrmConnection[];
  onUpdate: (updates: Record<string, unknown>) => void;
  onDelete: () => void;
  isSuperAdmin: boolean;
  closed: boolean;
  editable: boolean;
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
        {isSuperAdmin && !closed && (
          <button onClick={onOpenCampaignPicker} className="mt-0.5 block text-xs" style={{ color: "var(--brand)" }}>
            {office.campaigns.length} campaña{office.campaigns.length !== 1 ? "s" : ""} ✎
          </button>
        )}
        {(!isSuperAdmin || closed) && (
          <span className="mt-0.5 block text-xs" style={{ color: "var(--text-muted)" }}>
            {office.campaigns.length} campaña{office.campaigns.length !== 1 ? "s" : ""}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {isSuperAdmin && !closed ? (
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
        <div className="mt-0.5 flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          $ Diario:
          {editable ? (
            <input
              type="number"
              defaultValue={office.diario}
              onBlur={(e) => onUpdate({ diario_final: Number(e.target.value) || 0 })}
              className="w-24 rounded px-1 py-0.5 text-xs outline-none"
              style={{ ...inputStyle, color: "var(--text-primary)" }}
            />
          ) : (
            <span style={{ color: "var(--text-primary)" }}>{currency(office.diario)}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 font-medium" style={{ ...cellStyle, color: "var(--text-primary)" }}>
        {editable ? (
          <input
            type="number"
            defaultValue={office.gasto_total_hoy}
            onBlur={(e) => onUpdate({ gasto_final: Number(e.target.value) || 0 })}
            className="w-full rounded px-1 py-0.5 text-sm font-medium outline-none"
            style={{ ...inputStyle, color: "var(--text-primary)" }}
          />
        ) : (
          currency(office.gasto_total_hoy)
        )}
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {currency(office.proyeccion_cierre)}
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {currency(office.gasto_proyeccion)}
      </td>
      <td className="px-3 py-2" style={{ ...cellStyle, color: "var(--series-2)" }}>
        {editable ? (
          <input
            type="number"
            defaultValue={office.leads_crm}
            onBlur={(e) => onUpdate({ leads_final: Number(e.target.value) || 0 })}
            className="w-full rounded px-1 py-0.5 text-sm outline-none"
            style={{ ...inputStyle, color: "var(--series-2)" }}
          />
        ) : (
          number(office.leads_crm)
        )}
        {isSuperAdmin && !closed ? (
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
      <td className="px-3 py-2" style={cellStyle}>
        {number(office.ftd_estimado)}
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          defaultValue={office.ftd_real}
          onBlur={(e) => onUpdate({ ftd_real: Number(e.target.value) || 0 })}
          disabled={closed && !editable}
          className="w-full rounded px-1 py-0.5 text-sm font-medium outline-none disabled:opacity-70"
          style={{ ...inputStyle, color: "var(--good)" }}
        />
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {currency(office.costo_ftd_actual)}
      </td>
      <td
        className="px-3 py-2 font-medium"
        style={{ ...cellStyle, color: office.ftd_balance < 0 ? "var(--critical)" : "var(--good)" }}
      >
        {office.ftd_balance > 0 ? "+" : ""}
        {number(office.ftd_balance)}
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {number(office.ftd_meta_mes)}
      </td>
      <td className="px-3 py-2 text-right">{isSuperAdmin && !closed && <DeleteButton onConfirm={onDelete} />}</td>
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

function CacheStatus({ cacheInfo }: { cacheInfo: { updatedAt: string; forceRemaining: number } }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

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
