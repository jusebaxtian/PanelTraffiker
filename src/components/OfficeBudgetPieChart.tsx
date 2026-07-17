"use client";

import { useMemo, useState } from "react";

export interface OfficeBudgetDatum {
  office: string;
  total: number;
}

// Fixed categorical order (blue, aqua, yellow, green, violet, red, magenta, orange) —
// never cycled arbitrarily, matches the app's validated dark palette.
const CATEGORY_COLORS = [
  "var(--brand)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-5)",
  "var(--series-4)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

function currency(n: number) {
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export default function OfficeBudgetPieChart({ data }: { data: OfficeBudgetDatum[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const rows = useMemo(
    () => data.filter((d) => d.total > 0).sort((a, b) => b.total - a.total),
    [data]
  );
  const total = rows.reduce((sum, r) => sum + r.total, 0);

  const slices = useMemo(() => {
    if (total === 0) return [];
    let angle = 0;
    return rows.map((r, i) => {
      const pct = r.total / total;
      const sweep = pct * 360;
      const path = arcPath(100, 100, 88, angle, angle + sweep);
      const midAngle = angle + sweep / 2;
      const labelPos = polarToCartesian(100, 100, 56, midAngle);
      angle += sweep;
      return { ...r, pct, path, labelPos, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] };
    });
  }, [rows, total]);

  if (total === 0) {
    return (
      <div
        className="flex min-h-64 flex-1 items-center justify-center rounded-lg p-8 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p style={{ color: "var(--text-muted)" }}>No hay presupuesto de pauta cargado en Distribución.</p>
      </div>
    );
  }

  const leader = slices[0];

  return (
    <div
      className="flex-1 rounded-lg p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Presupuesto de pauta por oficina
        </h2>
        {leader && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Mayor % de pauta:{" "}
            <span style={{ color: leader.color, fontWeight: 600 }}>
              {leader.office} ({Math.round(leader.pct * 100)}%)
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6">
        <svg viewBox="0 0 200 200" width="220" height="220" role="img" aria-label="Presupuesto de pauta por oficina">
          {slices.map((s, i) => (
            <path
              key={s.office}
              d={s.path}
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth="2"
              opacity={hover === null || hover === i ? 1 : 0.55}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "default" }}
            />
          ))}
          {slices.map(
            (s, i) =>
              s.pct >= 0.06 && (
                <g key={s.office} style={{ pointerEvents: "none" }}>
                  <text
                    x={s.labelPos.x}
                    y={s.labelPos.y - 6}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill="#ffffff"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {Math.round(s.pct * 100)}%
                  </text>
                  <text
                    x={s.labelPos.x}
                    y={s.labelPos.y + 9}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="8.5"
                    fill="rgba(255,255,255,0.85)"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {currency(s.total)}
                  </text>
                </g>
              )
          )}
        </svg>

        <div className="flex flex-col gap-2.5">
          {slices.map((s, i) => (
            <div
              key={s.office}
              className="flex items-start gap-2 text-sm"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span
                className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ background: s.color }}
              />
              <div>
                <div style={{ color: "var(--text-secondary)" }}>
                  {s.office}{" "}
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {Math.round(s.pct * 100)}%
                  </span>
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {currency(s.total)}
                </div>
              </div>
            </div>
          ))}
          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Total: {currency(total)}
          </div>
        </div>
      </div>
    </div>
  );
}
