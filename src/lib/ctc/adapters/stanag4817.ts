/**
 * STANAG 4817 JSON to Track. Reads MessageTypeEnum_NODE_STATUS bodies and
 * MessageTypeEnum_DYNAMIC_UPDATE PUT_VALUE operations (contacts, tracks).
 */
import { countryNumericFromAlpha3 } from "../../symbol-catalog/country.ts";
import type { AmpFields } from "../amplifiers.ts";
import type { Track } from "../xsidc.ts";

const MS_TO_KNOTS = 3600 / 1852;

const STANDARD_IDENTITY: Record<string, string> = {
  PENDING: "0",
  UNKNOWN: "1",
  ASSUMED_FRIEND: "2",
  FRIEND: "3",
  NEUTRAL: "4",
  SUSPECT: "5",
  SUSPECT_JOKER: "5",
  HOSTILE: "6",
  HOSTILE_FAKER: "6",
};

const SYMBOL_SET: Record<string, string> = {
  UNKNOWN: "00",
  AIR: "01",
  AIR_MISSILE: "02",
  SPACE: "05",
  SPACE_MISSILE: "06",
  LAND_UNIT: "10",
  LAND_CIVILIAN_UNIT_ORGANIZATION: "11",
  LAND_CIVILIAN: "11",
  LAND_EQUIPMENT: "15",
  LAND_INSTALLATION: "20",
  CONTROL_MEASURE: "25",
  DISMOUNTED_INDIVIDUAL: "27",
  SEA_SURFACE: "30",
  SEA_SUBSURFACE: "35",
  MINE_WARFARE: "36",
  ACTIVITIES: "40",
  ACTIVITY_EVENT: "40",
  SIGNALS_INTELLIGENCE: "50",
  CYBERSPACE: "60",
};

const STATUS: Record<string, string> = {
  PRESENT: "0",
  PLANNED_ANTICIPATED_SUSPECT: "1",
  PLANNED: "1",
  PRESENT_FULLY_CAPABLE: "2",
  FULLY_CAPABLE: "2",
  PRESENT_DAMAGED: "3",
  DAMAGED: "3",
  PRESENT_DESTROYED: "4",
  DESTROYED: "4",
  PRESENT_FULL_TO_CAPACITY: "5",
  FULL_TO_CAPACITY: "5",
};

const HQ_TF_DUMMY: Record<string, string> = {
  NOT_APPLICABLE: "0",
  FEINT_DUMMY: "1",
  HEADQUARTERS: "2",
  FEINT_DUMMY_HEADQUARTERS: "3",
  TASK_FORCE: "4",
  FEINT_DUMMY_TASK_FORCE: "5",
  TASK_FORCE_HEADQUARTERS: "6",
  FEINT_DUMMY_TASK_FORCE_HEADQUARTERS: "7",
};

const CONTEXT: Record<string, string> = { REALITY: "0", EXERCISE: "1", SIMULATION: "2" };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

function enumValue(table: Record<string, string>, raw: unknown, fallback: string, name: string, warnings: string[]): string {
  if (typeof raw !== "string") return fallback;
  const key = raw.replace(/^[A-Za-z]+Enum_/, "");
  const value = table[key];
  if (value === undefined) {
    warnings.push(`${name} ${raw} is not mapped; used ${fallback}`);
    return fallback;
  }
  return value;
}

function twoDigits(raw: unknown, name: string, warnings: string[]): string {
  const text = String(raw ?? "00");
  if (/^\d{2}$/.test(text)) return text;
  warnings.push(`${name} "${text}" is not 2 digits; used 00`);
  return "00";
}

/** Echelon / mobility. Only codes the enum name spells out in digits are mapped. */
function echelon(raw: unknown, warnings: string[]): string {
  if (typeof raw !== "string" || /_(UNKNOWN|NOT_APPLICABLE)$/.test(raw)) return "00";
  const digits = raw.match(/_(\d{2})$/);
  if (digits) return digits[1];
  warnings.push(`echelon ${raw} is not mapped; used 00`);
  return "00";
}

/** The object that carries description and pose, wherever the message puts it. */
function entityOf(message: Json): Json {
  const body = message?.body;
  const op = body?.operation;
  if (op?.put_value) {
    const value = op.put_value;
    const key = String(value.$discriminator ?? "").replace(/^ValueTypeEnum_/, "").toLowerCase();
    if (value[key]) return value[key];
  }
  if (body?.description && body?.pose) return body;
  throw new Error(`No entity with description and pose in ${message?.header?.message_type ?? "message"}`);
}

function velocityOf(entity: Json): { speedKn?: number; courseDeg?: number } {
  const velocity = entity.velocity;
  if (!velocity) return {};
  const key = String(velocity.$discriminator ?? "").replace(/^VelocityTypeEnum_/, "").toLowerCase();
  const v = velocity[key] ?? {};
  const speed = typeof v.speed === "number" ? v.speed * MS_TO_KNOTS : undefined;
  const course = typeof v.course === "number" ? v.course : typeof v.heading === "number" ? v.heading : undefined;
  return { speedKn: speed, courseDeg: course };
}

function positionOf(entity: Json): { lat: number; lon: number; elevationM?: number } {
  const position = entity.pose?.position;
  const key = String(position?.$discriminator ?? "").replace(/^PositionTypeEnum_/, "").toLowerCase();
  const p = position?.[key];
  if (typeof p?.latitude !== "number" || typeof p?.longitude !== "number") {
    throw new Error("Entity has no latitude/longitude position");
  }
  const altitude = Array.isArray(p.altitude) ? p.altitude[0]?.value : undefined;
  return { lat: p.latitude, lon: p.longitude, elevationM: typeof altitude === "number" ? altitude : undefined };
}

export interface Stanag4817Result {
  track: Track;
  /** Values the adapter could not map; it used a default for each. */
  warnings: string[];
}

export function trackFrom4817(input: string | Json): Stanag4817Result {
  const message = typeof input === "string" ? JSON.parse(input) : input;
  const entity = entityOf(message);
  const d = entity.description ?? {};
  const warnings: string[] = [];

  const country = d.nationality ? countryNumericFromAlpha3(d.nationality) : undefined;
  if (d.nationality && !country) warnings.push(`nationality ${d.nationality} is not an ISO 3166 alpha-3 code`);

  const sidc =
    "13" +
    enumValue(CONTEXT, d.context_type, "0", "context", warnings) +
    enumValue(STANDARD_IDENTITY, d.standard_identity, "1", "standard_identity", warnings) +
    enumValue(SYMBOL_SET, d.symbol_set, "00", "symbol_set", warnings) +
    enumValue(STATUS, d.status, "0", "status", warnings) +
    enumValue(HQ_TF_DUMMY, d.headquarters_task_force_dummy, "0", "headquarters_task_force_dummy", warnings) +
    echelon(d.unit_echelon_equipment_mobility, warnings) +
    twoDigits(d.entity, "entity", warnings) +
    twoDigits(d.entity_type, "entity_type", warnings) +
    twoDigits(d.entity_subtype, "entity_subtype", warnings) +
    twoDigits(d.sector_1, "sector_1", warnings) +
    twoDigits(d.sector_2, "sector_2", warnings) +
    "0000000" +
    (country ?? "000");

  const callsign = (entity.external_identifiers ?? []).find(
    (x: Json) => x?.system?.name === "ExternalSystemEnum_CALLSIGN"
  )?.identifier;
  const amplifiers: AmpFields = {
    uniqueDesignation: d.name ?? callsign,
    higherFormation: d.organization,
    type: d.description,
    country,
  };

  return {
    track: {
      sourceId: String(entity.identifier ?? message?.header?.source),
      sidc,
      phase: "TRACKED",
      ...positionOf(entity),
      ...velocityOf(entity),
      observedAt: entity.timestamp ?? message?.header?.time_sent,
      amplifiers,
    },
    warnings,
  };
}
