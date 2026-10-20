import { parseGhlTags } from "@/lib/ghlTags";

// Etiquetas de GHL de una campaña u oficina: cada una en su ficha,
// acomodadas en varias líneas dentro del ancho de la columna (en vez de
// cortarse con "…" o estirar la columna cuando hay muchas).
export default function TagChips({ stored, prefix }: { stored: string | null | undefined; prefix?: string }) {
  const tags = parseGhlTags(stored);
  return (
    <span className="block max-w-full">
      {prefix && (
        <span className="mb-0.5 block break-words leading-tight" style={{ overflowWrap: "anywhere" }}>
          {prefix}
        </span>
      )}
      <span className="inline-flex max-w-full flex-wrap gap-1 align-top">
        {tags.map((tag) => (
          <span
            key={tag}
            className="max-w-full break-words rounded px-1.5 py-0.5 leading-tight"
            style={{ background: "rgba(255,255,255,0.06)", overflowWrap: "anywhere", whiteSpace: "normal" }}
          >
            {tag}
          </span>
        ))}
      </span>
    </span>
  );
}
