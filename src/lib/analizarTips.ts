// Sugerencias del módulo "Analizar Campaña": para cada indicador en
// amarillo o rojo devuelve qué ajustar, en tono de trafficker. Sin
// dependencias de servidor (se usa en la página). Los textos se apoyan en
// lo que dio resultado en las cuentas (análisis de 90 días, nov-2026).

import { CPR_IDEAL, CPR_MAX } from "@/lib/adDiagnosis";
import { AD_BANDS, bandOf, type AdRow, type AdsetRow, type Band, type Segment } from "@/lib/analizarCampanaTypes";

export type TipLevel = "rojo" | "amarillo";

export interface Tip {
  level: TipLevel;
  title: string;
  text: string;
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const pct = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;

export function cprBand(cpr: number, results: number): Band {
  if (results === 0 || cpr === 0) return "sin_dato";
  if (cpr <= CPR_IDEAL) return "verde";
  if (cpr <= CPR_MAX) return "amarillo";
  return "rojo";
}

export function freqBand(f: number): Band {
  if (!f) return "sin_dato";
  if (f > 3) return "rojo";
  if (f > 2) return "amarillo";
  return "verde";
}

/* ================= por anuncio ================= */

export type AdMetricKey = "cpr" | "hook" | "hold" | "ctr" | "conv" | "freq" | "calidad" | "interaccion" | "conversion" | "gasto";

export interface AdRates {
  isVideo: boolean;
  hook: number | null;
  hold: number | null;
  ctr: number | null;
  conv: number | null;
  cpr: number;
}

export function adRates(ad: AdRow): AdRates {
  const isVideo = ad.format === "VIDEO" || ad.video3s > 0;
  return {
    isVideo,
    hook: isVideo && ad.impressions > 0 ? (ad.video3s / ad.impressions) * 100 : null,
    hold: isVideo && ad.video3s > 0 ? (ad.thruplays / ad.video3s) * 100 : null,
    ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : null,
    conv: ad.clicks > 0 ? (ad.results / ad.clicks) * 100 : null,
    cpr: ad.results > 0 ? ad.spend / ad.results : 0,
  };
}

function isLowRank(label: string | null) {
  return !!label && (label.startsWith("Bajo") || label.startsWith("Muy bajo"));
}

const FUNNEL_LABEL = {
  hook: "el gancho (los primeros 3 segundos)",
  hold: "la retención del video",
  ctr: "el CTR (pocos tocan el botón)",
  conv: "el paso a WhatsApp (tocan y no escriben)",
} as const;

// Primer eslabón débil del embudo: gancho → retención → CTR → conversión.
export function weakestStep(r: AdRates): keyof typeof FUNNEL_LABEL | null {
  const steps: [keyof typeof FUNNEL_LABEL, Band][] = [
    ...(r.isVideo
      ? ([
          ["hook", bandOf(r.hook, AD_BANDS.hook)],
          ["hold", bandOf(r.hold, AD_BANDS.hold)],
        ] as [keyof typeof FUNNEL_LABEL, Band][])
      : []),
    ["conv", bandOf(r.conv, AD_BANDS.conv)],
    ["ctr", bandOf(r.ctr, AD_BANDS.ctr)],
  ];
  return steps.find(([, b]) => b === "rojo")?.[0] ?? steps.find(([, b]) => b === "amarillo")?.[0] ?? null;
}

export interface AdTipContext {
  totalSpend: number;
  avgCpr: number;
  best: AdRow | null; // mejor anuncio de la campaña (con datos suficientes)
}

export function adTips(ad: AdRow, ctx: AdTipContext): Partial<Record<AdMetricKey, Tip>> {
  const r = adRates(ad);
  const tips: Partial<Record<AdMetricKey, Tip>> = {};
  const costOk = cprBand(r.cpr, ad.results) === "verde";
  const soft = costOk ? " Su costo por resultado está bien: no lo apagues por esto, úsalo para la próxima versión del creativo." : "";
  const share = ctx.totalSpend > 0 ? (ad.spend / ctx.totalSpend) * 100 : 0;
  const msg = (ad.message ?? "").toLowerCase();

  // ---- costo por resultado
  const cb = cprBand(r.cpr, ad.results);
  const weak = weakestStep(r);
  const bestCpr = ctx.best && ctx.best.results > 0 ? ctx.best.spend / ctx.best.results : 0;
  const bestTxt =
    ctx.best && ctx.best.ad_id !== ad.ad_id && bestCpr > 0 && bestCpr <= CPR_MAX && bestCpr < r.cpr * 0.9
      ? ` Pásale ese presupuesto a "${ctx.best.name}" (${money(bestCpr)}).`
      : " Ningún anuncio de la campaña está bajo tu máximo: sube 2 o 3 creativos nuevos con la fórmula de tus ganadores (evento en vivo, “3 pasos”, rutina del trader).";
  if (ad.results === 0 && ad.spend >= CPR_MAX * 1.5) {
    tips.cpr = {
      level: "rojo",
      title: "Gasta sin resultados",
      text: `Lleva ${money(ad.spend)} sin ninguna conversación. Apágalo.${bestTxt}`,
    };
  } else if (cb === "rojo") {
    const kill = ad.spend >= 150000 && r.cpr > 8000;
    tips.cpr = {
      level: "rojo",
      title: "Costo por resultado alto",
      text:
        `${money(r.cpr)} está sobre tu máximo de ${money(CPR_MAX)}.` +
        (weak ? ` Lo que más lo encarece es ${FUNNEL_LABEL[weak]}: arregla eso primero (mira su sugerencia).` : "") +
        (kill ? ` Con ${money(ad.spend)} gastados y más de $8.000 por resultado, ya es para apagarlo.` : " Si en 2 o 3 días no baja, apágalo.") +
        (share >= 15 ? ` Además se lleva el ${Math.round(share)}% del gasto de la campaña.${bestTxt}` : ""),
    };
  } else if (cb === "amarillo") {
    tips.cpr = {
      level: "amarillo",
      title: "Costo por resultado aceptable",
      text:
        `${money(r.cpr)} está dentro de tu máximo, pero sobre el ideal de ${money(CPR_IDEAL)}.` +
        (weak ? ` Para bajarlo, mejora ${FUNNEL_LABEL[weak]}.` : " Mantenlo y no le subas presupuesto todavía."),
    };
  }

  // ---- hook rate
  const hb = bandOf(r.hook, AD_BANDS.hook);
  if (hb === "rojo" || hb === "amarillo") {
    tips.hook = {
      level: hb,
      title: hb === "rojo" ? "El gancho no frena a nadie" : "Gancho mejorable",
      text:
        (hb === "rojo"
          ? `Solo el ${pct(r.hook!)} se queda 3 segundos (meta: más de ${AD_BANDS.hook.green}%). Cambia SOLO el inicio: `
          : `${pct(r.hook!)} se queda 3 segundos; con más de ${AD_BANDS.hook.green}% el anuncio sale más barato. Prueba otros inicios: `) +
        "arranca con la frase más fuerte (un número o un resultado, ej. “11.000 personas operando en vivo conmigo”), cara a cámara, texto grande en pantalla desde el segundo 0, sin logos ni saludos. Duplica el anuncio con 2 o 3 ganchos distintos y deja el resto del video igual." +
        soft,
    };
  }

  // ---- hold rate
  const hdb = bandOf(r.hold, AD_BANDS.hold);
  if (hdb === "rojo" || hdb === "amarillo") {
    const hookGood = hb === "verde";
    tips.hold = {
      level: hdb,
      title: hdb === "rojo" ? "El video pierde a la gente" : "Retención mejorable",
      text:
        `De los que enganchan, solo el ${pct(r.hold!)} llega a ThruPlay (meta: más de ${AD_BANDS.hold.green}%). ` +
        (hookGood ? "El gancho funciona; el problema está después. " : "") +
        "Corta la introducción, cambia de plano cada 2 o 3 segundos, pon subtítulos, entrega la promesa antes del segundo 8 y deja el llamado a escribir al final. Apunta a videos de 20 a 30 segundos." +
        soft,
    };
  }

  // ---- CTR
  const ctrb = bandOf(r.ctr, AD_BANDS.ctr);
  if (ctrb === "rojo" || ctrb === "amarillo") {
    const convGood = bandOf(r.conv, AD_BANDS.conv) === "verde";
    let text: string;
    if (r.isVideo && hb === "rojo") {
      text = `CTR de ${pct(r.ctr!)}. Primero arregla el gancho: si no lo ven, no tocan el botón.`;
    } else if (!r.isVideo) {
      text = `CTR de ${pct(r.ctr!)}. En el flyer pon la promesa en grande y una instrucción clara (“Toca y te envío el acceso por WhatsApp”). Usa el titular “Regístrate Ahora” o “Dale click aquí”, tus titulares más baratos.`;
    } else {
      text = `CTR de ${pct(r.ctr!)}: lo ven, pero no tocan. Cierra el video con una instrucción exacta (“Toca el botón, se abre WhatsApp y te envío el acceso”), agrega una urgencia real (cupos, fecha del evento) y usa el titular “Regístrate Ahora” o “Dale click aquí”.`;
    }
    if (costOk && convGood) text += " Ojo: el costo y la conversión están bien; no lo cambies solo por el CTR.";
    else text += soft;
    tips.ctr = { level: ctrb, title: ctrb === "rojo" ? "Pocos tocan el botón" : "CTR mejorable", text };
  }

  // ---- tasa de conversión (conversaciones ÷ clics)
  const cvb = bandOf(r.conv, AD_BANDS.conv);
  if (cvb === "rojo" || cvb === "amarillo") {
    const parts: string[] = [];
    if (msg.includes("beca")) parts.push("quita “BECA” del mensaje ya escrito: esos mensajes salieron entre $7.195 y $9.904 y suenan a promoción engañosa. Usa “Hola, Quiero activar mi acceso. ¿Cómo inicio?”");
    else if (!ad.message) parts.push("ponle un mensaje ya escrito, corto y en primera persona: “Hola, Quiero activar mi acceso. ¿Cómo inicio?” (tu mejor mensaje)");
    else parts.push("revisa el mensaje ya escrito: corto, en primera persona y fácil de enviar, como “Hola, Quiero activar mi acceso. ¿Cómo inicio?”");
    parts.push("agrega 3 o 4 preguntas rápidas en el mensaje de bienvenida (“¿Cómo empiezo?”, “¿Es en vivo?”, “¿Cuánto cuesta?”): tocar una ya cuenta como conversación");
    parts.push("que el saludo repita la misma promesa del anuncio");
    if ((r.ctr ?? 0) >= 1.5) parts.push("su CTR es alto, así que hay clics impulsivos o accidentales: quita Audience Network de las ubicaciones");
    parts.push("revisa que el perfil de WhatsApp Business tenga el mismo nombre y foto que el anuncio");
    tips.conv = {
      level: cvb,
      title: cvb === "rojo" ? "Tocan y no escriben" : "Conversión mejorable",
      text: `Solo ${pct(r.conv!)} de los que tocan el botón envían el mensaje (meta: más de ${AD_BANDS.conv.green}%). Ajusta en este orden: ` + parts.map((p, i) => `${i + 1}) ${p}`).join("; ") + "." + soft,
    };
  }

  // ---- frecuencia
  const fb = freqBand(ad.frequency);
  if (fb === "rojo" || fb === "amarillo") {
    tips.freq = {
      level: fb,
      title: fb === "rojo" ? "Público cansado" : "Frecuencia subiendo",
      text:
        `Cada persona lo vio ${ad.frequency.toLocaleString("es-CO", { maximumFractionDigits: 2 })} veces en promedio.` +
        (fb === "rojo"
          ? " Ya se cansaron: sube una versión nueva del creativo (otro gancho u otro ángulo) y amplía el público, por ejemplo con Advantage+ encendido."
          : " Prepara la próxima versión del creativo; cuando pase de 3 empieza a encarecerse."),
    };
  }

  // ---- clasificaciones de Meta
  if (isLowRank(ad.quality)) {
    tips.calidad = {
      level: "rojo",
      title: "Meta lo ve de baja calidad",
      text: `La calidad está en “${ad.quality}” frente a anuncios que compiten por el mismo público. Quita promesas de dinero o resultados, mensajes exagerados y textos tipo “clickbait”. Mejora la imagen, el audio y los subtítulos. Una calidad baja encarece cada impresión.`,
    };
  }
  if (isLowRank(ad.engagement)) {
    tips.interaccion = {
      level: "rojo",
      title: "Poca interacción",
      text: "La gente reacciona menos que con la competencia. Abre con una pregunta o una situación con la que se identifiquen, muestra personas reales (comunidad, sesiones en vivo) y termina invitando a comentar o escribir.",
    };
  }
  if (isLowRank(ad.conversion)) {
    tips.conversion = {
      level: "rojo",
      title: "Pocas conversaciones frente a la competencia",
      text: "Por cada persona que lo ve, escriben menos que con anuncios similares. Haz la oferta más concreta (qué recibe al escribir y en cuántos pasos), agrega urgencia real y revisa el mensaje ya escrito.",
    };
  }

  // ---- peso en el gasto
  if (share >= 40 && cb !== "verde") {
    tips.gasto = {
      level: "amarillo",
      title: "Concentra el gasto",
      text: `Se lleva el ${Math.round(share)}% del gasto sin ser el más barato. Mete 2 o 3 anuncios nuevos al conjunto y deja que Meta reparta; no dependas de un solo creativo.`,
    };
  }

  return tips;
}

/* ================= por segmento (tablas) ================= */

export function segmentLevel(seg: { spend: number; results: number }, totalSpend: number): TipLevel | null {
  const cpr = seg.results > 0 ? seg.spend / seg.results : 0;
  if (seg.results === 0) return seg.spend >= Math.max(totalSpend * 0.03, CPR_MAX * 1.5) ? "rojo" : null;
  if (cpr > CPR_MAX) return "rojo";
  if (cpr > CPR_IDEAL) return "amarillo";
  return null;
}

export function segmentTip(dimension: string, seg: Pick<Segment, "label" | "spend" | "results">, totals: { spend: number; results: number }): Tip | null {
  const level = segmentLevel(seg, totals.spend);
  if (!level) return null;
  const avg = totals.results > 0 ? totals.spend / totals.results : 0;
  const cpr = seg.results > 0 ? seg.spend / seg.results : 0;
  const share = totals.spend > 0 ? (seg.spend / totals.spend) * 100 : 0;
  const label = seg.label;
  const low = label.toLowerCase();

  if (share < 3 && seg.results > 0) {
    return { level: "amarillo", title: "Poco gasto", text: `Solo lleva el ${share.toFixed(1)}% del gasto: todavía no hay datos para decidir. No lo toques.` };
  }
  if (level === "amarillo" && avg > 0 && cpr <= avg) {
    return {
      level,
      title: "Dentro del máximo",
      text: `${money(cpr)} es mejor que el promedio de la campaña (${money(avg)}) y está dentro de tu máximo. Mantenlo; no hace falta tocarlo.`,
    };
  }
  const rel = avg > 0 && cpr > 0 ? cpr / avg : 0;
  const diff = Math.round((rel - 1) * 100);
  const vsAvg = avg > 0 && cpr > 0 ? `, ${Math.abs(diff)}% ${diff >= 0 ? "sobre" : "bajo"} el promedio (${money(avg)})` : "";
  const head = seg.results === 0 ? `Gastó ${money(seg.spend)} sin resultados. ` : `${money(cpr)} por resultado${vsAvg}. `;
  const dup = " Hazlo en un duplicado del conjunto: editar el activo reinicia el aprendizaje.";
  const isIg = low.includes("instagram");
  const segDims = ["ubicacion", "plataforma", "pais", "region", "edad", "genero", "edad_genero", "hora", "dispositivo"];

  // Si el segmento cuesta lo mismo que la campaña, el problema no es el
  // segmento: no se recomienda excluirlo (salvo Instagram, por el CRM).
  if (seg.results > 0 && segDims.includes(dimension) && rel <= 1.1) {
    return {
      level: "amarillo",
      title: "En línea con la campaña",
      text:
        head +
        (isIg
          ? "No está más caro que el resto, pero en Elite casi no llegaba al CRM: compara con GHL antes de darle más presupuesto."
          : "El costo alto no viene de aquí, viene de los anuncios (revisa la pestaña Anuncios). No lo excluyas."),
    };
  }
  if (seg.results > 0 && segDims.includes(dimension) && rel < 1.2 && !isIg) {
    return { level: "amarillo", title: "Algo más caro", text: head + "La diferencia todavía es pequeña: vigílalo 7 días antes de excluirlo." };
  }
  if (seg.results > 0 && (dimension === "ubicacion" || dimension === "plataforma") && share >= 30 && !isIg && !low.includes("audience")) {
    return {
      level,
      title: "Ubicación principal cara",
      text: head + `Aquí se va el ${Math.round(share)}% del gasto: no la quites, porque Meta no tendría dónde gastar. Mejora los anuncios (gancho y retención), que es lo que encarece esta ubicación.`,
    };
  }

  let text: string;
  switch (dimension) {
    case "ubicacion":
    case "plataforma":
      if (low.includes("instagram"))
        text = "Instagram sale más caro en tus cuentas ($7.180 contra $5.944 de Facebook) y casi no llega al CRM (alrededor del 31%). Usa ubicaciones manuales sin Instagram." + dup;
      else if (low.includes("audience"))
        text = "Audience Network trae clics accidentales (CTR inflado, poca gente escribe). Quítala de las ubicaciones." + dup;
      else text = `Usa ubicaciones manuales sin ${label}.` + dup;
      break;
    case "pais":
      text = `Sepáralo en su propio conjunto con presupuesto propio, para que Meta no lo mezcle con el país que rinde mejor, o quítalo si no es un mercado clave.`;
      break;
    case "region":
      text = `Si sigue caro 7 días, exclúyelo en Ubicación → Excluir.` + dup;
      break;
    case "edad":
      text = low.startsWith("18")
        ? "Sube la edad mínima a 25: el rango de 18 a 24 es el más caro en tus cuentas ($6.969)." + dup
        : `Quita ${label} del rango de edad del conjunto si sigue caro 7 días.` + dup;
      break;
    case "genero":
      text = `Si la diferencia se mantiene 7 días, separa un conjunto por género y dale menos presupuesto a ${label}.`;
      break;
    case "edad_genero":
      text = low.includes("18-24")
        ? "El rango de 18 a 24 es el más caro: sube la edad mínima a 25." + dup
        : `Si sigue caro 7 días, separa un conjunto por género y ajusta la edad para dejar fuera a ${label}.`;
      break;
    case "hora":
      text = "Con presupuesto diario Meta no deja elegir horas. Si esta franja sigue cara 7 días y pesa más del 5% del gasto, cambia a presupuesto total con programación y exclúyela. Si no, ignórala: entre horas la diferencia suele ser pequeña.";
      break;
    case "dispositivo":
      text = "Si se mantiene 7 días, duplica el conjunto apuntando solo al sistema operativo que rinde mejor (Android o iOS), en Dispositivos.";
      break;
    case "anuncio":
      text = "Mira en la pestaña Anuncios qué indicador falla (gancho, retención, CTR o conversión) y arregla eso. Si no baja en 2 o 3 días, apágalo y pasa su presupuesto al mejor anuncio.";
      break;
    case "copy":
      text = "Reescríbelo con la fórmula de tus ganadores: prueba social a escala (evento, comunidad en vivo), urgencia real de cupos y pasos concretos (“3 pasos, 15 USD”). Evita “aprende desde cero” y las promesas de ingresos.";
      break;
    case "titulo":
      text = "Cámbialo por “Regístrate Ahora” o “Dale click aquí”, tus titulares más baratos.";
      break;
    case "mensaje":
      text = low.includes("beca")
        ? "Quita “BECA”: esos mensajes salen entre $7.195 y $9.904 y suenan a promoción engañosa. Usa “Hola, Quiero activar mi acceso. ¿Cómo inicio?”."
        : "Usa un mensaje corto y en primera persona: “Hola, Quiero activar mi acceso. ¿Cómo inicio?” (tu mejor mensaje).";
      break;
    case "formato":
      text = "Mezcla formatos: videos verticales 9:16 más 1 o 2 flyers. Meta lo recomienda para la cuenta, y la imagen salió más barata en tus campañas.";
      break;
    case "conjunto":
      text = "Revisa su público en la pestaña Público: Advantage+ encendido, edad desde 25, sin Instagram ni Audience Network, y máximo $500.000 al día por conjunto.";
      break;
    case "dia":
      text = "Revisa qué cambió ese día (una edición, un anuncio nuevo, un cambio de presupuesto). Un día malo aislado no exige cambios: mira la tendencia de 3 días.";
      break;
    default:
      text = "Si sigue caro 7 días, recórtalo o sepáralo en su propio conjunto.";
  }
  return { level, title: seg.results === 0 ? "Sin resultados" : level === "rojo" ? "Caro" : "Sobre el promedio", text: head + text };
}

/* ================= por conjunto (público) ================= */

export function adsetTips(s: AdsetRow): Tip[] {
  const cpr = s.results > 0 ? s.spend / s.results : 0;
  const band = cprBand(cpr, s.results);
  if (band !== "rojo" && band !== "amarillo" && !(s.results === 0 && s.spend > 0)) return [];
  const level: TipLevel = band === "amarillo" ? "amarillo" : "rojo";
  const get = (label: string) => s.audience.find((x) => x.label === label)?.value ?? "";
  const tips: Tip[] = [];
  if (get("Público Advantage+").startsWith("Desactivado"))
    tips.push({ level, title: "Activa Advantage+", text: "En tus cuentas, el público Advantage+ salió en $4.727 contra $6.564 del público manual con intereses. Deja los intereses como sugerencia y activa Advantage+." });
  const edad = get("Edad");
  const min = Number(edad.match(/^(\d+)/)?.[1] ?? 0);
  if (min && min < 25) tips.push({ level, title: "Sube la edad mínima", text: `Empieza en ${min} años. El rango de 18 a 24 es el más caro en tus cuentas ($6.969): prueba desde 25.` });
  const ubic = get("Ubicaciones");
  if (ubic.includes("Instagram")) tips.push({ level, title: "Quita Instagram", text: "Instagram sale más caro y casi no llega al CRM. Deja Facebook (Reels, Historias, Feed) y los Estados de WhatsApp." });
  if (ubic.includes("Audience Network")) tips.push({ level, title: "Quita Audience Network", text: "Trae clics accidentales con un CTR inflado y poca gente escribe." });
  if (ubic.startsWith("Advantage+")) tips.push({ level, title: "Ubicaciones automáticas", text: "Con ubicaciones Advantage+, Meta mete Instagram y Audience Network. Pásate a manuales: Facebook (Reels, Historias, Feed) y Estados de WhatsApp." });
  if ((s.daily_budget ?? 0) >= 1000000)
    tips.push({ level, title: "Presupuesto muy concentrado", text: `Tiene ${money(s.daily_budget!)} al día en un solo conjunto. Los de $1M o más salieron en $7.722 y los de $200k a $500k en $5.232: pártelo en 2 o 3 conjuntos más pequeños.` });
  if (!get("Públicos personalizados"))
    tips.push({ level: "amarillo", title: "Agrega remarketing", text: "Crea un conjunto aparte de $100.000 a $250.000 al día con quienes vieron el 25% de tus videos: en tus cuentas el remarketing dio entre $2.276 y $3.942." });
  if (tips.length === 0)
    tips.push({ level, title: "Público ya bien armado", text: "La segmentación sigue lo que mejor rinde: el costo viene de los anuncios. Revisa la pestaña Anuncios." });
  return tips;
}

/* ================= resumen de la campaña ================= */

export function summaryTips(t: { spend: number; results: number; ctr: number; frequency: number }): Partial<Record<"cpr" | "ctr" | "freq", Tip>> {
  const out: Partial<Record<"cpr" | "ctr" | "freq", Tip>> = {};
  const cpr = t.results > 0 ? t.spend / t.results : 0;
  const b = cprBand(cpr, t.results);
  if (b === "rojo" || b === "amarillo")
    out.cpr = {
      level: b,
      title: b === "rojo" ? "Campaña sobre el máximo" : "Campaña sobre el ideal",
      text: `${money(cpr)} por resultado. Empieza por “❌ Lo que no funcionó” (las ubicaciones y los anuncios pesan más) y en la pestaña Anuncios arregla el indicador en rojo de los que más gastan.`,
    };
  const cb = bandOf(t.ctr, AD_BANDS.ctr);
  if (cb === "rojo" || cb === "amarillo")
    out.ctr = { level: cb, title: "CTR bajo", text: "Revisa en Anuncios cuáles tienen el gancho o el CTR en rojo; ahí está el problema, no en el público." };
  const fb = freqBand(t.frequency);
  if (fb === "rojo" || fb === "amarillo")
    out.freq = { level: fb, title: "Frecuencia alta", text: "El público ya vio mucho los mismos anuncios: sube creativos nuevos y amplía el público (Advantage+ o más países)." };
  return out;
}
