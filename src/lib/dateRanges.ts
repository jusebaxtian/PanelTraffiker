function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function fmtDateShort(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
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
