// Tipos y etiquetas del módulo "Analizar Campaña", sin dependencias de
// servidor para poder usarlos también en la página (cliente).

export interface Metrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  results: number;
}

export interface Segment extends Metrics {
  key: string;
  label: string;
  sub?: string;
}

export type Dimension = "anuncio" | "copy" | "titulo" | "mensaje" | "formato" | "conjunto" | "ubicacion" | "plataforma" | "region" | "pais" | "edad" | "genero" | "edad_genero" | "hora" | "dispositivo";

export const DIMENSION_LABEL: Record<Dimension, string> = {
  anuncio: "Anuncio",
  copy: "Copy",
  titulo: "Titular",
  mensaje: "Mensaje de WhatsApp",
  formato: "Formato",
  conjunto: "Público / conjunto",
  ubicacion: "Ubicación",
  plataforma: "Plataforma",
  region: "Departamento",
  pais: "País",
  edad: "Edad",
  genero: "Género",
  edad_genero: "Edad y género",
  hora: "Hora",
  dispositivo: "Dispositivo",
};

export interface Finding {
  dimension: Dimension;
  label: string;
  sub?: string;
  spend: number;
  results: number;
  cpr: number;
  deltaPct: number; // vs costo promedio de la campaña (negativo = más barato)
  share: number; // % del gasto de la campaña
  text: string;
}

export interface AdRow extends Metrics {
  ad_id: string;
  name: string;
  adset_name: string;
  status: string;
  format: string;
  thumbnail: string | null;
  body: string | null;
  title: string | null;
  message: string | null;
  preview_link: string | null;
  frequency: number;
  quality: string | null;
  engagement: string | null;
  conversion: string | null;
}

export interface AdsetRow extends Metrics {
  adset_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  optimization: string | null;
  destination: string | null;
  audience: { label: string; value: string }[];
}

export interface DayRow extends Metrics {
  date: string;
}

export interface CampaignAnalysis {
  campaign: {
    id: string;
    name: string;
    account_id: string;
    account_name: string;
    status: string;
    objective: string | null;
    daily_budget: number | null;
    lifetime_budget: number | null;
    start_time: string | null;
    bid_strategy: string | null;
  };
  range: { since: string; until: string };
  totals: Metrics & { frequency: number; cpm: number; ctr: number };
  ads: AdRow[];
  adsets: AdsetRow[];
  segments: Record<Dimension, Segment[]>;
  daily: DayRow[];
  works: Finding[];
  fails: Finding[];
  recipe: Finding[];
  notes: string[];
}
