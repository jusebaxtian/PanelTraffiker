"use client";

import { useMemo, useState } from "react";

export interface CostPerLeadDatum {
  campaign: string;
  account: string;
  spend: number;
  leads: number;
}

const THRESHOLD = 6000;

function currency(n: number) {
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

export default function CostPerLeadChart({ data }: { data: CostPerLeadDatum[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const rows = useMemo(
    () =>
      data
        .filter((d) => d.leads > 0)
        .map((d) => ({ ...d, cpl: d.spend / d.leads }))
        .sort((a, b) => b.cpl - a.cpl),
    [data]
  );

  if (rows.length === 0) {
    return (
      <div
        className="flex min-h-64 items-center justify-center rounded-lg p-8 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p style={{ color: "var(--text-muted)" }}>
          No hay campañas con leads en la selección actual.
        </p>
      </div>
    );
  }

  // Layout geometry (SVG user units).
  const barWidth = 44;
  const gap = 22;
  const marginLeft = 72;
  const marginRight = 24;
  const marginTop = 28;
  const marginBottom = 104;
  const plotHeight = 320;

  const width = marginLeft + rows.length * (barWidth + gap) + marginRight;
  const height = marginTop + plotHeight + marginBottom;

  const maxCpl = Math.max(...rows.map((r) => r.cpl));
  const yMax = Math.max(maxCpl * 1.12, THRESHOLD * 1.15);

  const yToPx = (v: number) => marginTop + plotHeight * (1 - v / yMax);

  // Y-axis ticks.
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (yMax / tickCount) * i);

  const thresholdY = yToPx(THRESHOLD);

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Costo por lead por campaña
        </h2>
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--good)" }} />
            Dentro del tope
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--critical)" }} />
            Supera el tope
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="20" height="8">
              <line x1="0" y1="4" x2="20" y2="4" stroke="var(--series-3)" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            Tope {currency(THRESHOLD)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          style={{ maxWidth: "none" }}
          role="img"
          aria-label="Gráfico de barras de costo por lead por campaña"
        >
          {/* Gridlines + y labels */}
          {ticks.map((t, i) => {
            const y = yToPx(t);
            return (
              <g key={i}>
                <line
                  x1={marginLeft}
                  y1={y}
                  x2={width - marginRight}
                  y2={y}
                  stroke="var(--gridline)"
                  strokeWidth="1"
                />
                <text
                  x={marginLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--text-muted)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {currency(t)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {rows.map((r, i) => {
            const x = marginLeft + i * (barWidth + gap);
            const barTop = yToPx(r.cpl);
            const barH = marginTop + plotHeight - barTop;
            const over = r.cpl > THRESHOLD;
            const color = over ? "var(--critical)" : "var(--good)";
            const label = r.campaign.length > 16 ? r.campaign.slice(0, 15) + "…" : r.campaign;
            return (
              <g
                key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "default" }}
              >
                <rect
                  x={x}
                  y={barTop}
                  width={barWidth}
                  height={Math.max(barH, 1)}
                  rx="4"
                  fill={color}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
                {/* Value label above bar */}
                <text
                  x={x + barWidth / 2}
                  y={barTop - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={over ? "var(--critical)" : "var(--text-primary)"}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {currency(r.cpl)}
                </text>
                {/* Campaign label (rotated) */}
                <text
                  x={x + barWidth / 2}
                  y={marginTop + plotHeight + 14}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-secondary)"
                  transform={`rotate(-40 ${x + barWidth / 2} ${marginTop + plotHeight + 14})`}
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Threshold line (drawn on top) */}
          <line
            x1={marginLeft}
            y1={thresholdY}
            x2={width - marginRight}
            y2={thresholdY}
            stroke="var(--series-3)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          <text
            x={width - marginRight}
            y={thresholdY - 6}
            textAnchor="end"
            fontSize="11"
            fontWeight="600"
            fill="var(--series-3)"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            Tope {currency(THRESHOLD)}
          </text>
        </svg>
      </div>
    </div>
  );
}
