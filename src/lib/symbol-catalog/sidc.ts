import type { Affiliation, Context, Echelon } from "./types";

const AFFILIATION_CODE: Record<Affiliation, string> = {
  pending: "0",
  unknown: "1",
  assumed_friend: "2",
  friend: "3",
  neutral: "4",
  suspect: "5",
  hostile: "6",
};

const CONTEXT_CODE: Record<Context, string> = {
  reality: "0",
  exercise: "1",
  simulation: "2",
};

const ECHELON_CODE: Record<Echelon, string> = {
  team: "11",
  squad: "12",
  section: "13",
  platoon: "14",
  company: "15",
  battalion: "16",
  regiment: "17",
  brigade: "18",
  division: "21",
  corps: "22",
  army: "23",
};

export interface BuildSidcInput {
  affiliation?: Affiliation;
  context?: Context;
  symbolSet?: string;
  mainIcon?: string;
  echelon?: Echelon;
  status?: "present" | "planned";
  hq?: boolean;
  taskForce?: boolean;
}

function pad(value: string | undefined, len: number, fallback: string): string {
  return (value ?? fallback).padStart(len, "0").slice(-len);
}

/** Build a 20-digit APP-6D / 2525D numeric SIDC. */
export function buildSidc(input: BuildSidcInput = {}): string {
  const version = "10";
  const context = CONTEXT_CODE[input.context ?? "reality"];
  const affiliation = AFFILIATION_CODE[input.affiliation ?? "friend"];
  const symbolSet = pad(input.symbolSet, 2, "10");
  const status = input.status === "planned" ? "1" : "0";
  const hqtfd = String(
    (input.hq ? 2 : 0) + (input.taskForce ? 4 : 0)
  );
  const amplifier = input.echelon ? ECHELON_CODE[input.echelon] : "00";
  const mainIcon = pad(input.mainIcon, 6, "000000");

  return (
    version +
    context +
    affiliation +
    symbolSet +
    status +
    hqtfd +
    amplifier +
    mainIcon +
    "0000"
  );
}

export const AFFILIATION_OPTIONS: Array<{ value: Affiliation; label: string }> = [
  { value: "friend", label: "Friend" },
  { value: "hostile", label: "Hostile" },
  { value: "neutral", label: "Neutral" },
  { value: "unknown", label: "Unknown" },
  { value: "assumed_friend", label: "Assumed Friend" },
  { value: "suspect", label: "Suspect" },
  { value: "pending", label: "Pending" },
];

export const CONTEXT_OPTIONS: Array<{ value: Context; label: string }> = [
  { value: "reality", label: "Reality" },
  { value: "exercise", label: "Exercise" },
  { value: "simulation", label: "Simulation" },
];

export const ECHELON_OPTIONS: Array<{ value: Echelon; label: string }> = [
  { value: "team", label: "Team" },
  { value: "squad", label: "Squad" },
  { value: "section", label: "Section" },
  { value: "platoon", label: "Platoon" },
  { value: "company", label: "Company" },
  { value: "battalion", label: "Battalion" },
  { value: "regiment", label: "Regiment" },
  { value: "brigade", label: "Brigade" },
  { value: "division", label: "Division" },
  { value: "corps", label: "Corps" },
  { value: "army", label: "Army" },
];
