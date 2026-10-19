// Meta devuelve las regiones sin tildes y con nombres propios en algunos
// casos ("Distrito Especial" = Bogotá, "State of Mexico" = Estado de
// México). Estas utilidades normalizan los nombres para casarlos con los
// polígonos del mapa y para mostrarlos bien escritos.

export function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Nombre normalizado de Meta -> nombre normalizado del polígono.
const REGION_ALIASES: Record<string, string> = {
  "distrito especial": "bogota",
  "state of mexico": "mexico",
  "coahuila de zaragoza": "coahuila",
  "queretaro arteaga": "queretaro",
  "michoacan de ocampo": "michoacan",
};

export function regionKey(country: string, metaRegion: string): string {
  const n = normName(metaRegion);
  return `${country}|${REGION_ALIASES[n] ?? n}`;
}

const REGION_DISPLAY: Record<string, string> = {
  "CO|distrito especial": "Bogotá D.C.",
  "MX|state of mexico": "Estado de México",
  "MX|distrito federal": "Ciudad de México",
  "CO|atlantico": "Atlántico",
  "CO|bolivar": "Bolívar",
  "CO|boyaca": "Boyacá",
  "CO|caqueta": "Caquetá",
  "CO|choco": "Chocó",
  "CO|cordoba": "Córdoba",
  "CO|narino": "Nariño",
  "CO|quindio": "Quindío",
  "CO|guainia": "Guainía",
  "CO|vaupes": "Vaupés",
  "CO|san andres y providencia": "San Andrés y Providencia",
  "MX|nuevo leon": "Nuevo León",
  "MX|queretaro arteaga": "Querétaro",
  "MX|michoacan de ocampo": "Michoacán",
  "MX|yucatan": "Yucatán",
  "MX|san luis potosi": "San Luis Potosí",
  "MX|coahuila de zaragoza": "Coahuila",
};

export function regionLabel(country: string, metaRegion: string): string {
  return REGION_DISPLAY[`${country}|${normName(metaRegion)}`] ?? (metaRegion === "Unknown" ? "Sin ubicación" : metaRegion);
}

// Nombre del país en español a partir del código de 2 letras de Meta.
export function countryLabel(code: string): string {
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// Nombre en inglés tal como viene en world-atlas, para casar el país con
// su polígono.
const COUNTRY_EN_ALIASES: Record<string, string> = {
  US: "United States of America",
  DO: "Dominican Rep.",
  BO: "Bolivia",
  VE: "Venezuela",
  CZ: "Czechia",
  BA: "Bosnia and Herz.",
  CD: "Dem. Rep. Congo",
  GQ: "Eq. Guinea",
};

export function countryEnglishName(code: string): string {
  if (COUNTRY_EN_ALIASES[code]) return COUNTRY_EN_ALIASES[code];
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const GENDER_LABEL: Record<string, string> = {
  male: "Hombres",
  female: "Mujeres",
  unknown: "Sin dato",
};
