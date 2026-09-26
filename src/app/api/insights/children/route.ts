import { NextRequest, NextResponse } from "next/server";
import {
  getAllAdAccountConnections,
  fetchNodeInsights,
  fetchChildEntities,
  conversationsStarted,
  type AdInsight,
} from "@/lib/metaAds";

// Drill-down del Dashboard: dado el id de una campaña (level=adset) o de
// un conjunto de anuncios (level=ad), trae sus hijos directos con las
// mismas métricas que ya se ven arriba, para el mismo rango de fechas.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parentId = params.get("parent_id");
  const accountId = params.get("account_id");
  const level = params.get("level");
  const since = params.get("since");
  const until = params.get("until");
  const datePreset = params.get("date_preset") ?? "last_30d";

  if (!parentId || !accountId || (level !== "adset" && level !== "ad")) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  try {
    const accounts = await getAllAdAccountConnections();
    const account = accounts.find((a) => a.accountId === accountId);
    if (!account) {
      return NextResponse.json({ error: "Cuenta publicitaria no encontrada" }, { status: 404 });
    }

    const timeRange = since && until ? { since, until } : undefined;
    const [insights, entities] = await Promise.all([
      fetchNodeInsights(parentId, account.accessToken, level, timeRange ? { timeRange } : { datePreset }),
      fetchChildEntities(parentId, account.accessToken, level),
    ]);

    const entityById = new Map(entities.map((e) => [e.id, e]));
    const idKey = level === "adset" ? "adset_id" : "ad_id";
    const nameKey = level === "adset" ? "adset_name" : "ad_name";

    const rowsWithInsights = insights.map((row: AdInsight) => {
      const id = (row[idKey as keyof AdInsight] as string | undefined) ?? "";
      const entity = entityById.get(id);
      return {
        ...row,
        id,
        name: (row[nameKey as keyof AdInsight] as string | undefined) ?? entity?.name ?? "-",
        result: conversationsStarted(row),
        status: entity?.effective_status ?? entity?.status,
        account_id: accountId,
        preview_link: entity?.preview_shareable_link ?? null,
      };
    });

    // Los hijos sin gasto en el rango no traen fila de insights — se
    // agregan igual, en $0, para que no "desaparezcan" de la lista.
    const seenIds = new Set(rowsWithInsights.map((r) => r.id));
    const zeroRows = entities
      .filter((e) => !seenIds.has(e.id))
      .map((e) => ({
        id: e.id,
        name: e.name ?? "-",
        status: e.effective_status ?? e.status,
        result: 0,
        spend: "0",
        account_id: accountId,
        preview_link: e.preview_shareable_link ?? null,
      }));

    return NextResponse.json({ data: [...rowsWithInsights, ...zeroRows] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
