"use client";

import { useEffect, useState } from "react";
import type { Office } from "@/lib/distribucion";
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

      <main className="mx-auto max-w-7xl px-8 py-8">
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {offices.map((office) => (
              <OfficeCard
                key={office.id}
                office={office}
                onDelete={() => deleteOffice(office.id)}
                onUpdateAdmin={(amount) => updateAdmin(office.id, amount)}
                onAddAgent={(payload) => addAgent(office.id, payload)}
                onDeleteAgent={(agentId) => deleteAgent(office.id, agentId)}
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
}: {
  office: Office;
  onDelete: () => void;
  onUpdateAdmin: (amount: number) => void;
  onAddAgent: (payload: { name: string; type: "junior" | "ejecutivo"; custom_value?: number }) => void;
  onDeleteAgent: (agentId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"junior" | "ejecutivo">("junior");
  const [customValue, setCustomValue] = useState("");
  const [adminInput, setAdminInput] = useState(String(office.admin_amount));

  const total = officeTotal(office);
  const falta = office.admin_amount - total;

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
      <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--good)" }}>
        <span className="font-semibold" style={{ color: "#08210a" }}>
          {office.name}
        </span>
        <button onClick={onDelete} className="text-xs font-medium" style={{ color: "#08210a" }}>
          Eliminar oficina
        </button>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {office.agents.map((agent, idx) => (
            <tr
              key={agent.id}
              className="group"
              style={{
                background: agent.type === "ejecutivo" ? "rgba(57,135,229,0.18)" : "transparent",
                borderBottom: "1px solid var(--gridline)",
              }}
            >
              <td className="w-8 px-3 py-2 text-right" style={{ color: "var(--text-muted)" }}>
                {idx + 1}
              </td>
              <td className="px-2 py-2" style={{ color: "var(--text-primary)" }}>
                {agent.name}
              </td>
              <td className="px-2 py-2 text-right" style={{ color: "var(--good)", fontVariantNumeric: "tabular-nums" }}>
                {currency(agentValue(agent))}
              </td>
              <td className="w-8 px-2 py-2 text-right">
                <button
                  onClick={() => onDeleteAgent(agent.id)}
                  className="text-xs opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: "var(--critical)" }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
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
            style={{ color: falta === 0 ? "var(--text-secondary)" : falta > 0 ? "var(--good)" : "var(--critical)", fontVariantNumeric: "tabular-nums" }}
          >
            {currency(falta)}
          </span>
        </div>
      </div>
    </div>
  );
}
