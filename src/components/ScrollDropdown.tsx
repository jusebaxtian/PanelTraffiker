"use client";

import { useEffect, useRef, useState } from "react";

export interface ScrollDropdownOption {
  value: string;
  label: string;
}

// Reemplazo del <select> nativo para listas que crecen sin límite con el
// tiempo (fechas, meses, etc.): mantiene el mismo look, pero el panel de
// opciones tiene una altura fija con scroll interno, en vez de un
// desplegable nativo que se vuelve interminable a medida que se acumulan
// meses/días.
export default function ScrollDropdown({
  options,
  value,
  onChange,
  maxHeight = 260,
}: {
  options: ScrollDropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  maxHeight?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "—";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm outline-none"
        style={{ background: "var(--page)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
      >
        {selectedLabel}
        <span style={{ color: "var(--text-muted)" }}>▾</span>
      </button>

      {open && (
        <div
          ref={listRef}
          className="absolute z-20 mt-1 min-w-full overflow-y-auto rounded-md py-1"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight }}
        >
          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                data-selected={isSelected}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="block w-full whitespace-nowrap px-3 py-1.5 text-left text-sm"
                style={{
                  background: isSelected ? "var(--brand)" : "transparent",
                  color: isSelected ? "#ffffff" : "var(--text-primary)",
                }}
              >
                {o.label}
              </button>
            );
          })}
          {options.length === 0 && (
            <div className="px-3 py-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
              Sin opciones
            </div>
          )}
        </div>
      )}
    </div>
  );
}
