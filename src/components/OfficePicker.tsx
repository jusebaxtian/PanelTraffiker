"use client";

import { useMemo, useState } from "react";

interface OfficeOption {
  id: string;
  name: string;
  total: number;
}

function currency(n: number) {
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export default function OfficePicker({
  options,
  selectedId,
  onSave,
  onClose,
}: {
  options: OfficeOption[];
  selectedId: string | null;
  onSave: (id: string | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(selectedId);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Elegir oficina de Distribución
          </h3>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>
        <input
          type="text"
          placeholder="Buscar oficina..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 rounded-md px-3 py-2 text-sm outline-none"
          style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />
        <div className="flex-1 overflow-y-auto">
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            <input type="radio" name="office" checked={picked === null} onChange={() => setPicked(null)} />
            <span style={{ color: "var(--text-muted)" }}>Sin vincular</span>
          </label>
          {filtered.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <input type="radio" name="office" checked={picked === o.id} onChange={() => setPicked(o.id)} />
              <span className="truncate" style={{ color: "var(--text-primary)" }}>
                {o.name}
              </span>
              <span className="ml-auto shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                {currency(o.total)}
              </span>
            </label>
          ))}
          {filtered.length === 0 && <p style={{ color: "var(--text-muted)" }}>Sin resultados.</p>}
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
