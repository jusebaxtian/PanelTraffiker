// Las etiquetas vinculadas viven en la misma columna de texto `ghl_tag`: una
// sola etiqueta se guarda como texto plano (igual que antes de permitir varias)
// y dos o más como arreglo JSON. Así no hace falta migrar la base de datos y
// las filas existentes siguen funcionando tal cual.

export function parseGhlTags(stored: string | null | undefined): string[] {
  if (!stored) return [];
  if (stored.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((t) => typeof t === "string")) return parsed;
    } catch {
      // Una etiqueta real que empieza con "[" no es JSON: se trata como texto.
    }
  }
  return [stored];
}

export function serializeGhlTags(tags: string[]): string | null {
  if (tags.length === 0) return null;
  if (tags.length === 1) return tags[0];
  return JSON.stringify(tags);
}

export function formatGhlTags(stored: string | null | undefined): string {
  return parseGhlTags(stored).join(", ");
}
