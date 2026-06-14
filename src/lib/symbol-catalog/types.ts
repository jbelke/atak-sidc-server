export type Affiliation =
  | "pending"
  | "unknown"
  | "assumed_friend"
  | "friend"
  | "neutral"
  | "suspect"
  | "hostile";

export type Context = "reality" | "exercise" | "simulation";

export type Echelon =
  | "team"
  | "squad"
  | "section"
  | "platoon"
  | "company"
  | "battalion"
  | "regiment"
  | "brigade"
  | "division"
  | "corps"
  | "army";

export interface CatalogFilters {
  query?: string;
  symbolSet?: string;
  affiliation?: Affiliation;
  context?: Context;
  echelon?: Echelon | "";
  standard?: "APP6" | "2525";
}

export interface SymbolCatalogEntry {
  id: string;
  symbolSet: string;
  symbolSetName: string;
  mainIcon: string;
  entity: string;
  entityType: string;
  entitySubtype: string;
  remarks: string;
  label: string;
  /** Default friend / reality SIDC for this main icon */
  sidc: string;
}

export interface SymbolCatalogResponse {
  version: 1;
  count: number;
  symbolSets: Array<{ id: string; name: string; count: number }>;
  entries: SymbolCatalogEntry[];
}
