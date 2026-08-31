"use client";

import { useEffect, useRef, useState } from "react";

export interface DateRange {
  since: string;
  until: string;
}

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];

// Selector de rango de fechas tipo calendario: clic en el día de inicio,
// clic en el día de fin, con el rango resaltado visualmente — en vez de
// dos campos de fecha nativos sueltos.
export default function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => (value ? parseISO(value.since) : new Date()));
  const [draftStart, setDraftStart] = useState<string | null>(value?.since ?? null);
  const [draftEnd, setDraftEnd] = useState<string | null>(value?.until ?? null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setDraftStart(value?.since ?? null);
      setDraftEnd(value?.until ?? null);
      setViewMonth(value ? parseISO(value.since) : new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleDayClick(dateStr: string) {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(dateStr);
      setDraftEnd(null);
    } else if (dateStr < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(dateStr);
    } else {
      setDraftEnd(dateStr);
    }
  }

  function apply() {
    if (draftStart) {
      onChange({ since: draftStart, until: draftEnd ?? draftStart });
      setOpen(false);
    }
  }

  function clear() {
    setDraftStart(null);
    setDraftEnd(null);
    onChange(null);
    setOpen(false);
  }

  const startWeekday = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const totalDays = daysInMonth(viewMonth);
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(toISO(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d)));

  const monthLabel = viewMonth.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  const buttonLabel = value ? `${value.since} → ${value.until}` : "Rango personalizado";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
        style={{
          background: value ? "var(--brand)" : "var(--surface)",
          color: value ? "#ffffff" : "var(--text-secondary)",
          border: `1px solid ${value ? "var(--brand)" : "var(--border)"}`,
        }}
      >
        📅 {buttonLabel}
      </button>

      {open && (
        <div
          className="absolute z-20 mt-2 rounded-lg p-3"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", minWidth: 260 }}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="rounded px-2 py-1 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              ‹
            </button>
            <span className="text-sm font-medium capitalize" style={{ color: "var(--text-primary)" }}>
              {monthLabel}
            </span>
            <button
              onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="rounded px-2 py-1 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c) return <div key={i} />;
              const isEdge = c === draftStart || c === draftEnd;
              const inRange = !!draftStart && !!draftEnd && c > draftStart && c < draftEnd;
              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(c)}
                  className="rounded py-1 text-center text-xs"
                  style={{
                    background: isEdge ? "var(--brand)" : inRange ? "rgba(255,255,255,0.12)" : "transparent",
                    color: isEdge ? "#ffffff" : "var(--text-primary)",
                    fontWeight: isEdge ? 600 : 400,
                  }}
                >
                  {Number(c.slice(-2))}
                </button>
              );
            })}
          </div>

          <div className="mt-2 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            {draftStart ?? "Inicio"} → {draftEnd ?? "Fin"}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <button onClick={clear} className="text-xs" style={{ color: "var(--text-muted)" }}>
              Limpiar
            </button>
            <button
              onClick={apply}
              disabled={!draftStart}
              className="rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              style={{ background: "var(--brand)", color: "#ffffff" }}
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
