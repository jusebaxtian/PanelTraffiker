"use client";

import { useEffect, useMemo, useState } from "react";

interface CrmConnection {
  id: string;
  name: string;
  location_id: string;
}

export default function CrmTagPicker({
  connections,
  selectedConnectionId,
  selectedTag,
  onSave,
  onClose,
  onConnectionCreated,
  onConnectionUpdated,
}: {
  connections: CrmConnection[];
  selectedConnectionId: string | null;
  selectedTag: string | null;
  onSave: (connectionId: string | null, tag: string | null) => void;
  onClose: () => void;
  onConnectionCreated: (connection: CrmConnection) => void;
  onConnectionUpdated: (connection: CrmConnection) => void;
}) {
  const [connectionId, setConnectionId] = useState<string | null>(selectedConnectionId);
  const [tags, setTags] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pickedTag, setPickedTag] = useState<string | null>(selectedTag);

  const [showNewConnection, setShowNewConnection] = useState(connections.length === 0);
  const [newName, setNewName] = useState("");
  const [newLocationId, setNewLocationId] = useState("");
  const [newToken, setNewToken] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocationId, setEditLocationId] = useState("");
  const [editToken, setEditToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [tagsRefreshKey, setTagsRefreshKey] = useState(0);

  useEffect(() => {
    if (!connectionId) {
      setTags([]);
      return;
    }
    setLoadingTags(true);
    setTagsError(null);
    fetch(`/api/proyeccion/ghl-tags?connection_id=${connectionId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setTagsError(json.error);
        else setTags(json.data);
      })
      .catch((err) => setTagsError(err.message))
      .finally(() => setLoadingTags(false));
  }, [connectionId, tagsRefreshKey]);

  const filteredTags = useMemo(() => {
    if (!search.trim()) return tags;
    const q = search.trim().toLowerCase();
    return tags.filter((t) => t.toLowerCase().includes(q));
  }, [tags, search]);

  const searchIsNewTag = search.trim() && !tags.some((t) => t.toLowerCase() === search.trim().toLowerCase());

  async function createConnection() {
    if (!newName.trim() || !newLocationId.trim() || !newToken.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch("/api/proyeccion/crm-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), location_id: newLocationId.trim(), access_token: newToken.trim() }),
    });
    const json = await res.json();
    setCreating(false);
    if (json.error) {
      setCreateError(json.error);
      return;
    }
    onConnectionCreated(json.data);
    setConnectionId(json.data.id);
    setShowNewConnection(false);
    setNewName("");
    setNewLocationId("");
    setNewToken("");
  }

  function startEdit(c: CrmConnection) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditLocationId(c.location_id);
    setEditToken("");
    setEditError(null);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim() || !editLocationId.trim()) return;
    setSaving(true);
    setEditError(null);
    const body: Record<string, string> = { name: editName.trim(), location_id: editLocationId.trim() };
    if (editToken.trim()) body.access_token = editToken.trim();
    const res = await fetch(`/api/proyeccion/crm-connections/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (json.error) {
      setEditError(json.error);
      return;
    }
    onConnectionUpdated(json.data);
    setEditingId(null);
    if (connectionId === json.data.id) {
      // Cambiar credenciales invalida la lista de etiquetas cacheada.
      setTagsRefreshKey((k) => k + 1);
    }
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
            Vincular CRM y etiqueta
          </h3>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            ¿Cuál CRM / token debe extraer la información?
          </p>
          {connections.map((c) => (
            <div key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                <input
                  type="radio"
                  name="connection"
                  checked={connectionId === c.id}
                  onChange={() => {
                    setConnectionId(c.id);
                    setPickedTag(null);
                  }}
                />
                <span style={{ color: "var(--text-primary)" }}>{c.name}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {c.location_id}
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    editingId === c.id ? setEditingId(null) : startEdit(c);
                  }}
                  className="ml-auto shrink-0 text-xs"
                  style={{ color: "var(--brand)" }}
                >
                  {editingId === c.id ? "cerrar" : "editar ✎"}
                </button>
              </label>

              {editingId === c.id && (
                <div className="mb-1 ml-6 space-y-2 rounded-md p-2" style={{ background: "var(--page)", border: "1px solid var(--border)" }}>
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-md px-2 py-1.5 text-sm outline-none"
                    style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                  <input
                    type="text"
                    placeholder="Location ID"
                    value={editLocationId}
                    onChange={(e) => setEditLocationId(e.target.value)}
                    className="w-full rounded-md px-2 py-1.5 text-sm outline-none"
                    style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                  <input
                    type="password"
                    placeholder="Nuevo token (dejar en blanco para no cambiarlo)"
                    value={editToken}
                    onChange={(e) => setEditToken(e.target.value)}
                    className="w-full rounded-md px-2 py-1.5 text-sm outline-none"
                    style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                  {editError && <p className="text-xs" style={{ color: "var(--critical)" }}>{editError}</p>}
                  <button
                    onClick={saveEdit}
                    disabled={saving || !editName.trim() || !editLocationId.trim()}
                    className="rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    style={{ background: "var(--brand)", color: "#ffffff" }}
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={() => setShowNewConnection((v) => !v)}
            className="mt-1 block text-xs"
            style={{ color: "var(--brand)" }}
          >
            {showNewConnection ? "Cancelar nueva conexión" : "+ Agregar CRM / token nuevo"}
          </button>

          {showNewConnection && (
            <div className="mt-2 space-y-2 rounded-md p-2" style={{ background: "var(--page)", border: "1px solid var(--border)" }}>
              <input
                type="text"
                placeholder="Nombre (ej. GoHighLevel Elite)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-md px-2 py-1.5 text-sm outline-none"
                style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <input
                type="text"
                placeholder="Location ID"
                value={newLocationId}
                onChange={(e) => setNewLocationId(e.target.value)}
                className="w-full rounded-md px-2 py-1.5 text-sm outline-none"
                style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <input
                type="password"
                placeholder="Private Integration Token (pit-...)"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                className="w-full rounded-md px-2 py-1.5 text-sm outline-none"
                style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              {createError && <p className="text-xs" style={{ color: "var(--critical)" }}>{createError}</p>}
              <button
                onClick={createConnection}
                disabled={creating || !newName.trim() || !newLocationId.trim() || !newToken.trim()}
                className="rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                style={{ background: "var(--brand)", color: "#ffffff" }}
              >
                {creating ? "Guardando..." : "Guardar conexión"}
              </button>
            </div>
          )}

          {connectionId && (
            <>
              <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Etiqueta de leads
              </p>
              <input
                type="text"
                placeholder="Buscar o escribir etiqueta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2 w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              {loadingTags && <p style={{ color: "var(--text-muted)" }}>Cargando etiquetas...</p>}
              {tagsError && <p style={{ color: "var(--critical)" }}>{tagsError}</p>}
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                <input type="radio" name="tag" checked={pickedTag === null} onChange={() => setPickedTag(null)} />
                <span style={{ color: "var(--text-muted)" }}>Sin etiqueta</span>
              </label>
              {!loadingTags &&
                filteredTags.map((t) => (
                  <label
                    key={t}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <input type="radio" name="tag" checked={pickedTag === t} onChange={() => setPickedTag(t)} />
                    <span className="truncate" style={{ color: "var(--text-primary)" }}>
                      {t}
                    </span>
                  </label>
                ))}
              {!loadingTags && searchIsNewTag && (
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <input type="radio" name="tag" checked={pickedTag === search.trim()} onChange={() => setPickedTag(search.trim())} />
                  <span style={{ color: "var(--brand)" }}>Usar &quot;{search.trim()}&quot;</span>
                </label>
              )}
            </>
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
            Cancelar
          </button>
          <button
            onClick={() => onSave(connectionId, pickedTag)}
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
