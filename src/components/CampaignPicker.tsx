"use client";

import { useEffect, useMemo, useState } from "react";
import type { CampaignRef } from "@/lib/proyeccion";

interface CampaignOption {
  account_id: string;
  account_name?: string;
  campaign_id: string;
  campaign_name: string;
  status?: string;
}

function statusMeta(status?: string) {
  switch (status) {
    case "ACTIVE":
      return { color: "var(--good)", label: "Activa" };
    case "PAUSED":
      return { color: "var(--text-muted)", label: "Pausada" };
    case "DELETED":
    case "ARCHIVED":
      return { color: "var(--critical)", label: "Archivada" };
    default:
      return { color: "var(--text-muted)", label: status ?? "-" };
  }
}

export default function CampaignPicker({
  selected,
  onSave,
  onClose,
}: {
  selected: CampaignRef[];
  onSave: (campaigns: CampaignRef[]) => void;
  onClose: () => void;
}) {
  const [all, setAll] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set(selected.map((c) => c.campaign_id)));

  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAccountId, setNewAccountId] = useState("");
  const [newToken, setNewToken] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function loadCampaigns() {
    setLoading(true);
    return fetch("/api/proyeccion/campaigns")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setAll(json.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter((c) => (c.campaign_name ?? "").toLowerCase().includes(q));
  }, [all, search]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    const campaigns: CampaignRef[] = all
      .filter((c) => picked.has(c.campaign_id))
      .map((c) => ({ account_id: c.account_id, campaign_id: c.campaign_id, campaign_name: c.campaign_name }));
    onSave(campaigns);
  }

  async function createAccount() {
    if (!newName.trim() || !newAccountId.trim() || !newToken.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/meta-ad-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), account_id: newAccountId.trim(), access_token: newToken.trim() }),
    });
    const json = await res.json();
    setCreating(false);
    if (json.error) {
      setCreateError(json.error);
      return;
    }
    setShowNewAccount(false);
    setNewName("");
    setNewAccountId("");
    setNewToken("");
    loadCampaigns();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Elegir campañas ({picked.size} seleccionadas)
          </h3>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <button
          onClick={() => setShowNewAccount((v) => !v)}
          className="mb-3 block text-left text-xs"
          style={{ color: "var(--brand)" }}
        >
          {showNewAccount ? "Cancelar nueva cuenta" : "+ Agregar cuenta publicitaria"}
        </button>

        {showNewAccount && (
          <div className="mb-3 space-y-2 rounded-md p-2" style={{ background: "var(--page)", border: "1px solid var(--border)" }}>
            <input
              type="text"
              placeholder="Nombre (ej. Cuenta Elite)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-md px-2 py-1.5 text-sm outline-none"
              style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            />
            <input
              type="text"
              placeholder="Account ID (ej. act_123456789 o solo el número)"
              value={newAccountId}
              onChange={(e) => setNewAccountId(e.target.value)}
              className="w-full rounded-md px-2 py-1.5 text-sm outline-none"
              style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            />
            <input
              type="password"
              placeholder="Access Token de Meta"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              className="w-full rounded-md px-2 py-1.5 text-sm outline-none"
              style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            />
            {createError && <p className="text-xs" style={{ color: "var(--critical)" }}>{createError}</p>}
            <button
              onClick={createAccount}
              disabled={creating || !newName.trim() || !newAccountId.trim() || !newToken.trim()}
              className="rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{ background: "var(--brand)", color: "#ffffff" }}
            >
              {creating ? "Guardando..." : "Guardar cuenta"}
            </button>
          </div>
        )}

        <input
          type="text"
          placeholder="Buscar campaña..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />
        <div className="flex-1 overflow-y-auto">
          {loading && <p style={{ color: "var(--text-muted)" }}>Cargando campañas...</p>}
          {!loading &&
            filtered.map((c) => {
              const status = statusMeta(c.status);
              return (
                <label
                  key={c.campaign_id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <input type="checkbox" checked={picked.has(c.campaign_id)} onChange={() => toggle(c.campaign_id)} />
                  <span className="truncate" style={{ color: "var(--text-primary)" }}>
                    {c.campaign_name}
                  </span>
                  <span className="ml-auto shrink-0 text-right text-xs">
                    <span style={{ color: status.color }}>{status.label}</span>
                    <br />
                    <span style={{ color: "var(--text-muted)" }}>{c.account_name ?? c.account_id?.replace("act_", "")}</span>
                  </span>
                </label>
              );
            })}
          {!loading && filtered.length === 0 && <p style={{ color: "var(--text-muted)" }}>Sin resultados.</p>}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
            Cancelar
          </button>
          <button
            onClick={save}
            className="rounded-md px-3 py-2 text-sm font-medium"
            style={{ background: "var(--brand)", color: "#ffffff" }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
