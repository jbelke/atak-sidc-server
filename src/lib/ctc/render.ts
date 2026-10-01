/**
 * Turns a render request (plain SIDC or XSIDC, plus query string) into the
 * SIDC and milsymbol amplifier options to draw.
 */
import { StringTable } from "./amplifiers.ts";
import { decodeXsidc, isXsidc } from "./xsidc.ts";

/** The 21 MIL-STD-2525D / APP-6 text amplifiers, by milsymbol option name. */
export const AMPLIFIER_PARAMS = [
  "additionalInformation",
  "altitudeDepth",
  "combatEffectiveness",
  "commonIdentifier",
  "direction",
  "dtg",
  "equipmentTeardownTime",
  "evaluationRating",
  "higherFormation",
  "hostile",
  "iffSif",
  "location",
  "platformType",
  "quantity",
  "reinforcedReduced",
  "signatureEquipment",
  "specialHeadquarters",
  "speed",
  "staffComments",
  "type",
  "uniqueDesignation",
] as const;

/** Longest value accepted per amplifier; longer values are cut. */
const MAX_AMPLIFIER_LENGTH = 64;

export interface SymbolRequest {
  sidc: string;
  options: Record<string, string | number>;
}

/**
 * An XSIDC contributes its kinematic and AMP amplifiers. Text tags need the
 * mission string table, which the server does not hold, so they are dropped;
 * pass the text as query parameters instead. Query parameters win over XSIDC
 * values. Amplifiers a symbol set does not draw are left to milsymbol, which
 * ignores them, and milsymbol escapes the text it writes into the SVG.
 */
export function symbolRequest(code: string, query: URLSearchParams): SymbolRequest {
  let sidc = code;
  const options: Record<string, string | number> = {};
  if (isXsidc(code)) {
    const decoded = decodeXsidc(code, { strings: new StringTable(), skipUnknownText: true });
    sidc = decoded.sidc;
    Object.assign(options, decoded.options);
  }
  for (const name of AMPLIFIER_PARAMS) {
    const value = query.get(name);
    if (value) options[name] = value.slice(0, MAX_AMPLIFIER_LENGTH);
  }
  const speedLeader = Number(query.get("speedLeader"));
  if (options.direction && Number.isFinite(speedLeader) && speedLeader > 0) {
    options.speedLeader = Math.min(speedLeader, 500);
  }
  return { sidc, options };
}
