/**
 * XSIDC: SIDC30 "_" EXT25 [ "_" AMP ]. The display and interchange form of
 * one track. Encodes a source-neutral Track into it, and decodes it back
 * into a SIDC plus milsymbol amplifier options.
 */
import {
  COURSE_UNKNOWN,
  TRACK_PHASES,
  decodeCourse,
  decodeElevation,
  decodeSpeed,
  elevationBand,
  encodeConfidence,
  encodeCourse,
  encodeElevation,
  encodeSigmaH,
  encodeSigmaZ,
  encodeSpeed,
  type TrackPhase,
} from "./bands.ts";
import { ampSymbolOptions, encodeAmp, parseAmp, type AmpFields, type StringTable } from "./amplifiers.ts";
import {
  findOrigin,
  formatDtg,
  fromLocal,
  resolveObsTick,
  tickAt,
  timeAtTick,
  toLocal,
  type MissionConfig,
} from "./mission.ts";
import {
  formatExt,
  parseExt,
  recordBytes,
  sidcFromWireBase,
  toHex,
  wireBaseFromSidc,
  type ExtFields,
} from "./record.ts";

/** One track, independent of the message format it came from. */
export interface Track {
  /** Stable source identifier (GUID, UID, track number). */
  sourceId: string;
  /** 20 or 30 digit SIDC as the source describes the track. */
  sidc: string;
  phase?: TrackPhase;
  /** 0-1. */
  confidence?: number;
  lat: number;
  lon: number;
  /** Metres, positive up, negative for depth. Undefined when unknown. */
  elevationM?: number;
  courseDeg?: number;
  speedKn?: number;
  /** Horizontal 1-sigma position error, metres. */
  sigmaHM?: number;
  /** Vertical 1-sigma error, metres. */
  sigmaZM?: number;
  /** ISO 8601 time the state was observed. */
  observedAt: string;
  amplifiers: AmpFields;
}

/** Maps source identifiers to 4-digit instance IDs. Never recycles an ID. */
export class Roster {
  private readonly ids = new Map<string, number>();
  private next = 1;

  constructor(entries: Array<[string, number]> = []) {
    for (const [sourceId, id] of entries) {
      this.ids.set(sourceId, id);
      this.next = Math.max(this.next, id + 1);
    }
  }

  assign(sourceId: string): number {
    const known = this.ids.get(sourceId);
    if (known !== undefined) return known;
    if (this.next > 9999) throw new RangeError("Roster is full (9999 instance IDs)");
    this.ids.set(sourceId, this.next);
    return this.next++;
  }

  entries(): Array<[string, number]> {
    return Array.from(this.ids.entries());
  }
}

export interface EncodeContext {
  mission: MissionConfig;
  roster: Roster;
  strings: StringTable;
  /** Frame epoch in wire ticks. Defaults to the observation tick. */
  epoch?: number;
}

export interface EncodedTrack {
  xsidc: string;
  /** The 30-digit SIDC the receiver will rebuild. */
  sidc: string;
  ext: string;
  amp: string;
  /** 15-byte record, hex. */
  record: string;
  instanceId: number;
  /** Frame header origin index this record must travel under. */
  originIndex: number;
  /**
   * SIDC fields of the source that the receiver cannot rebuild, because the
   * wire carries the mission default in their place.
   */
  dropped: string[];
}

const MISSION_DIGITS: Array<[string, number, number]> = [
  ["version", 0, 2],
  ["context", 2, 3],
  ["hqTfDummy", 7, 8],
  ["echelon", 8, 10],
  ["modifier1", 16, 18],
  ["modifier2", 18, 20],
  ["tail", 20, 27],
];

export function encodeTrack(track: Track, ctx: EncodeContext): EncodedTrack {
  const { mission } = ctx;
  const originIndex = findOrigin(mission, track.lat, track.lon);
  if (originIndex === -1) {
    throw new RangeError(`Track ${track.sourceId} at ${track.lat},${track.lon} is outside every AO origin`);
  }
  const origin = mission.origins[originIndex];
  const q = origin.extentM / 10_000;
  const { east, north } = toLocal(origin, track.lat, track.lon);

  const obsTick = tickAt(mission, track.observedAt);
  const epoch = ctx.epoch ?? obsTick;
  const clampedTick = Math.min(epoch, Math.max(epoch - 999, obsTick));

  const base = wireBaseFromSidc(track.sidc.slice(0, 20));
  const symbolSet = base.slice(1, 3);
  const ext: ExtFields = {
    instanceId: ctx.roster.assign(track.sourceId),
    phase: TRACK_PHASES.indexOf(track.phase ?? "TRACKED"),
    confidence: encodeConfidence(track.confidence ?? 0),
    x: Math.min(9999, Math.max(0, Math.floor(east / q))),
    y: Math.min(9999, Math.max(0, Math.floor(north / q))),
    elevation: encodeElevation(track.elevationM),
    course: encodeCourse(track.courseDeg),
    speed: encodeSpeed(track.speedKn, symbolSet),
    sigmaH: encodeSigmaH(track.sigmaHM),
    obsTick: ((clampedTick % 1000) + 1000) % 1000,
    sigmaZ: encodeSigmaZ(track.sigmaZM),
  };

  const sourceCountry = track.sidc.length === 30 ? track.sidc.slice(27) : "000";
  const country = track.amplifiers.country ?? (sourceCountry !== "000" ? sourceCountry : undefined);
  let sidc = sidcFromWireBase(base, mission.defaults);
  if (sidc.length === 30 && country) sidc = sidc.slice(0, 27) + country;

  const dropped = MISSION_DIGITS.filter(
    ([, from, to]) => from < track.sidc.length && track.sidc.slice(from, to) !== sidc.slice(from, to)
  ).map(([name]) => name);

  // The wire base has no country digits, so AMP carries them.
  const amp = encodeAmp({ ...track.amplifiers, country }, ctx.strings);
  const extDigits = formatExt(ext);
  return {
    xsidc: formatXsidc(sidc, extDigits, amp),
    sidc,
    ext: extDigits,
    amp,
    record: toHex(recordBytes(base, extDigits)),
    instanceId: ext.instanceId,
    originIndex,
    dropped,
  };
}

export function formatXsidc(sidc: string, ext: string, amp = ""): string {
  return amp ? `${sidc}_${ext}_${amp}` : `${sidc}_${ext}`;
}

/** True for codes that carry an EXT, so plain SIDCs keep their old path. */
export function isXsidc(code: string): boolean {
  return /^\d{30}_\d{25}(_\d*)?$/.test(code);
}

export function parseXsidc(code: string): { sidc: string; ext: string; amp: string } {
  if (!isXsidc(code)) throw new Error(`Not an XSIDC: "${code}"`);
  const [sidc, ext, amp = ""] = code.split("_");
  return { sidc, ext, amp };
}

export interface DecodeContext {
  strings: StringTable;
  /** Needed for the DTG and location amplifiers. */
  mission?: MissionConfig;
  /** Frame epoch, needed to resolve the observation tick. */
  epoch?: number;
  /** Frame origin index, needed for the location amplifier. */
  originIndex?: number;
}

function speedLabel(code: number, symbolSet: string): string | undefined {
  const band = decodeSpeed(code, symbolSet);
  if (!band) return undefined;
  return band.high === undefined ? `>${band.low} KT` : `${band.low}-${band.high} KT`;
}

function elevationLabel(code: number): string | undefined {
  const band = elevationBand(code);
  if (!band || band.kind === "surface") return undefined;
  if (band.high === undefined) return `>${Math.round(band.low / 1000)} KM`;
  const centre = Math.abs(decodeElevation(code)!);
  const text = centre >= 100_000 ? `${Math.round(centre / 1000)} KM` : `${Math.round(centre)} M`;
  return band.kind === "depth" ? `-${text}` : text;
}

function formatLatLon(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(4)}${lat < 0 ? "S" : "N"} ${Math.abs(lon).toFixed(4)}${lon < 0 ? "W" : "E"}`;
}

/** Q, Z, X from EXT alone; W and Y when the mission, epoch and origin are known. */
export function kinematicOptions(sidc: string, ext: ExtFields, ctx: Omit<DecodeContext, "strings"> = {}): Record<string, string> {
  const options: Record<string, string> = {};
  if (ext.course !== COURSE_UNKNOWN) options.direction = String(decodeCourse(ext.course));
  const speed = speedLabel(ext.speed, sidc.slice(4, 6));
  if (speed) options.speed = speed;
  const elevation = elevationLabel(ext.elevation);
  if (elevation) options.altitudeDepth = elevation;

  const { mission, epoch, originIndex } = ctx;
  if (mission && epoch !== undefined) {
    options.dtg = formatDtg(timeAtTick(mission, resolveObsTick(epoch, ext.obsTick)));
  }
  if (mission && originIndex !== undefined && mission.origins[originIndex]) {
    const origin = mission.origins[originIndex];
    const q = origin.extentM / 10_000;
    const { lat, lon } = fromLocal(origin, (ext.x + 0.5) * q, (ext.y + 0.5) * q);
    options.location = formatLatLon(lat, lon);
  }
  return options;
}

export interface DecodedXsidc {
  sidc: string;
  ext: ExtFields;
  amp: AmpFields;
  /** milsymbol amplifier options, kinematic and AMP together. */
  options: Record<string, string>;
}

export function decodeXsidc(code: string, ctx: DecodeContext): DecodedXsidc {
  const parts = parseXsidc(code);
  const ext = parseExt(parts.ext);
  const amp = parseAmp(parts.amp, ctx.strings);
  return {
    sidc: amp.country ? parts.sidc.slice(0, 27) + amp.country : parts.sidc,
    ext,
    amp,
    options: { ...kinematicOptions(parts.sidc, ext, ctx), ...ampSymbolOptions(amp) },
  };
}
