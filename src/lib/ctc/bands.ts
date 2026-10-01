/**
 * Band tables of the Compact Track Code (CTC) record format v3.1, as defined
 * in .settings/sidc-2525-APP6/josh-ctc_calculator.v003.xls.xlsx. Each table
 * turns a measured value into the digits carried in the 25-digit extension,
 * and back into the value a receiver should use.
 */

/** E5. Track-quality lifecycle (STANAG 4817 TrackPhase). 4-9 are reserved. */
export const TRACK_PHASES = ["TRACKED", "DEAD_RECKONED", "LOST", "INACTIVE"] as const;
export type TrackPhase = (typeof TRACK_PHASES)[number];

/** E6. floor(confidence x 10), capped at 9. There is no unknown code. */
export function encodeConfidence(confidence: number): number {
  if (!Number.isFinite(confidence) || confidence <= 0) return 0;
  return Math.min(9, Math.floor(confidence * 10));
}

/** E6 decodes to the bucket midpoint. */
export function decodeConfidence(code: number): number {
  return (code * 10 + 5) / 100;
}

/** E17-E18. 00-71 = true course in 5 degree steps, 72 = unknown. */
export const COURSE_UNKNOWN = 72;

export function encodeCourse(degrees: number | undefined): number {
  if (degrees === undefined || !Number.isFinite(degrees)) return COURSE_UNKNOWN;
  return ((Math.round(degrees / 5) % 72) + 72) % 72;
}

export function decodeCourse(code: number): number | undefined {
  return code < COURSE_UNKNOWN ? code * 5 : undefined;
}

/** E19. Speed band upper edges in knots. Digit 8 is the open top band, 9 unknown. */
const SPEED_EDGES_KN = {
  sea: [0.5, 3, 6, 10, 15, 20, 30, 45],
  air: [20, 50, 80, 120, 180, 250, 350, 500],
} as const;
export type SpeedColumn = keyof typeof SPEED_EDGES_KN;
export const SPEED_UNKNOWN = 9;

/** Symbol sets 01/02 read the air column; 30/35/36 the sea column. Others have none yet. */
export function speedColumn(symbolSet: string): SpeedColumn | null {
  if (symbolSet === "01" || symbolSet === "02") return "air";
  if (symbolSet === "30" || symbolSet === "35" || symbolSet === "36") return "sea";
  return null;
}

export function encodeSpeed(knots: number | undefined, symbolSet: string): number {
  const column = speedColumn(symbolSet);
  if (!column || knots === undefined || !Number.isFinite(knots) || knots < 0) {
    return SPEED_UNKNOWN;
  }
  const edges = SPEED_EDGES_KN[column];
  const band = edges.findIndex((edge) => knots < edge);
  return band === -1 ? edges.length : band;
}

/** Knot range of a speed band, or undefined when unknown. `high` is undefined for the open band. */
export function decodeSpeed(
  code: number,
  symbolSet: string
): { low: number; high?: number } | undefined {
  const column = speedColumn(symbolSet);
  if (!column || code >= SPEED_UNKNOWN) return undefined;
  const edges = SPEED_EDGES_KN[column];
  return { low: code === 0 ? 0 : edges[code - 1], high: edges[code] };
}

/** E20-E21. Horizontal 1-sigma band edges in metres. 15 is >1200 m or unknown. */
const SIGMA_H_EDGES_M = [5, 8, 11, 17, 25, 37, 55, 80, 120, 175, 260, 380, 560, 800, 1200];
export const SIGMA_H_UNKNOWN = 15;

/** Smallest band whose edge is >= sigma. Rounds up, never down. */
export function encodeSigmaH(sigmaM: number | undefined): number {
  if (sigmaM === undefined || !Number.isFinite(sigmaM)) return SIGMA_H_UNKNOWN;
  const band = SIGMA_H_EDGES_M.findIndex((edge) => sigmaM <= edge);
  return band === -1 ? SIGMA_H_UNKNOWN : band;
}

export function sigmaHEdge(code: number): number | undefined {
  return SIGMA_H_EDGES_M[code];
}

/** E25. Vertical accuracy class edges in metres. 3 is >200 m or unknown. */
const SIGMA_Z_EDGES_M = [10, 50, 200];
export const SIGMA_Z_UNKNOWN = 3;

export function encodeSigmaZ(sigmaM: number | undefined): number {
  if (sigmaM === undefined || !Number.isFinite(sigmaM)) return SIGMA_Z_UNKNOWN;
  const band = SIGMA_Z_EDGES_M.findIndex((edge) => sigmaM <= edge);
  return band === -1 ? SIGMA_Z_UNKNOWN : band;
}

/**
 * E15-E16. One logarithmic scale from full ocean depth to beyond GEO.
 * 00 surface, 01-43 altitude to 30 km, 44-48 space to 36 000 km, 49 beyond GEO,
 * 51-89 depth to 11 km, 99 unknown. 50 and 90-98 are reserved.
 */
export const ELEVATION_SURFACE = 0;
export const ELEVATION_UNKNOWN = 99;

/** Upper edge in metres of an altitude band (01-48) or depth band (51-89). */
function elevationUpperEdge(code: number): number {
  if (code >= 1 && code <= 43) return 50 * Math.pow(600, (code - 1) / 42);
  if (code >= 44 && code <= 48) return 30_000 * Math.pow(1200, (code - 43) / 5);
  if (code >= 51 && code <= 89) return 10 * Math.pow(1100, (code - 51) / 38);
  return NaN;
}

/**
 * Elevation in metres, positive up. Negative values are depth below the
 * surface. Exactly 0 is the surface code. Undefined is unknown.
 */
export function encodeElevation(metres: number | undefined): number {
  if (metres === undefined || !Number.isFinite(metres)) return ELEVATION_UNKNOWN;
  if (metres === 0) return ELEVATION_SURFACE;
  if (metres > 0) {
    for (let code = 1; code <= 48; code++) {
      if (metres <= elevationUpperEdge(code)) return code;
    }
    return 49;
  }
  const depth = -metres;
  for (let code = 51; code <= 89; code++) {
    if (depth <= elevationUpperEdge(code)) return code;
  }
  return 89;
}

export interface ElevationBand {
  kind: "surface" | "altitude" | "depth";
  /** Metres, positive. */
  low: number;
  /** Metres, positive. Undefined for the open band above GEO. */
  high?: number;
}

export function elevationBand(code: number): ElevationBand | undefined {
  if (code === ELEVATION_SURFACE) return { kind: "surface", low: 0, high: 0 };
  if (code >= 1 && code <= 48) {
    return {
      kind: "altitude",
      low: code === 1 ? 0 : elevationUpperEdge(code - 1),
      high: elevationUpperEdge(code),
    };
  }
  if (code === 49) return { kind: "altitude", low: elevationUpperEdge(48) };
  if (code >= 51 && code <= 89) {
    return {
      kind: "depth",
      low: code === 51 ? 0 : elevationUpperEdge(code - 1),
      high: elevationUpperEdge(code),
    };
  }
  return undefined;
}

/**
 * Arithmetic band centre in metres, positive up. Undefined for unknown,
 * reserved, and open bands.
 */
export function decodeElevation(code: number): number | undefined {
  const band = elevationBand(code);
  if (!band || band.high === undefined) return undefined;
  const centre = (band.low + band.high) / 2;
  return band.kind === "depth" ? -centre : centre;
}
