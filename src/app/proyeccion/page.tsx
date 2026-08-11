"use client";

import { useEffect, useState } from "react";
import type { ProyeccionOfficeComputed } from "@/lib/proyeccion";
import { officeTotal, type Agent } from "@/lib/distribucion";
import CampaignPicker from "@/components/CampaignPicker";
import OfficePicker from "@/components/OfficePicker";
import TagPicker from "@/components/TagPicker";

interface Config {
  id: string;
  month_key: string;
  month_label: string;
  days_remaining: number;
  costo_ftd_mes: number;
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

function currency(n: number) {
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function number(n: number) {
  return n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

export default function ProyeccionPage() {
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [offices, setOffices] = useState<ProyeccionOfficeComputed[]>([]);
  const [distribucionOffices, setDistribucionOffices] = useState<DistribucionOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newOfficeName, setNewOfficeName] = useState("");
  const [campaignPickerForId, setCampaignPickerForId] = useState<string | null>(null);
  const [officePickerForId, setOfficePickerForId] = useState<string | null>(null);
  const [tagPickerForId, setTagPickerForId] = useState<string | null>(null);

  function loadConfig(monthKey: string) {
    return fetch(`/api/proyeccion/config/${monthKey}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setConfig(json.data);
        return json;
      });
  }

  function loadOffices(configId: string, silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    fetch(`/api/proyeccion/offices?config_id=${configId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else {
          setOffices(json.data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    if (config) loadOffices(config.id, true);
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

  async function updateOffice(id: string, updates: Record<string, unknown>) {
    await fetch(`/api/proyeccion/offices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (config) loadOffices(config.id, true);
  }

  async function deleteOffice(id: string) {
    if (!window.confirm("¿Eliminar esta oficina de la proyección? Esta acción no se puede deshacer.")) return;
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
              <select
                value={selectedMonthKey ?? ""}
                onChange={(e) => selectMonth(e.target.value)}
                className="rounded-md px-2 py-1 text-sm outline-none"
                style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                {months.map((m) => (
                  <option key={m.month_key} value={m.month_key}>
                    {m.month_label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span style={{ color: "var(--text-muted)" }}>Nombre del mes</span>
              <input
                key={config.id}
                type="text"
                defaultValue={config.month_label}
                onBlur={(e) => saveConfig({ month_label: e.target.value })}
                className="w-36 rounded-md px-2 py-1 text-sm outline-none"
                style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span style={{ color: "var(--series-3)", fontWeight: 600 }}>Días faltantes</span>
              <input
                key={config.id}
                type="number"
                defaultValue={config.days_remaining}
                onBlur={(e) => saveConfig({ days_remaining: Number(e.target.value) || 0 })}
                className="w-20 rounded-md px-2 py-1 text-sm font-semibold outline-none"
                style={{ background: "var(--page)", color: "var(--series-3)", border: "1px solid var(--border)" }}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span style={{ color: "var(--good)", fontWeight: 600 }}>Costo FTD del mes</span>
              <input
                key={config.id}
                type="number"
                defaultValue={config.costo_ftd_mes}
                onBlur={(e) => saveConfig({ costo_ftd_mes: Number(e.target.value) || 0 })}
                className="w-32 rounded-md px-2 py-1 text-sm font-semibold outline-none"
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
          <button
            onClick={refresh}
            disabled={refreshing}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            {refreshing ? "Actualizando..." : "↻ Actualizar"}
          </button>
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
                  <col style={{ width: 130 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 170 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 110 }} />
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
                      "Gasto",
                      "Gasto Total Hoy",
                      "Proyección Cierre",
                      "Gasto Proyección",
                      "Leads/CRM (etiqueta GHL)",
                      "Costo x Lead",
                      "Total Mes",
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
                      onOpenCampaignPicker={() => setCampaignPickerForId(o.id)}
                      onOpenOfficePicker={() => setOfficePickerForId(o.id)}
                      onOpenTagPicker={() => setTagPickerForId(o.id)}
                    />
                  ))}
                  {offices.length === 0 && (
                    <tr>
                      <td colSpan={15} className="px-4 py-6 text-center" style={{ color: "var(--text-muted)" }}>
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

      {tagPickerForId && (
        <TagPicker
          selected={offices.find((o) => o.id === tagPickerForId)?.ghl_tag ?? null}
          onClose={() => setTagPickerForId(null)}
          onSave={(ghl_tag) => {
            updateOffice(tagPickerForId, { ghl_tag });
            setTagPickerForId(null);
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
  onUpdate,
  onDelete,
  onOpenCampaignPicker,
  onOpenOfficePicker,
  onOpenTagPicker,
}: {
  office: ProyeccionOfficeComputed;
  idx: number;
  distribucionOffices: DistribucionOffice[];
  onUpdate: (updates: Record<string, unknown>) => void;
  onDelete: () => void;
  onOpenCampaignPicker: () => void;
  onOpenOfficePicker: () => void;
  onOpenTagPicker: () => void;
}) {
  const linkedOfficeName = distribucionOffices.find((d) => d.id === office.distribucion_office_id)?.name;
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
          className="w-full rounded px-1 py-0.5 text-sm font-medium outline-none"
          style={{ ...inputStyle, color: "var(--text-primary)" }}
        />
        <button onClick={onOpenCampaignPicker} className="mt-0.5 block text-xs" style={{ color: "var(--brand)" }}>
          {office.campaigns.length} campaña{office.campaigns.length !== 1 ? "s" : ""} ✎
        </button>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={onOpenOfficePicker}
          className="block w-full truncate rounded px-1 py-0.5 text-left text-sm outline-none"
          style={{ color: linkedOfficeName ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {linkedOfficeName ?? "Sin vincular"} ✎
        </button>
        <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
          $ Diario: <span style={{ color: "var(--text-primary)" }}>{currency(office.diario)}</span>
        </div>
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {currency(office.gasto)}
      </td>
      <td className="px-3 py-2 font-medium" style={{ ...cellStyle, color: "var(--text-primary)" }}>
        {currency(office.gasto_total_hoy)}
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {currency(office.proyeccion_cierre)}
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {currency(office.gasto_proyeccion)}
      </td>
      <td className="px-3 py-2" style={{ ...cellStyle, color: "var(--series-2)" }}>
        {number(office.leads_crm)}
        <button
          onClick={onOpenTagPicker}
          className="mt-0.5 block truncate text-left text-xs"
          style={{ color: office.ghl_tag ? "var(--text-muted)" : "var(--brand)" }}
        >
          {office.ghl_tag ?? "Elegir etiqueta"} ✎
        </button>
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {currency(office.costo_x_resultado)}
      </td>
      <td className="px-3 py-2 font-medium" style={{ ...cellStyle, color: "var(--text-primary)" }}>
        {currency(office.total_mes)}
      </td>
      <td className="px-3 py-2" style={cellStyle}>
        {number(office.ftd_estimado)}
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          defaultValue={office.ftd_real}
          onBlur={(e) => onUpdate({ ftd_real: Number(e.target.value) || 0 })}
          className="w-full rounded px-1 py-0.5 text-sm font-medium outline-none"
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
      <td className="px-3 py-2 text-right">
        <button onClick={onDelete} className="text-xs opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--critical)" }}>
          ✕
        </button>
      </td>
    </tr>
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
