import { NextRequest } from "next/server";
import { buildCatalogResponse } from "@/lib/symbol-catalog/load-catalog";
import type {
  Affiliation,
  Context,
  Echelon,
} from "@/lib/symbol-catalog/types";

function parseAffiliation(value: string | null): Affiliation | undefined {
  const allowed: Affiliation[] = [
    "pending",
    "unknown",
    "assumed_friend",
    "friend",
    "neutral",
    "suspect",
    "hostile",
  ];
  return allowed.find((a) => a === value) ?? undefined;
}

function parseContext(value: string | null): Context | undefined {
  const allowed: Context[] = ["reality", "exercise", "simulation"];
  return allowed.find((c) => c === value) ?? undefined;
}

function parseEchelon(value: string | null): Echelon | undefined {
  const allowed: Echelon[] = [
    "team",
    "squad",
    "section",
    "platoon",
    "company",
    "battalion",
    "regiment",
    "brigade",
    "division",
    "corps",
    "army",
  ];
  return allowed.find((e) => e === value) ?? undefined;
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const catalog = buildCatalogResponse({
    query: searchParams.get("q") ?? undefined,
    symbolSet: searchParams.get("set") ?? undefined,
    affiliation: parseAffiliation(searchParams.get("affiliation")),
    context: parseContext(searchParams.get("context")),
    echelon: parseEchelon(searchParams.get("echelon")) ?? "",
    standard:
      searchParams.get("standard") === "2525" ? "2525" : "APP6",
  });

  return Response.json(catalog, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
