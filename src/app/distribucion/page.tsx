"use client";

import { useEffect, useMemo, useState } from "react";
import type { Agent, Office } from "@/lib/distribucion";
import { agentValue, officeTotal, JUNIOR_VALUE, EJECUTIVO_DEFAULT_VALUE } from "@/lib/distribucion";

function currency(n: number) {
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

export default function DistribucionPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newOfficeName, setNewOfficeName] = useState("");
  const [creatingOffice, setCreatingOffice] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/offices")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setOffices(json.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function createOffice() {
    const name = newOfficeName.trim();
    if (!name) return;
    setCreatingOffice(true);
    const res = await fetch("/api/offices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    setCreatingOffice(false);
    if (json.error) {
      setError(json.error);
      return;
    }
    setOffices((prev) => [...prev, json.data]);
    setNewOfficeName("");
  }

  async function deleteOffice(id: string) {
    setOffices((prev) => prev.filter((o) => o.id !== id));
    await fetch(`/api/offices/${id}`, { method: "DELETE" });
  }

  async function updateAdmin(id: string, admin_amount: number) {
    setOffices((prev) => prev.map((o) => (o.id === id ? { ...o, admin_amount } : o)));
    await fetch(`/api/offices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_amount }),
    });
  }

  async function addAgent(
    officeId: string,
    payload: { name: string; type: "junior" | "ejecutivo"; custom_value?: number }
  ) {
    const res = await fetch(`/api/offices/${officeId}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setOffices((prev) =>
      prev.map((o) => (o.id === officeId ? { ...o, agents: [...o.agents, json.data] } : o))
    );
  }

  async function deleteAgent(officeId: string, agentId: string) {
    setOffices((prev) =>
      prev.map((o) =>
        o.id === officeId ? { ...o, agents: o.agents.filter((a) => a.id !== agentId) } : o
      )
    );
    await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
  }

  async function updateAgent(
    officeId: string,
    agentId: string,
    payload: { name: string; type: "junior" | "ejecutivo"; custom_value: number | null }
  ) {
    const res = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      return;
    }
    setOffices((prev) =>
      prev.map((o) =>
        o.id === officeId
          ? { ...o, agents: o.agents.map((a) => (a.id === agentId ? json.data : a)) }
          : o
      )
    );
  }

  const summary = useMemo(() => {
    const allAgents = offices.flatMap((o) => o.agents);
    return {
      totalOffices: offices.length,
      totalEjecutivos: allAgents.filter((a) => a.type === "ejecutivo").length,
      totalJunior: allAgents.filter((a) => a.type === "junior").length,
      totalAgentes: allAgents.length,
      totalValue: offices.reduce((sum, o) => sum + officeTotal(o), 0),
    };
  }, [offices]);

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-8 py-4"
        style={{ background: "var(--page)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Distribución
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Oficinas y agentes
        </span>
      </header>

      <main className="mx-auto max-w-[1600px] px-8 py-8">
        {!loading && !error && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="Total de oficinas" value={String(summary.totalOffices)} />
            <StatTile label="Total de ejecutivos" value={String(summary.totalEjecutivos)} accent="var(--brand)" />
            <StatTile label="Total de junior" value={String(summary.totalJunior)} />
            <StatTile label="Total de agentes" value={String(summary.totalAgentes)} />
            <StatTile label="Valor total" value={currency(summary.totalValue)} accent="var(--good)" />
          </div>
        )}

        <div className="mb-8 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Nombre de la nueva oficina..."
            value={newOfficeName}
            onChange={(e) => setNewOfficeName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createOffice()}
            className="w-72 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <button
            onClick={createOffice}
            disabled={creatingOffice || !newOfficeName.trim()}
            className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--brand)", color: "#ffffff" }}
          >
            + Nueva oficina
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {offices.map((office) => (
              <OfficeCard
                key={office.id}
                office={office}
                onDelete={() => deleteOffice(office.id)}
                onUpdateAdmin={(amount) => updateAdmin(office.id, amount)}
                onAddAgent={(payload) => addAgent(office.id, payload)}
                onDeleteAgent={(agentId) => deleteAgent(office.id, agentId)}
                onUpdateAgent={(agentId, payload) => updateAgent(office.id, agentId, payload)}
              />
            ))}
            {offices.length === 0 && (
              <p style={{ color: "var(--text-muted)" }}>No hay oficinas creadas todavía.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function OfficeCard({
  office,
  onDelete,
  onUpdateAdmin,
  onAddAgent,
  onDeleteAgent,
  onUpdateAgent,
}: {
  office: Office;
  onDelete: () => void;
  onUpdateAdmin: (amount: number) => void;
  onAddAgent: (payload: { name: string; type: "junior" | "ejecutivo"; custom_value?: number }) => void;
  onDeleteAgent: (agentId: string) => void;
  onUpdateAgent: (
    agentId: string,
    payload: { name: string; type: "junior" | "ejecutivo"; custom_value: number | null }
  ) => void;
}) {
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"junior" | "ejecutivo">("junior");
  const [customValue, setCustomValue] = useState("");
  const [adminInput, setAdminInput] = useState(String(office.admin_amount));
  function handleDeleteClick() {
    if (window.confirm(`¿Seguro que querés eliminar la oficina "${office.name}"? Esta acción no se puede deshacer.`)) {
      onDelete();
    }
  }

  const total = officeTotal(office);
  const falta = total - office.admin_amount;
  const ejecutivoCount = office.agents.filter((a) => a.type === "ejecutivo").length;
  const juniorCount = office.agents.filter((a) => a.type === "junior").length;

  function submitAgent() {
    if (!name.trim()) return;
    onAddAgent({
      name: name.trim(),
      type,
      custom_value: type === "ejecutivo" && customValue ? Number(customValue) : undefined,
    });
    setName("");
    setType("junior");
    setCustomValue("");
    setAdding(false);
  }

  return (
    <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3" style={{ background: "var(--good)" }}>
        <span className="font-semibold" style={{ color: "#08210a" }}>
          {office.name}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="whitespace-nowrap text-xs font-medium" style={{ color: "#08210a" }}>
            Ejecutivos: {ejecutivoCount}
          </span>
          <span className="whitespace-nowrap text-xs font-medium" style={{ color: "#08210a" }}>
            Junior: {juniorCount}
          </span>
          <span className="whitespace-nowrap text-xs font-medium" style={{ color: "#08210a" }}>
            Total agentes: {office.agents.length}
          </span>
          <button
            onClick={handleDeleteClick}
            className="text-sm"
            style={{ color: "#08210a" }}
            title="Eliminar oficina"
          >
            🗑
          </button>
        </div>
      </div>

      <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 28 }} />
          <col />
          <col style={{ width: 96 }} />
          <col style={{ width: 44 }} />
        </colgroup>
        <tbody>
          {office.agents.map((agent, idx) =>
            editingAgentId === agent.id ? (
              <AgentEditRow
                key={agent.id}
                agent={agent}
                index={idx}
                onCancel={() => setEditingAgentId(null)}
                onSave={(payload) => {
                  onUpdateAgent(agent.id, payload);
                  setEditingAgentId(null);
                }}
              />
            ) : (
              <tr
                key={agent.id}
                className="group"
                style={{
                  background: agent.type === "ejecutivo" ? "rgba(57,135,229,0.18)" : "transparent",
                  borderBottom: "1px solid var(--gridline)",
                }}
              >
                <td className="py-1.5 pl-3 pr-1 text-right" style={{ color: "var(--text-muted)" }}>
                  {idx + 1}
                </td>
                <td className="truncate py-1.5 pr-1" style={{ color: "var(--text-primary)" }}>
                  {agent.name}
                </td>
                <td className="py-1.5 pr-1 text-right" style={{ color: "var(--good)", fontVariantNumeric: "tabular-nums" }}>
                  {currency(agentValue(agent))}
                </td>
                <td className="py-1.5 pr-2 text-right">
                  <span className="inline-flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setEditingAgentId(agent.id)}
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                      title="Editar agente"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => onDeleteAgent(agent.id)}
                      className="text-xs"
                      style={{ color: "var(--critical)" }}
                      title="Eliminar agente"
                    >
                      ✕
                    </button>
                  </span>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>

      <div className="px-4 py-3" style={{ borderTop: "1px solid var(--gridline)" }}>
        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="text-sm font-medium"
            style={{ color: "var(--brand)" }}
          >
            + Agregar agente
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              type="text"
              placeholder="Nombre del agente"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAgent()}
              className="min-w-40 flex-1 rounded-md px-2 py-1.5 text-sm outline-none"
              style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "junior" | "ejecutivo")}
              className="rounded-md px-2 py-1.5 text-sm outline-none"
              style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            >
              <option value="junior">Junior (${JUNIOR_VALUE.toLocaleString("es-CO")})</option>
              <option value="ejecutivo">Ejecutivo (${EJECUTIVO_DEFAULT_VALUE.toLocaleString("es-CO")})</option>
            </select>
            {type === "ejecutivo" && (
              <input
                type="number"
                placeholder="Valor personalizado (opcional)"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAgent()}
                className="w-44 rounded-md px-2 py-1.5 text-sm outline-none"
                style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            )}
            <button
              onClick={submitAgent}
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={{ background: "var(--brand)", color: "#ffffff" }}
            >
              Guardar
            </button>
            <button
              onClick={() => setAdding(false)}
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--gridline)" }}>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            TOTAL
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {currency(total)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Admin
          </span>
          <input
            type="number"
            value={adminInput}
            onChange={(e) => setAdminInput(e.target.value)}
            onBlur={() => onUpdateAdmin(Number(adminInput) || 0)}
            className="w-32 rounded-md px-2 py-1 text-right text-sm outline-none"
            style={{
              background: "var(--page)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              fontVariantNumeric: "tabular-nums",
            }}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2 pb-3">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Falta
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: falta === 0 ? "var(--text-secondary)" : falta > 0 ? "var(--critical)" : "var(--good)", fontVariantNumeric: "tabular-nums" }}
          >
            {currency(falta)}
          </span>
        </div>
      </div>
    </div>
  );
}

function AgentEditRow({
  agent,
  index,
  onSave,
  onCancel,
}: {
  agent: Agent;
  index: number;
  onSave: (payload: { name: string; type: "junior" | "ejecutivo"; custom_value: number | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(agent.name);
  const [type, setType] = useState<"junior" | "ejecutivo">(agent.type);
  const [customValue, setCustomValue] = useState(agent.custom_value != null ? String(agent.custom_value) : "");

  function save() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      type,
      custom_value: type === "ejecutivo" && customValue ? Number(customValue) : null,
    });
  }

  return (
    <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--gridline)" }}>
      <td className="py-1.5 pl-3 pr-1 text-right" style={{ color: "var(--text-muted)" }}>
        {index + 1}
      </td>
      <td colSpan={3} className="px-1 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="min-w-24 flex-1 rounded px-1.5 py-1 text-sm outline-none"
            style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "junior" | "ejecutivo")}
            className="rounded px-1.5 py-1 text-sm outline-none"
            style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          >
            <option value="junior">Junior</option>
            <option value="ejecutivo">Ejecutivo</option>
          </select>
          {type === "ejecutivo" && (
            <input
              type="number"
              placeholder={String(EJECUTIVO_DEFAULT_VALUE)}
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              className="w-24 rounded px-1.5 py-1 text-sm outline-none"
              style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            />
          )}
          <button onClick={save} className="text-xs font-medium" style={{ color: "var(--brand)" }}>
            Guardar
          </button>
          <button onClick={onCancel} className="text-xs" style={{ color: "var(--text-muted)" }}>
            Cancelar
          </button>
        </div>
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
      <p
        className="mt-1 text-2xl font-semibold"
        style={{ color: accent ?? "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}
