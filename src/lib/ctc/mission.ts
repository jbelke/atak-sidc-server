/**
 * The pre-shared mission configuration. Both ends of the link hold the same
 * copy for one table_version; the radio carries only what it cannot rebuild.
 */
import { DEFAULT_MISSION_DEFAULTS, type MissionDefaults } from "./record.ts";

/** A square area of operations, measured from its south-west corner. */
export interface AoOrigin {
  /** Latitude of the south-west corner, degrees. */
  lat: number;
  /** Longitude of the south-west corner, degrees. */
  lon: number;
  /** Side length in metres. The position step q is extentM / 10000. */
  extentM: number;
}

export interface MissionConfig {
  tableVersion: number;
  defaults: MissionDefaults;
  /** Mission start, ISO 8601. Wire tick 0. */
  start: string;
  /** Wire tick length in seconds. Workbook default 10. */
  tickSeconds: number;
  /** Up to 16 origins, selected by the frame header origin index. */
  origins: AoOrigin[];
}

export function missionConfig(partial: Partial<MissionConfig> & Pick<MissionConfig, "start" | "origins">): MissionConfig {
  if (partial.origins.length === 0 || partial.origins.length > 16) {
    throw new RangeError("A mission needs 1 to 16 AO origins");
  }
  return {
    tableVersion: 1,
    tickSeconds: 10,
    ...partial,
    defaults: { ...DEFAULT_MISSION_DEFAULTS, ...partial.defaults },
  };
}

const EARTH_RADIUS_M = 6_371_008.8;
const RAD = Math.PI / 180;

/**
 * Equirectangular east/north metres from the origin corner. Exact to invert,
 * and well under one position step of error across a 150 km AO.
 */
export function toLocal(origin: AoOrigin, lat: number, lon: number): { east: number; north: number } {
  return {
    east: EARTH_RADIUS_M * Math.cos(origin.lat * RAD) * (lon - origin.lon) * RAD,
    north: EARTH_RADIUS_M * (lat - origin.lat) * RAD,
  };
}

export function fromLocal(origin: AoOrigin, east: number, north: number): { lat: number; lon: number } {
  return {
    lat: origin.lat + north / EARTH_RADIUS_M / RAD,
    lon: origin.lon + east / (EARTH_RADIUS_M * Math.cos(origin.lat * RAD)) / RAD,
  };
}

/** Index of the first origin whose square contains the point, or -1. */
export function findOrigin(mission: MissionConfig, lat: number, lon: number): number {
  return mission.origins.findIndex((origin) => {
    const { east, north } = toLocal(origin, lat, lon);
    return east >= 0 && north >= 0 && east < origin.extentM && north < origin.extentM;
  });
}

/** Wire ticks since mission start, rounded down. */
export function tickAt(mission: MissionConfig, time: string | Date): number {
  const ms = new Date(time).getTime() - new Date(mission.start).getTime();
  if (!Number.isFinite(ms)) throw new Error(`Invalid time "${String(time)}"`);
  return Math.floor(ms / 1000 / mission.tickSeconds);
}

export function timeAtTick(mission: MissionConfig, tick: number): Date {
  return new Date(new Date(mission.start).getTime() + tick * mission.tickSeconds * 1000);
}

/**
 * Resolve E22-E24 (tick mod 1000) to the absolute tick: the nearest tick at
 * or before the frame epoch.
 */
export function resolveObsTick(epoch: number, obsTickMod1000: number): number {
  return epoch - ((epoch - obsTickMod1000) % 1000 + 1000) % 1000;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Military date-time group in UTC, e.g. 011628ZOCT26. */
export function formatDtg(time: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return (
    two(time.getUTCDate()) + two(time.getUTCHours()) + two(time.getUTCMinutes()) + "Z" +
    MONTHS[time.getUTCMonth()] + two(time.getUTCFullYear() % 100)
  );
}
