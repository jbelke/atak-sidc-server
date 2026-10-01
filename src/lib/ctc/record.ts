/**
 * CTC record format v3.1: digits, the 15-byte record, and the frame.
 *
 * A record is the 10 information-bearing SIDC digits (the wire base) and the
 * 25-digit telemetry extension (EXT). Each digit group is read as one
 * unsigned integer (radix conversion, never BCD): base < 10^10 < 2^34 and
 * EXT < 10^25 < 2^84. The record is (base << 84) | ext, 15 bytes big-endian.
 */

const TEN = BigInt(10);
const SHIFT_EXT = BigInt(84);
const BYTE = BigInt(256);

export const RECORD_BYTES = 15;
export const HEADER_BYTES = 8;
export const FORMAT_VERSION = 1;

/** The 25 digits of EXT, as integers. */
export interface ExtFields {
  /** E1-E4. Picture alias number, 0-9999. */
  instanceId: number;
  /** E5. 0-3, see TRACK_PHASES. */
  phase: number;
  /** E6. 0-9. */
  confidence: number;
  /** E7-E10. Steps of q east of the AO south-west corner, 0-9999. */
  x: number;
  /** E11-E14. Steps of q north of the AO south-west corner, 0-9999. */
  y: number;
  /** E15-E16. Elevation band. */
  elevation: number;
  /** E17-E18. Course code. */
  course: number;
  /** E19. Speed band. */
  speed: number;
  /** E20-E21. Horizontal accuracy band. */
  sigmaH: number;
  /** E22-E24. Observation wire tick, modulo 1000. */
  obsTick: number;
  /** E25. Vertical accuracy class. */
  sigmaZ: number;
}

const EXT_LAYOUT: Array<[keyof ExtFields, number]> = [
  ["instanceId", 4],
  ["phase", 1],
  ["confidence", 1],
  ["x", 4],
  ["y", 4],
  ["elevation", 2],
  ["course", 2],
  ["speed", 1],
  ["sigmaH", 2],
  ["obsTick", 3],
  ["sigmaZ", 1],
];

function pad(value: number, width: number, name: string): string {
  if (!Number.isInteger(value) || value < 0 || value >= Math.pow(10, width)) {
    throw new RangeError(`${name} must be an integer of at most ${width} digits, got ${value}`);
  }
  return String(value).padStart(width, "0");
}

export function formatExt(fields: ExtFields): string {
  return EXT_LAYOUT.map(([name, width]) => pad(fields[name], width, name)).join("");
}

export function parseExt(digits: string): ExtFields {
  if (!/^\d{25}$/.test(digits)) throw new Error(`EXT must be 25 digits, got "${digits}"`);
  const fields = {} as ExtFields;
  let at = 0;
  for (const [name, width] of EXT_LAYOUT) {
    fields[name] = Number(digits.slice(at, at + width));
    at += width;
  }
  if (fields.phase > 3) throw new Error(`EXT phase ${fields.phase} is reserved`);
  return fields;
}

/**
 * The SIDC digits that are not on the wire. The receiver restores them from
 * the pre-shared mission configuration.
 */
export interface MissionDefaults {
  /** Digits 1-2. 13 for 2525E, 10 for 2525D / APP-6D. */
  version: string;
  /** Digit 3. 0 reality, 1 exercise, 2 simulation. */
  context: string;
  /** Digit 8. */
  hqTfDummy: string;
  /** Digits 9-10. */
  echelon: string;
  /** Digits 17-18. */
  modifier1: string;
  /** Digits 19-20. */
  modifier2: string;
  /** Digits 21-30. Only used when version is 13. */
  tail: string;
}

export const DEFAULT_MISSION_DEFAULTS: MissionDefaults = {
  version: "13",
  context: "0",
  hqTfDummy: "0",
  echelon: "00",
  modifier1: "00",
  modifier2: "00",
  tail: "0000000000",
};

/** Identity (4), symbol set (5-6), status (7), entity (11-16). */
export function wireBaseFromSidc(sidc: string): string {
  if (!/^\d{20}(\d{10})?$/.test(sidc)) {
    throw new Error(`Wire base needs a 20 or 30 digit SIDC, got "${sidc}"`);
  }
  return sidc.charAt(3) + sidc.slice(4, 6) + sidc.charAt(6) + sidc.slice(10, 16);
}

export function sidcFromWireBase(base: string, defaults: MissionDefaults): string {
  if (!/^\d{10}$/.test(base)) throw new Error(`Wire base must be 10 digits, got "${base}"`);
  const d = defaults;
  const sidc20 =
    d.version + d.context + base.charAt(0) + base.slice(1, 3) + base.charAt(3) +
    d.hqTfDummy + d.echelon + base.slice(4, 10) + d.modifier1 + d.modifier2;
  return d.version === "10" ? sidc20 : sidc20 + d.tail;
}

function digitsToBigInt(digits: string): bigint {
  let value = BigInt(0);
  for (let i = 0; i < digits.length; i++) {
    value = value * TEN + BigInt(digits.charCodeAt(i) - 48);
  }
  return value;
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let rest = value;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(rest % BYTE);
    rest /= BYTE;
  }
  if (rest !== BigInt(0)) throw new RangeError(`Value does not fit in ${length} bytes`);
  return out;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = BigInt(0);
  for (let i = 0; i < bytes.length; i++) value = value * BYTE + BigInt(bytes[i]);
  return value;
}

export function recordBytes(base: string, ext: string): Uint8Array {
  if (!/^\d{10}$/.test(base)) throw new Error(`Wire base must be 10 digits, got "${base}"`);
  if (!/^\d{25}$/.test(ext)) throw new Error(`EXT must be 25 digits, got "${ext}"`);
  const value = (digitsToBigInt(base) << SHIFT_EXT) | digitsToBigInt(ext);
  return bigIntToBytes(value, RECORD_BYTES);
}

export function parseRecord(bytes: Uint8Array): { base: string; ext: string } {
  if (bytes.length !== RECORD_BYTES) throw new Error(`Record must be ${RECORD_BYTES} bytes`);
  const value = bytesToBigInt(bytes);
  const extMask = (BigInt(1) << SHIFT_EXT) - BigInt(1);
  const base = (value >> SHIFT_EXT).toString().padStart(10, "0");
  const ext = (value & extMask).toString().padStart(25, "0");
  if (base.length > 10 || ext.length > 25) throw new Error("Record digits overflow");
  return { base, ext };
}

/** CRC-8/AUTOSAR: poly 0x2F, init 0xFF, xorout 0xFF. */
const CRC8_TABLE = (() => {
  const table = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x2f) & 0xff : (crc << 1) & 0xff;
    }
    table[i] = crc;
  }
  return table;
})();

/** CRC over every frame byte, with the CRC byte (7) read as zero. */
function frameCrc(frame: Uint8Array): number {
  let crc = 0xff;
  for (let i = 0; i < frame.length; i++) {
    crc = CRC8_TABLE[crc ^ (i === 7 ? 0 : frame[i])];
  }
  return crc ^ 0xff;
}

export interface FrameHeader {
  /** Versions the whole pre-shared table set. */
  tableVersion: number;
  /** Selects the AO origin, 0-15. Every record in a frame shares it. */
  originIndex: number;
  /** Wire ticks since mission start, 16-bit. */
  epoch: number;
  /** Per-sender wrapping counter, 8-bit. */
  seq: number;
}

/**
 * Header byte 6. Workbook v003 writes the constant 8 here and does not name
 * it; decoders reject any other value so a format change cannot pass silently.
 */
const HEADER_BYTE6 = 0x08;

/**
 * Header: version, table_version, origin, epoch (2 B), seq, 0x08, CRC.
 * The CRC covers all frame bytes in order, with its own byte read as zero.
 * The optional 8-byte MAC trailer is not produced here.
 */
export function frameBytes(header: FrameHeader, records: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(HEADER_BYTES + RECORD_BYTES * records.length);
  out.set([
    FORMAT_VERSION,
    header.tableVersion & 0xff,
    header.originIndex & 0xff,
    (header.epoch >> 8) & 0xff,
    header.epoch & 0xff,
    header.seq & 0xff,
    HEADER_BYTE6,
  ]);
  records.forEach((record, i) => out.set(record, HEADER_BYTES + RECORD_BYTES * i));
  out[7] = frameCrc(out);
  return out;
}

export function parseFrame(bytes: Uint8Array): { header: FrameHeader; records: Uint8Array[] } {
  const body = bytes.length - HEADER_BYTES;
  if (body < 0 || body % RECORD_BYTES !== 0) {
    throw new Error(`Frame length ${bytes.length} is not 8 + 15 x n`);
  }
  if (bytes[0] !== FORMAT_VERSION) throw new Error(`Unknown frame version ${bytes[0]}`);
  if (bytes[6] !== HEADER_BYTE6) throw new Error(`Unexpected header byte 6: ${bytes[6]}`);
  if (frameCrc(bytes) !== bytes[7]) throw new Error("Frame CRC mismatch");
  const records: Uint8Array[] = [];
  for (let at = HEADER_BYTES; at < bytes.length; at += RECORD_BYTES) {
    records.push(bytes.slice(at, at + RECORD_BYTES));
  }
  return {
    header: {
      tableVersion: bytes[1],
      originIndex: bytes[2],
      epoch: (bytes[3] << 8) | bytes[4],
      seq: bytes[5],
    },
    records,
  };
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  if (!/^([0-9a-f]{2})*$/i.test(hex)) throw new Error("Invalid hex");
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));
}
