import { app6d } from "stanag-app6";
import type {
  CatalogFilters,
  SymbolCatalogEntry,
  SymbolCatalogResponse,
} from "./types";
import { buildSidc } from "./sidc";

interface App6MainIconRow {
  Entity?: string;
  "Entity Type"?: string;
  "Entity Subtype"?: string;
  Code?: string;
  Remarks?: string;
}

function composeLabel(row: App6MainIconRow): string {
  const parts = [row.Entity, row["Entity Type"], row["Entity Subtype"]]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return parts.join(" · ") || row.Code || "Symbol";
}

let cachedCatalog: SymbolCatalogEntry[] | null = null;

export function loadSymbolCatalog(): SymbolCatalogEntry[] {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const entries: SymbolCatalogEntry[] = [];

  for (const symbolSet of Object.keys(app6d)) {
    const set = app6d[symbolSet as keyof typeof app6d] as {
      name?: string;
      mainIcon?: Record<string, App6MainIconRow>;
    };

    if (!set?.mainIcon) {
      continue;
    }

    const symbolSetName = set.name ?? symbolSet;

    for (const row of Object.values(set.mainIcon)) {
      const code = (row.Code ?? "").trim();
      if (!code || code.length < 4) {
        continue;
      }

      const mainIcon = code.padStart(6, "0").slice(-6);
      const id = `${symbolSet}-${mainIcon}`;

      entries.push({
        id,
        symbolSet,
        symbolSetName,
        mainIcon,
        entity: (row.Entity ?? "").trim(),
        entityType: (row["Entity Type"] ?? "").trim(),
        entitySubtype: (row["Entity Subtype"] ?? "").trim(),
        remarks: (row.Remarks ?? "").trim(),
        label: composeLabel(row),
        sidc: buildSidc({
          affiliation: "friend",
          context: "reality",
          symbolSet,
          mainIcon,
        }),
      });
    }
  }

  entries.sort((a, b) =>
    a.symbolSetName.localeCompare(b.symbolSetName) ||
    a.label.localeCompare(b.label)
  );

  cachedCatalog = entries;
  return entries;
}

export function filterCatalog(
  entries: SymbolCatalogEntry[],
  filters: CatalogFilters
): SymbolCatalogEntry[] {
  const query = filters.query?.trim().toLowerCase() ?? "";

  return entries.filter((entry) => {
    if (filters.symbolSet && entry.symbolSet !== filters.symbolSet) {
      return false;
    }

    if (query) {
      const haystack = [
        entry.label,
        entry.mainIcon,
        entry.entity,
        entry.entityType,
        entry.entitySubtype,
        entry.remarks,
        entry.symbolSetName,
        entry.sidc,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

export function buildCatalogResponse(
  filters: CatalogFilters = {}
): SymbolCatalogResponse {
  const all = loadSymbolCatalog();
  const filtered = filterCatalog(all, filters);

  const setCounts = new Map<string, { name: string; count: number }>();
  for (const entry of all) {
    const current = setCounts.get(entry.symbolSet);
    if (current) {
      current.count += 1;
    } else {
      setCounts.set(entry.symbolSet, {
        name: entry.symbolSetName,
        count: 1,
      });
    }
  }

  const symbolSets = Array.from(setCounts.entries())
    .map(([id, meta]) => ({ id, name: meta.name, count: meta.count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    version: 1,
    count: filtered.length,
    symbolSets,
    entries: filtered,
  };
}

export function sidcForEntry(
  entry: SymbolCatalogEntry,
  filters: Pick<
    CatalogFilters,
    "affiliation" | "context" | "echelon"
  > = {}
): string {
  return buildSidc({
    affiliation: filters.affiliation ?? "friend",
    context: filters.context ?? "reality",
    symbolSet: entry.symbolSet,
    mainIcon: entry.mainIcon,
    echelon: filters.echelon || undefined,
  });
}
