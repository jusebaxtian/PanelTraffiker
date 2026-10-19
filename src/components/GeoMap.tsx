"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { countryEnglishName, countryLabel, normName } from "@/lib/geoNames";

export interface ZoneAgg {
  spend: number;
  results: number;
  impressions: number;
}

export type Metric = "spend" | "results" | "cpr";

export interface MapSelection {
  country: string;
  regionKey: string | null;
}

interface Props {
  countryAgg: Record<string, ZoneAgg>;
  regionAgg: Record<string, ZoneAgg>;
  regionNames: Record<string, string>;
  metric: Metric;
  focusCountry: string | null;
  onFocus: (country: string | null) => void;
  selected: MapSelection | null;
  onSelect: (sel: MapSelection | null) => void;
}

// Países con polígonos de departamento/estado disponibles.
export const DRILLABLE = ["CO", "MX"];

const W = 960;
const H = 520;
const MIN_RESULTS_FOR_CPR = 5;
const CPR_IDEAL = 5000;
const CPR_MAX = 6500;

type CountryFeature = Feature<Geometry, { name: string }>;
type RegionFeature = Feature<Geometry, { n: string; c: string }>;

export function cprOf(a: ZoneAgg | undefined): number {
  return a && a.results > 0 ? a.spend / a.results : 0;
}

function fillFor(agg: ZoneAgg | undefined, metric: Metric, max: number): string {
  if (!agg || (agg.spend === 0 && agg.results === 0)) return "var(--surface-raised)";
  if (metric === "cpr") {
    if (agg.results < MIN_RESULTS_FOR_CPR) return "rgba(137,135,129,0.55)";
    const cpr = cprOf(agg);
    if (cpr <= CPR_IDEAL) return "var(--good)";
    if (cpr <= CPR_MAX) return "var(--series-3)";
    return "var(--critical)";
  }
  const value = metric === "spend" ? agg.spend : agg.results;
  const intensity = max > 0 ? Math.sqrt(value / max) : 0;
  return `rgba(57,135,229,${(0.25 + 0.75 * intensity).toFixed(2)})`;
}

export default function GeoMap({
  countryAgg,
  regionAgg,
  regionNames,
  metric,
  focusCountry,
  onFocus,
  selected,
  onSelect,
}: Props) {
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [regions, setRegions] = useState<RegionFeature[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; maxLeft: number; title: string; agg?: ZoneAgg } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/geo/countries-110m.json").then((r) => r.json()),
      fetch("/geo/admin1-co-mx.json").then((r) => r.json()),
    ])
      .then(([topo, admin1]) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
        setCountries(fc.features.filter((f) => f.properties?.name !== "Antarctica") as CountryFeature[]);
        setRegions((admin1 as FeatureCollection<Geometry, { n: string; c: string }>).features as RegionFeature[]);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // alpha-2 de Meta -> polígono del país en el mapa mundial
  const alpha2ByFeature = useMemo(() => {
    const byName = new Map(countries.map((f) => [normName(f.properties.name), f]));
    const out = new Map<CountryFeature, string>();
    for (const code of Object.keys(countryAgg)) {
      const f = byName.get(normName(countryEnglishName(code)));
      if (f) out.set(f, code);
    }
    return out;
  }, [countries, countryAgg]);

  const focusRegions = useMemo(
    () => (focusCountry ? regions.filter((r) => r.properties.c === focusCountry) : []),
    [regions, focusCountry]
  );

  const { paths, maxValue } = useMemo(() => {
    const valueOf = (a: ZoneAgg | undefined) => (a ? (metric === "spend" ? a.spend : a.results) : 0);
    if (focusCountry && focusRegions.length > 0) {
      const collection: FeatureCollection<Geometry> = { type: "FeatureCollection", features: focusRegions };
      const projection = geoMercator().fitExtent(
        [
          [20, 20],
          [W - 20, H - 20],
        ],
        collection
      );
      const gen = geoPath(projection);
      const max = Math.max(0, ...Object.entries(regionAgg).filter(([k]) => k.startsWith(focusCountry + "|")).map(([, a]) => valueOf(a)));
      return {
        maxValue: max,
        paths: focusRegions.map((f) => ({
          key: `${f.properties.c}|${normName(f.properties.n)}`,
          country: f.properties.c,
          label: f.properties.n,
          d: gen(f) ?? "",
          alpha2: f.properties.c,
          isRegion: true,
        })),
      };
    }
    const projection = geoNaturalEarth1().fitExtent(
      [
        [10, 10],
        [W - 10, H - 10],
      ],
      { type: "FeatureCollection", features: countries } as FeatureCollection<Geometry>
    );
    const gen = geoPath(projection);
    const max = Math.max(0, ...Object.values(countryAgg).map(valueOf));
    return {
      maxValue: max,
      paths: countries.map((f) => ({
        key: f.properties.name,
        country: alpha2ByFeature.get(f) ?? "",
        label: f.properties.name,
        d: gen(f) ?? "",
        alpha2: alpha2ByFeature.get(f) ?? "",
        isRegion: false,
      })),
    };
  }, [countries, focusCountry, focusRegions, countryAgg, regionAgg, metric, alpha2ByFeature]);

  function move(e: React.MouseEvent, title: string, agg?: ZoneAgg) {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    setHover({ x: e.clientX - box.left, y: e.clientY - box.top, maxLeft: box.width - 190, title, agg });
  }

  if (loadError) {
    return (
      <p className="p-6 text-sm" style={{ color: "var(--critical)" }}>
        No se pudo cargar el mapa.
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      {focusCountry && (
        <button
          onClick={() => {
            onFocus(null);
            onSelect(null);
          }}
          className="absolute left-3 top-3 z-10 rounded-md px-3 py-1.5 text-xs font-medium"
          style={{ background: "var(--surface-raised)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          ← Mundo
        </button>
      )}
      {countries.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
          Cargando mapa…
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Mapa de rendimiento por zona">
          <rect
            width={W}
            height={H}
            fill="transparent"
            onClick={() => onSelect(null)}
          />
          {paths.map((p) => {
            const agg = p.isRegion ? regionAgg[p.key] : p.alpha2 ? countryAgg[p.alpha2] : undefined;
            const isSel = p.isRegion
              ? selected?.regionKey === p.key
              : !!p.alpha2 && selected?.country === p.alpha2 && !selected.regionKey;
            const clickable = p.isRegion ? true : !!p.alpha2;
            const title = p.isRegion ? (regionNames[p.key] ?? p.label) : p.alpha2 ? countryLabel(p.alpha2) : p.label;
            return (
              <path
                key={p.key}
                d={p.d}
                fill={fillFor(agg, metric, maxValue)}
                stroke={isSel ? "#ffffff" : "var(--page)"}
                strokeWidth={isSel ? 1.6 : 0.5}
                style={{ cursor: clickable ? "pointer" : "default", transition: "fill 120ms" }}
                onMouseMove={(e) => move(e, title, agg)}
                onMouseLeave={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (p.isRegion) {
                    onSelect({ country: p.country, regionKey: p.key });
                  } else if (p.alpha2) {
                    if (DRILLABLE.includes(p.alpha2)) onFocus(p.alpha2);
                    onSelect({ country: p.alpha2, regionKey: null });
                  }
                }}
              />
            );
          })}
        </svg>
      )}
      {hover && (
        <div
          className="pointer-events-none absolute z-20 rounded-md px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.max(0, Math.min(hover.x + 12, hover.maxLeft)),
            top: hover.y + 12,
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            minWidth: 170,
          }}
        >
          <p className="font-semibold">{hover.title}</p>
          {hover.agg && (hover.agg.spend > 0 || hover.agg.results > 0) ? (
            <>
              <p style={{ color: "var(--text-secondary)" }}>Gasto: ${Math.round(hover.agg.spend).toLocaleString("es-CO")}</p>
              <p style={{ color: "var(--text-secondary)" }}>Resultados: {hover.agg.results.toLocaleString("es-CO")}</p>
              <p style={{ color: "var(--text-secondary)" }}>
                Costo/resultado: {hover.agg.results > 0 ? `$${Math.round(cprOf(hover.agg)).toLocaleString("es-CO")}` : "-"}
              </p>
            </>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Sin datos en este período</p>
          )}
        </div>
      )}
    </div>
  );
}
