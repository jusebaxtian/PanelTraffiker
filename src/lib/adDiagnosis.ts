// Motor de diagnóstico del módulo "Mis Anuncios". Sin dependencias de
// servidor para poder usarlo también desde el navegador.
//
// Reglas basadas en prácticas habituales de tráfico pago en Meta:
//  - El costo por resultado se compara contra el ideal y el máximo del
//    negocio ($5.000 / $6.500).
//  - La fatiga se detecta por frecuencia alta (la misma gente ve el
//    anuncio muchas veces) y por señales de deterioro: baja el CTR, sube
//    el CPM o sube el costo por resultado frente al período anterior.
//  - Con pocos datos no se emite juicio: se marca "en prueba".

export const CPR_IDEAL = 5000;
export const CPR_MAX = 6500;
const CPR_REGULAR = 8000;
const MIN_SPEND_FOR_VERDICT = 150000;
const MIN_RESULTS_FOR_VERDICT = 5;

export interface AdPeriodStats {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  results: number;
  linkClicks: number;
  ctr: number; // % de clics en enlace sobre impresiones
  cpm: number;
}

export interface AdDay {
  date: string;
  spend: number;
  impressions: number;
  results: number;
  linkClicks: number;
}

export interface AdLifetime {
  spend: number;
  impressions: number;
  frequency: number;
  results: number;
}

export type Health = "excelente" | "bueno" | "regular" | "malo" | "sin_datos";
export type Trend = "mejorando" | "estable" | "empeorando" | "sin_datos";
export type Fatigue = "ninguna" | "inicial" | "fatigado" | "quemado";
export type Verdict = "escalar" | "mantener" | "vigilar" | "renovar" | "apagar" | "prueba";

export interface Diagnosis {
  health: Health;
  trend: Trend;
  fatigue: Fatigue;
  verdict: Verdict;
  score: number;
  cpr: number;
  cprDeltaPct: number | null;
  ctrDeltaPct: number | null;
  cpmDeltaPct: number | null;
  reasons: string[];
  recommendation: string;
}

export const VERDICT_META: Record<Verdict, { label: string; short: string; color: string; order: number }> = {
  escalar: { label: "Muy bueno · escalar", short: "Escalar", color: "var(--good)", order: 1 },
  mantener: { label: "Bueno · mantener", short: "Mantener", color: "var(--series-2)", order: 2 },
  vigilar: { label: "Vigilar de cerca", short: "Vigilar", color: "var(--series-3)", order: 3 },
  renovar: { label: "Cansado · cambiar creativo", short: "Renovar", color: "var(--series-8)", order: 4 },
  apagar: { label: "Apagar", short: "Apagar", color: "var(--critical)", order: 5 },
  prueba: { label: "En prueba · pocos datos", short: "En prueba", color: "var(--text-muted)", order: 6 },
};

export const FATIGUE_LABEL: Record<Fatigue, string> = {
  ninguna: "Sin fatiga",
  inicial: "Empezando a cansarse",
  fatigado: "Fatigado",
  quemado: "Quemado",
};

export const TREND_LABEL: Record<Trend, string> = {
  mejorando: "Mejorando",
  estable: "Estable",
  empeorando: "Empeorando",
  sin_datos: "Sin tendencia clara",
};

export const HEALTH_LABEL: Record<Health, string> = {
  excelente: "Excelente",
  bueno: "Bueno",
  regular: "Regular",
  malo: "Malo",
  sin_datos: "Sin datos",
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const dec = (n: number, d = 2) => n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
const pctTxt = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}%`;

const cprOf = (spend: number, results: number) => (results > 0 ? spend / results : 0);

// Variación de costo por resultado y de CTR entre la primera y la segunda
// mitad de los días con gasto del período.
function halvesTrend(daily: AdDay[]): { cprDelta: number | null; ctrDelta: number | null; cprFirst: number | null; cprRecent: number | null } {
  const days = daily.filter((d) => d.spend > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 4) return { cprDelta: null, ctrDelta: null, cprFirst: null, cprRecent: null };
  const mid = Math.floor(days.length / 2);
  const a = days.slice(0, mid);
  const b = days.slice(mid);
  const sum = (arr: AdDay[]) =>
    arr.reduce(
      (s, d) => ({ spend: s.spend + d.spend, results: s.results + d.results, imp: s.imp + d.impressions, clicks: s.clicks + d.linkClicks }),
      { spend: 0, results: 0, imp: 0, clicks: 0 }
    );
  const sa = sum(a);
  const sb = sum(b);
  const okCpr = sa.results >= 3 && sb.results >= 3;
  const cprDelta = okCpr ? (sb.spend / sb.results / (sa.spend / sa.results) - 1) * 100 : null;
  const ctrDelta = sa.imp >= 2000 && sb.imp >= 2000 && sa.clicks > 0 ? (sb.clicks / sb.imp / (sa.clicks / sa.imp) - 1) * 100 : null;
  return { cprDelta, ctrDelta, cprFirst: okCpr ? sa.spend / sa.results : null, cprRecent: okCpr ? sb.spend / sb.results : null };
}

export interface DiagnoseInput {
  cur: AdPeriodStats;
  prev: AdPeriodStats | null;
  lifetime: AdLifetime | null;
  daily: AdDay[];
  active: boolean;
}

export function diagnose({ cur, prev, lifetime, daily, active }: DiagnoseInput): Diagnosis {
  const cpr = cprOf(cur.spend, cur.results);
  const reasons: string[] = [];

  // ---- Variaciones frente al período anterior (o entre mitades) ----
  const halves = halvesTrend(daily);
  const recentCpr = halves.cprRecent;
  let cprDelta = halves.cprDelta;
  let ctrDelta = halves.ctrDelta;
  let cpmDelta: number | null = null;
  const prevCpr = prev ? cprOf(prev.spend, prev.results) : 0;
  const prevComparable = !!prev && prev.spend >= 80000 && prev.results >= 5 && prev.impressions >= 3000;
  if (prevComparable && prev) {
    if (cprDelta === null && cpr > 0 && prevCpr > 0) cprDelta = (cpr / prevCpr - 1) * 100;
    if (ctrDelta === null && prev.ctr > 0 && cur.ctr > 0) ctrDelta = (cur.ctr / prev.ctr - 1) * 100;
    if (prev.cpm > 0 && cur.cpm > 0) cpmDelta = (cur.cpm / prev.cpm - 1) * 100;
  }

  // ---- Salud: costo por resultado contra tu ideal y tu máximo ----
  const enoughData = cur.spend >= MIN_SPEND_FOR_VERDICT || cur.results >= MIN_RESULTS_FOR_VERDICT * 2;
  let health: Health;
  if (cur.results === 0) health = cur.spend >= MIN_SPEND_FOR_VERDICT ? "malo" : "sin_datos";
  else if (!enoughData && cur.results < MIN_RESULTS_FOR_VERDICT) health = "sin_datos";
  else if (cpr <= CPR_IDEAL) health = "excelente";
  else if (cpr <= CPR_MAX) health = "bueno";
  else if (cpr <= CPR_REGULAR) health = "regular";
  else health = "malo";

  // ---- Tendencia ----
  let trend: Trend = "sin_datos";
  if (cprDelta !== null) {
    trend = cprDelta <= -12 ? "mejorando" : cprDelta >= 15 ? "empeorando" : "estable";
  } else if (ctrDelta !== null) {
    trend = ctrDelta <= -25 ? "empeorando" : ctrDelta >= 20 ? "mejorando" : "estable";
  }

  // ---- Fatiga ----
  const freq = cur.frequency;
  const lifeFreq = lifetime?.frequency ?? 0;
  const ctrFalling = ctrDelta !== null && ctrDelta <= -20;
  const ctrFallingHard = ctrDelta !== null && ctrDelta <= -25;
  const cprRising = cprDelta !== null && cprDelta >= 15;
  const cprRisingHard = cprDelta !== null && cprDelta >= 30;
  const cpmRising = cpmDelta !== null && cpmDelta >= 10;

  // La frecuencia de toda la vida del anuncio por sí sola no lo "quema": una
  // audiencia chica (p. ej. una ciudad) acumula frecuencia alta aunque el
  // anuncio siga rindiendo. Solo cuenta como fatiga si además se deteriora.
  let fatigue: Fatigue = "ninguna";
  if (freq >= 2.5 || (freq >= 2 && cprRisingHard && ctrFalling) || (lifeFreq >= 3 && cprRisingHard && ctrFalling)) fatigue = "quemado";
  else if (freq >= 2 || (freq >= 1.6 && ctrFallingHard && (cprRising || cpmRising)) || (lifeFreq >= 3 && (cprRising || ctrFalling))) fatigue = "fatigado";
  else if (freq >= 1.7 || (freq >= 1.4 && ctrFalling) || lifeFreq >= 3) fatigue = "inicial";

  // ---- Veredicto ----
  const inTest = health === "sin_datos";
  let verdict: Verdict;
  const good = health === "excelente" || health === "bueno";
  if (inTest) verdict = "prueba";
  else if (health === "malo") verdict = "apagar";
  else if (fatigue === "quemado") verdict = good ? "renovar" : "apagar";
  else if (fatigue === "fatigado") verdict = good ? "renovar" : "apagar";
  else if (health === "regular") verdict = trend === "empeorando" ? "apagar" : "vigilar";
  // Hoy "bueno" en el acumulado, pero en los últimos días ya se fue por encima del máximo.
  else if (trend === "empeorando" && recentCpr !== null && recentCpr > CPR_MAX * 1.15 && cur.spend >= 300000) verdict = "apagar";
  else if (trend === "empeorando" || fatigue === "inicial") verdict = "vigilar";
  else if (health === "excelente" || trend === "mejorando") verdict = "escalar";
  else verdict = "mantener";

  // Un anuncio ya pausado no necesita "apagar": se informa como cansado/malo.
  if (!active && verdict === "apagar") reasons.push("Ya está pausado.");

  // ---- Explicación en lenguaje claro ----
  if (cur.results === 0) {
    reasons.push(
      cur.spend >= MIN_SPEND_FOR_VERDICT
        ? `Gastó ${money(cur.spend)} y no trajo ningún resultado.`
        : `Gastó ${money(cur.spend)} sin resultados todavía: es pronto para juzgarlo.`
    );
  } else {
    const label =
      health === "excelente"
        ? `por debajo de tu ideal (${money(CPR_IDEAL)})`
        : health === "bueno"
          ? `dentro de tu máximo (${money(CPR_MAX)}) pero sobre el ideal (${money(CPR_IDEAL)})`
          : health === "regular"
            ? `por encima de tu máximo (${money(CPR_MAX)})`
            : health === "malo"
              ? `muy por encima de tu máximo (${money(CPR_MAX)})`
              : "con muy pocos datos";
    reasons.push(`Cada resultado te cuesta ${money(cpr)}: ${label}. (${cur.results} resultados con ${money(cur.spend)}).`);
  }

  if (freq > 0) {
    const freqTxt =
      freq >= 2.5
        ? "la misma gente lo está viendo demasiadas veces"
        : freq >= 2
          ? "la gente ya lo vio varias veces y se empieza a cansar"
          : freq >= 1.7
            ? "ya hay repetición, vigila que no suba más"
            : "la gente lo ve pocas veces, todavía hay espacio para crecer";
    reasons.push(`Frecuencia ${dec(freq)}: ${freqTxt}.`);
  }
  if (lifeFreq >= 3) {
    reasons.push(
      `En toda su vida la frecuencia llegó a ${dec(lifeFreq)}: tu audiencia ya lo vio muchas veces${fatigue === "ninguna" || fatigue === "inicial" ? ", aunque por ahora sigue rindiendo. Ve preparando un relevo" : ""}.`
    );
  }

  if (ctrDelta !== null && Math.abs(ctrDelta) >= 15) {
    reasons.push(
      ctrDelta > 0
        ? `Más personas hacen clic: el CTR subió ${pctTxt(ctrDelta)}. El mensaje está conectando.`
        : `Menos personas hacen clic: el CTR cayó ${pctTxt(ctrDelta)}. Señal clásica de cansancio del creativo.`
    );
  }
  if (cpmDelta !== null && Math.abs(cpmDelta) >= 10) {
    reasons.push(
      cpmDelta > 0
        ? `Mostrarlo se encareció ${pctTxt(cpmDelta)} (CPM). Meta lo considera menos atractivo para la audiencia.`
        : `Mostrarlo se abarató ${pctTxt(cpmDelta)} (CPM): Meta lo está premiando.`
    );
  }
  if (cprDelta !== null && Math.abs(cprDelta) >= 12) {
    const detail =
      halves.cprFirst !== null && halves.cprRecent !== null
        ? ` (de ${money(halves.cprFirst)} en la primera mitad del período a ${money(halves.cprRecent)} en la segunda)`
        : "";
    reasons.push(
      cprDelta > 0
        ? `El costo por resultado empeoró ${pctTxt(cprDelta)} dentro del período${detail}.`
        : `El costo por resultado mejoró ${pctTxt(cprDelta)} dentro del período${detail}.`
    );
  }

  // ---- Recomendación ----
  let recommendation: string;
  switch (verdict) {
    case "escalar":
      recommendation =
        "Está funcionando: dale más presupuesto de a poco (máximo +20% cada 48 horas, para no desordenar la entrega). Úsalo de referencia: crea 2 o 3 variantes con el mismo formato y mensaje pero distinto gancho en los primeros segundos o en el titular, para tenerlas listas cuando este se canse.";
      break;
    case "mantener":
      recommendation = `Déjalo corriendo, rinde dentro de lo que necesitas. Revísalo en 3 días: si la frecuencia pasa de 2 o el costo por resultado supera ${money(CPR_MAX)}, prepara un reemplazo.`;
      break;
    case "vigilar":
      recommendation =
        health === "regular"
          ? `Está por encima de tu máximo pero sin empeorar. No le subas presupuesto. Dale 2 o 3 días; si no baja de ${money(CPR_MAX)}, apágalo y pon una variante nueva.`
          : "Sigue rindiendo pero hay señales de desgaste. No le subas presupuesto por ahora. Ve preparando una variante nueva (mismo mensaje, otra imagen o primeros segundos) para cambiarlo antes de que se encarezca.";
      break;
    case "renovar":
      recommendation =
        "Funcionó, pero ya se cansó. No lo apagues de golpe: duplícalo con un creativo nuevo conservando el mensaje que sí vendió (cambia el primer segundo del video o la imagen y el titular). Cuando el nuevo tenga unos 10 resultados, apaga este.";
      break;
    case "apagar":
      recommendation =
        cur.results === 0
          ? `Apágalo: ya gastó ${money(cur.spend)} sin traer resultados. Ese dinero rinde más en tus mejores anuncios.`
          : `Apágalo: cuesta ${money(cpr)} por resultado, sobre tu máximo de ${money(CPR_MAX)}${fatigue === "ninguna" ? "" : " y además está cansado"}. Mueve ese presupuesto a los anuncios que sí funcionan.`;
      break;
    default:
      recommendation = `Todavía hay pocos datos (${money(cur.spend)} y ${cur.results} resultados). No lo toques: espera a que llegue a unos ${money(MIN_SPEND_FOR_VERDICT)} o ${MIN_RESULTS_FOR_VERDICT} a 10 resultados antes de decidir.`;
  }

  // ---- Puntaje para ordenar ranking (0 a 100) ----
  let score = 0;
  if (cur.results > 0) {
    score = Math.max(0, Math.min(100, 100 * (1 - (cpr - 3000) / 9000)));
  }
  if (fatigue === "inicial") score -= 5;
  if (fatigue === "fatigado") score -= 15;
  if (fatigue === "quemado") score -= 30;
  if (trend === "mejorando") score += 5;
  if (trend === "empeorando") score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { health, trend, fatigue, verdict, score, cpr, cprDeltaPct: cprDelta, ctrDeltaPct: ctrDelta, cpmDeltaPct: cpmDelta, reasons, recommendation };
}

// ---------- Patrones entre ganadores y perdedores ----------

export interface PatternAd {
  verdict: Verdict;
  cpr: number;
  results: number;
  spend: number;
  ctr: number;
  cpm: number;
  format: string; // VIDEO | IMAGEN | OTRO
  cta: string | null;
  body: string | null;
  title: string | null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export function winnerPatterns(winners: PatternAd[], losers: PatternAd[]): string[] {
  const out: string[] = [];
  if (winners.length < 2) return out;

  const share = (arr: PatternAd[], fmt: string) => arr.filter((a) => a.format === fmt).length;
  for (const fmt of ["IMAGEN", "VIDEO"]) {
    const w = share(winners, fmt);
    const l = share(losers, fmt);
    if (w >= Math.ceil(winners.length * 0.6)) {
      const name = fmt === "IMAGEN" ? "imágenes o flyers" : "videos";
      out.push(
        `${w} de tus ${winners.length} mejores anuncios son ${name}${losers.length > 0 ? `, y solo ${l} de ${losers.length} de los peores lo son` : ""}. Es el formato que mejor te está funcionando: haz más piezas así.`
      );
    }
  }

  const wCtr = avg(winners.map((a) => a.ctr));
  const lCtr = avg(losers.map((a) => a.ctr));
  if (wCtr > 0 && lCtr > 0 && wCtr >= lCtr * 1.15) {
    out.push(
      `Los mejores anuncios tienen un CTR de ${dec(wCtr)}% frente a ${dec(lCtr)}% de los peores: el mensaje o la imagen llama más la atención. Fíjate en cómo abren (primera frase e imagen) y repite esa idea.`
    );
  }

  const wCpm = avg(winners.map((a) => a.cpm));
  const lCpm = avg(losers.map((a) => a.cpm));
  if (wCpm > 0 && lCpm > 0 && wCpm <= lCpm * 0.85) {
    out.push(`A los mejores anuncios Meta los muestra más barato (CPM ${money(wCpm)} frente a ${money(lCpm)}), señal de que la gente reacciona bien a ellos.`);
  }

  const ctaCount = new Map<string, number>();
  for (const a of winners) if (a.cta) ctaCount.set(a.cta, (ctaCount.get(a.cta) ?? 0) + 1);
  const topCta = [...ctaCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCta && topCta[1] >= Math.ceil(winners.length * 0.6)) {
    out.push(`${topCta[1]} de ${winners.length} ganadores usan el botón "${CTA_LABEL[topCta[0]] ?? topCta[0]}".`);
  }

  const wLen = avg(winners.filter((a) => a.body).map((a) => (a.body ?? "").length));
  const lLen = avg(losers.filter((a) => a.body).map((a) => (a.body ?? "").length));
  if (wLen > 0 && lLen > 0 && Math.abs(wLen - lLen) / Math.max(wLen, lLen) >= 0.3) {
    out.push(
      wLen < lLen
        ? `Los textos de los ganadores son más cortos (unos ${Math.round(wLen)} caracteres frente a ${Math.round(lLen)}). Mensajes directos te funcionan mejor.`
        : `Los textos de los ganadores son más largos (unos ${Math.round(wLen)} caracteres frente a ${Math.round(lLen)}): explicar más te está funcionando.`
    );
  }
  return out;
}

export const CTA_LABEL: Record<string, string> = {
  WHATSAPP_MESSAGE: "Enviar mensaje por WhatsApp",
  MESSAGE_PAGE: "Enviar mensaje",
  LEARN_MORE: "Más información",
  SIGN_UP: "Registrarte",
  CONTACT_US: "Contáctanos",
  SHOP_NOW: "Comprar",
  GET_QUOTE: "Pedir cotización",
  APPLY_NOW: "Aplicar",
  WATCH_MORE: "Ver más",
  SEND_MESSAGE: "Enviar mensaje",
};

export function creativeFormat(
  objectType: string | null | undefined,
  videoId: string | null | undefined,
  imageUrl?: string | null
): string {
  if (videoId || objectType === "VIDEO") return "VIDEO";
  if (imageUrl || objectType === "PHOTO" || objectType === "SHARE" || objectType === "IMAGE") return "IMAGEN";
  return "OTRO";
}
