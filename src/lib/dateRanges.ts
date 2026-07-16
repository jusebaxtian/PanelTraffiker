function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDateShort(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Shift a date by `delta` calendar months, clamping the day if the target
// month is shorter (e.g. 31/01 - 1 month -> 28/02, not 03/03).
function shiftMonths(d: Date, delta: number): Date {
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  target.setDate(Math.min(day, lastDayOfMonth(target.getFullYear(), target.getMonth())));
  return target;
}

export interface DateRange {
  since: Date;
  until: Date;
  label: string;
}

export function getCurrentRange(
  datePreset: string,
  customRange: { since: string; until: string } | null,
  today: Date
): DateRange {
  if (customRange) {
    const since = new Date(customRange.since + "T00:00:00");
    const until = new Date(customRange.until + "T00:00:00");
    return { since, until, label: `${fmtDateShort(since)} - ${fmtDateShort(until)}` };
  }

  switch (datePreset) {
    case "today":
      return { since: today, until: today, label: "Hoy" };
    case "yesterday": {
      const y = addDays(today, -1);
      return { since: y, until: y, label: "Ayer" };
    }
    case "last_7d":
      return { since: addDays(today, -7), until: addDays(today, -1), label: "Últimos 7 días" };
    case "this_month":
      return { since: new Date(today.getFullYear(), today.getMonth(), 1), until: today, label: "Este mes" };
    case "last_month": {
      const since = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const until = new Date(today.getFullYear(), today.getMonth(), 0);
      return { since, until, label: "Mes anterior" };
    }
    default:
      return { since: today, until: today, label: "Hoy" };
  }
}

// The "comparison" period: for single-day selections (today/yesterday) it's
// simply the day before; for anything wider (7 days, month ranges, custom
// ranges) it's the exact same period shifted back one calendar month.
export function getPreviousRange(
  datePreset: string,
  customRange: { since: string; until: string } | null,
  current: DateRange
): DateRange {
  const isSingleDayPreset = !customRange && (datePreset === "today" || datePreset === "yesterday");

  if (isSingleDayPreset) {
    const since = addDays(current.since, -1);
    const until = addDays(current.until, -1);
    const label = datePreset === "today" ? "Ayer" : "Anteayer";
    return { since, until, label };
  }

  const since = shiftMonths(current.since, -1);
  const until = shiftMonths(current.until, -1);
  return { since, until, label: `${fmtDateShort(since)} - ${fmtDateShort(until)} (mes anterior)` };
}
