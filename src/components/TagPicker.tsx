"use client";

import { useEffect, useMemo, useState } from "react";

export default function TagPicker({
  selected,
  onSave,
  onClose,
}: {
  selected: string | null;
  onSave: (tag: string | null) => void;
  onClose: () => void;
}) {
  const [all, setAll] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(selected);

  useEffect(() => {
    fetch("/api/proyeccion/ghl-tags")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setAll(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter((t) => t.toLowerCase().includes(q));
  }, [all, search]);

  const searchIsNewTag = search.trim() && !all.some((t) => t.toLowerCase() === search.trim().toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Elegir etiqueta de GoHighLevel
          </h3>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>
        <input
          type="text"
          placeholder="Buscar o escribir etiqueta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />
        <div className="flex-1 overflow-y-auto">
          {loading && <p style={{ color: "var(--text-muted)" }}>Cargando etiquetas...</p>}
          {error && <p style={{ color: "var(--critical)" }}>{error}</p>}
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            <input type="radio" name="tag" checked={picked === null} onChange={() => setPicked(null)} />
            <span style={{ color: "var(--text-muted)" }}>Sin etiqueta</span>
          </label>
          {!loading &&
            filtered.map((t) => (
              <label
                key={t}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                <input type="radio" name="tag" checked={picked === t} onChange={() => setPicked(t)} />
                <span className="truncate" style={{ color: "var(--text-primary)" }}>
                  {t}
                </span>
              </label>
            ))}
          {!loading && searchIsNewTag && (
            <label
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <input type="radio" name="tag" checked={picked === search.trim()} onChange={() => setPicked(search.trim())} />
              <span style={{ color: "var(--brand)" }}>Usar &quot;{search.trim()}&quot;</span>
            </label>
          )}
          {!loading && filtered.length === 0 && !searchIsNewTag && (
            <p style={{ color: "var(--text-muted)" }}>Sin resultados.</p>
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
            Cancelar
          </button>
          <button
            onClick={() => onSave(picked)}
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
