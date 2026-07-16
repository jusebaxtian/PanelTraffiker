"use client";

import { useMemo, useState } from "react";

export interface AgentTypeDatum {
  ejecutivos: number;
  junior: number;
}

const SLICES = [
  { key: "ejecutivos" as const, label: "Ejecutivos", color: "var(--brand)" },
  { key: "junior" as const, label: "Junior", color: "var(--series-2)" },
];

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

export default function AgentTypePieChart({ data }: { data: AgentTypeDatum }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.ejecutivos + data.junior;

  const slices = useMemo(() => {
    if (total === 0) return [];
    let angle = 0;
    return SLICES.map((s) => {
      const value = data[s.key];
      const pct = value / total;
      const sweep = pct * 360;
      const path = arcPath(100, 100, 88, angle, angle + sweep);
      const midAngle = angle + sweep / 2;
      const labelPos = polarToCartesian(100, 100, 56, midAngle);
      angle += sweep;
      return { ...s, value, pct, path, labelPos };
    });
  }, [data, total]);

  if (total === 0) {
    return (
      <div
        className="flex min-h-64 flex-1 items-center justify-center rounded-lg p-8 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p style={{ color: "var(--text-muted)" }}>No hay agentes cargados en Distribución.</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 rounded-lg p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        Ejecutivos vs Junior
      </h2>

      <div className="flex flex-wrap items-center justify-center gap-6">
        <svg viewBox="0 0 200 200" width="220" height="220" role="img" aria-label="Distribución de agentes ejecutivos vs junior">
          {slices.map((s, i) => (
            <path
              key={s.key}
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
          {slices.map((s, i) => (
            <text
              key={s.key}
              x={s.labelPos.x}
              y={s.labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="14"
              fontWeight="700"
              fill="#ffffff"
              style={{ pointerEvents: "none", fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round(s.pct * 100)}%
            </text>
          ))}
        </svg>

        <div className="flex flex-col gap-3">
          {slices.map((s, i) => (
            <div
              key={s.key}
              className="flex items-center gap-2 text-sm"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
              <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
              <span
                className="font-semibold"
                style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
              >
                {s.value} ({Math.round(s.pct * 100)}%)
              </span>
            </div>
          ))}
          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Total: {total} agentes
          </div>
        </div>
      </div>
    </div>
  );
}
