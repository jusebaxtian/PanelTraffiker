// Dibuja el Reporte Imagen directamente en un <canvas> a partir de los
// datos, con el mismo aspecto de la tabla de Excel. No depende de capturar
// la página (eso falla en Safari de iPhone y con la pestaña en segundo
// plano), así que funciona igual en PC y en celular.

export interface ReportImageRow {
  admin: string;
  label: string;
  diario: number;
  resultados_meta: number;
  leads_crm: number;
  inversion: number;
}

export interface ReportImageTotals {
  diario: number;
  meta: number;
  crm: number;
  inv: number;
  cpr: number;
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
const num = (n: number) => Math.round(n).toLocaleString("es-CO");

const COLS: { title: string; width: number; align: "left" | "center" | "right" }[] = [
  { title: "Admin", width: 110, align: "left" },
  { title: "Pautas", width: 390, align: "left" },
  { title: "Diario", width: 120, align: "right" },
  { title: "Resul Meta", width: 100, align: "center" },
  { title: "CRM", width: 80, align: "center" },
  { title: "Costo X Resultado", width: 150, align: "center" },
  { title: "Inversión", width: 130, align: "right" },
];

const FONT = "Calibri, Arial, Helvetica, sans-serif";
const PAD = 16;
const ROW_H = 30;
const TITLE_H = 34;
const CELL_PAD = 8;

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

export function drawReportImage(dateLabel: string, rows: ReportImageRow[], totals: ReportImageTotals, scale = 2): Promise<Blob> {
  const tableW = COLS.reduce((s, c) => s + c.width, 0);
  const tableH = TITLE_H + ROW_H * (rows.length + 2); // encabezado + filas + total
  const canvas = document.createElement("canvas");
  canvas.width = (tableW + PAD * 2) * scale;
  canvas.height = (tableH + PAD * 2) * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Este navegador no puede generar imágenes"));
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tableW + PAD * 2, tableH + PAD * 2);
  ctx.textBaseline = "middle";

  const x0 = PAD;
  let y = PAD;

  // Título con la fecha
  ctx.fillStyle = "#f4b183";
  ctx.fillRect(x0, y, tableW, TITLE_H);
  ctx.strokeStyle = "#7f7f7f";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y, tableW, TITLE_H);
  ctx.fillStyle = "#111827";
  ctx.font = `bold 17px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(dateLabel, x0 + tableW / 2, y + TITLE_H / 2);
  y += TITLE_H;

  const drawRow = (cells: string[], opts: { bg?: string; bold?: boolean; colors?: (string | undefined)[]; align?: ("left" | "center" | "right")[] }) => {
    let x = x0;
    COLS.forEach((col, i) => {
      if (opts.bg) {
        ctx.fillStyle = opts.bg;
        ctx.fillRect(x, y, col.width, ROW_H);
      }
      ctx.strokeStyle = "#7f7f7f";
      ctx.strokeRect(x, y, col.width, ROW_H);
      ctx.font = `${opts.bold ? "bold " : ""}15px ${FONT}`;
      ctx.fillStyle = opts.colors?.[i] ?? "#111827";
      const align = opts.align?.[i] ?? col.align;
      const text = fit(ctx, cells[i] ?? "", col.width - CELL_PAD * 2);
      ctx.textAlign = align;
      const tx = align === "left" ? x + CELL_PAD : align === "right" ? x + col.width - CELL_PAD : x + col.width / 2;
      ctx.fillText(text, tx, y + ROW_H / 2 + 1);
      x += col.width;
    });
    y += ROW_H;
  };

  drawRow(
    COLS.map((c) => c.title),
    { bg: "#d9d9d9", bold: true, align: COLS.map((c) => (c.align === "left" ? "left" : "center")) }
  );

  for (const r of rows) {
    const cpr = r.resultados_meta > 0 ? r.inversion / r.resultados_meta : 0;
    drawRow(
      [r.admin, `☑ ${r.label}`, money(r.diario), num(r.resultados_meta), num(r.leads_crm), cpr > 0 ? money(cpr) : "-", money(r.inversion)],
      {}
    );
  }

  drawRow(
    ["", "", money(totals.diario), num(totals.meta), num(totals.crm), totals.cpr > 0 ? money(totals.cpr) : "-", money(totals.inv)],
    { bold: true }
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))), "image/png")
  );
}
