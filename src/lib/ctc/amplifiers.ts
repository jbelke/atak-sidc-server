/**
 * AMP: the amplifier block that extends an XSIDC past its 25-digit EXT.
 *
 *   XSIDC = SIDC30 "_" EXT25 [ "_" AMP ]
 *
 * The 21 MIL-STD-2525D / APP-6 text amplifiers fall into three groups, and
 * only the third costs digits:
 *
 * 1. Kinematic (Q direction, Z speed, X altitude/depth, W DTG, Y location)
 *    are read from EXT. They never appear in AMP.
 * 2. Free text (T, M, V, AD, AF, AA, G, H) is a 4-digit index into the
 *    pre-shared string table, which is versioned with table_version.
 * 3. Enumerable fields (C, F, K, J, L, N, P, AE) and the AC country get
 *    short fixed-width digit codes.
 *
 * AMP is a run of entries, each a 2-digit tag followed by that tag's
 * fixed-width value, in ascending tag order, each tag at most once.
 */

export type ReinforcedReduced = "+" | "-" | "±";

export const COMBAT_EFFECTIVENESS = [
  "FULLY OPERATIONAL",
  "SUBSTANTIALLY OPERATIONAL",
  "MARGINALLY OPERATIONAL",
  "NOT OPERATIONAL",
] as const;
export type CombatEffectiveness = (typeof COMBAT_EFFECTIVENESS)[number];

/** Free-text amplifiers carried as string-table indexes. */
export const TEXT_AMPLIFIERS = [
  "uniqueDesignation",
  "higherFormation",
  "type",
  "platformType",
  "commonIdentifier",
  "specialHeadquarters",
  "staffComments",
  "additionalInformation",
] as const;
export type TextAmplifier = (typeof TEXT_AMPLIFIERS)[number];

/** Decoded AMP. Text amplifiers hold strings, resolved through the string table. */
export interface AmpFields extends Partial<Record<TextAmplifier, string>> {
  /** C. 1-9999. */
  quantity?: number;
  /** F. */
  reinforcedReduced?: ReinforcedReduced;
  /** K. */
  combatEffectiveness?: CombatEffectiveness;
  /** J. Reliability A-F and credibility 1-6, e.g. "B2". */
  evaluationRating?: string;
  /** L. Drawn as "!". */
  signatureEquipment?: boolean;
  /** N. Drawn as "ENY". */
  hostile?: boolean;
  /** P. Mode 1, 2 or 3 and a 4-digit octal code. */
  iffSif?: { mode: 1 | 2 | 3; code: string };
  /** AE. Minutes, 0-999. */
  equipmentTeardownTime?: number;
  /** AC. ISO 3166-1 numeric, 3 digits. Written into SIDC digits 28-30. */
  country?: string;
}

/**
 * Pre-shared string table. Both sides hold the same list for one
 * table_version. A sender interns new strings and must announce them
 * before any AMP that points at them.
 */
export class StringTable {
  private readonly index = new Map<string, number>();
  readonly strings: string[];

  constructor(strings: string[] = []) {
    this.strings = strings;
    strings.forEach((s, i) => this.index.set(s, i));
  }

  intern(value: string): number {
    const known = this.index.get(value);
    if (known !== undefined) return known;
    if (this.strings.length >= 10_000) throw new RangeError("String table is full (10 000 entries)");
    this.strings.push(value);
    this.index.set(value, this.strings.length - 1);
    return this.strings.length - 1;
  }

  get(i: number): string | undefined {
    return this.strings[i];
  }
}

interface TagSpec {
  tag: string;
  width: number;
  encode(fields: AmpFields, strings: StringTable): string | undefined;
  decode(digits: string, fields: AmpFields, strings: StringTable, skipUnknownText: boolean): void;
}

const RR_CODES: readonly ReinforcedReduced[] = ["+", "-", "±"];

/** Codes are 1-based so that 0 is never a valid value. */
function pick<T>(values: readonly T[], d: string, name: string): T {
  const value = values[Number(d) - 1];
  if (value === undefined) throw new Error(`AMP ${name} code ${d} is out of range`);
  return value;
}
const OCTAL4 = /^[0-7]{4}$/;

function digits(value: number, width: number, name: string): string {
  if (!Number.isInteger(value) || value < 0 || value >= Math.pow(10, width)) {
    throw new RangeError(`${name} must be an integer of at most ${width} digits, got ${value}`);
  }
  return String(value).padStart(width, "0");
}

function textTag(tag: string, name: TextAmplifier): TagSpec {
  return {
    tag,
    width: 4,
    encode: (f, strings) => (f[name] ? digits(strings.intern(f[name]!), 4, name) : undefined),
    decode: (d, f, strings, skipUnknownText) => {
      const value = strings.get(Number(d));
      if (value !== undefined) f[name] = value;
      else if (!skipUnknownText) throw new Error(`AMP ${name} points at unknown string ${d}`);
    },
  };
}

const TAGS: TagSpec[] = [
  {
    tag: "01",
    width: 4,
    encode: (f) => (f.quantity ? digits(f.quantity, 4, "quantity") : undefined),
    decode: (d, f) => void (f.quantity = Number(d)),
  },
  {
    tag: "02",
    width: 1,
    encode: (f) => (f.reinforcedReduced ? String(RR_CODES.indexOf(f.reinforcedReduced) + 1) : undefined),
    decode: (d, f) => void (f.reinforcedReduced = pick(RR_CODES, d, "reinforcedReduced")),
  },
  {
    tag: "03",
    width: 1,
    encode: (f) =>
      f.combatEffectiveness ? String(COMBAT_EFFECTIVENESS.indexOf(f.combatEffectiveness) + 1) : undefined,
    decode: (d, f) => void (f.combatEffectiveness = pick(COMBAT_EFFECTIVENESS, d, "combatEffectiveness")),
  },
  {
    tag: "04",
    width: 2,
    encode: (f) => {
      const m = f.evaluationRating?.toUpperCase().match(/^([A-F])([1-6])$/);
      if (!f.evaluationRating) return undefined;
      if (!m) throw new RangeError(`evaluationRating must be A-F then 1-6, got "${f.evaluationRating}"`);
      return String(m[1].charCodeAt(0) - 64) + m[2];
    },
    decode: (d, f) => {
      if (!/^[1-6]{2}$/.test(d)) throw new Error(`AMP evaluationRating ${d} is out of range`);
      f.evaluationRating = String.fromCharCode(64 + Number(d[0])) + d[1];
    },
  },
  {
    tag: "05",
    width: 0,
    encode: (f) => (f.signatureEquipment ? "" : undefined),
    decode: (_d, f) => void (f.signatureEquipment = true),
  },
  {
    tag: "06",
    width: 0,
    encode: (f) => (f.hostile ? "" : undefined),
    decode: (_d, f) => void (f.hostile = true),
  },
  {
    tag: "07",
    width: 5,
    encode: (f) => {
      if (!f.iffSif) return undefined;
      if (![1, 2, 3].includes(f.iffSif.mode) || !OCTAL4.test(f.iffSif.code)) {
        throw new RangeError("iffSif needs mode 1-3 and a 4-digit octal code");
      }
      return String(f.iffSif.mode) + f.iffSif.code;
    },
    decode: (d, f) => {
      if (!/^[1-3][0-7]{4}$/.test(d)) throw new Error(`AMP iffSif ${d} is out of range`);
      f.iffSif = { mode: Number(d[0]) as 1 | 2 | 3, code: d.slice(1) };
    },
  },
  {
    tag: "08",
    width: 3,
    encode: (f) =>
      f.equipmentTeardownTime !== undefined
        ? digits(f.equipmentTeardownTime, 3, "equipmentTeardownTime")
        : undefined,
    decode: (d, f) => void (f.equipmentTeardownTime = Number(d)),
  },
  {
    tag: "09",
    width: 3,
    encode: (f) => {
      if (!f.country || f.country === "000") return undefined;
      if (!/^\d{3}$/.test(f.country)) throw new RangeError(`country must be ISO numeric, got "${f.country}"`);
      return f.country;
    },
    decode: (d, f) => void (f.country = d),
  },
  textTag("20", "uniqueDesignation"),
  textTag("21", "higherFormation"),
  textTag("22", "type"),
  textTag("23", "platformType"),
  textTag("24", "commonIdentifier"),
  textTag("25", "specialHeadquarters"),
  textTag("26", "staffComments"),
  textTag("27", "additionalInformation"),
];

const TAG_BY_CODE = new Map(TAGS.map((t) => [t.tag, t]));

/** Encode amplifier fields as AMP digits. New text values are interned into `strings`. */
export function encodeAmp(fields: AmpFields, strings: StringTable): string {
  let out = "";
  for (const spec of TAGS) {
    const value = spec.encode(fields, strings);
    if (value !== undefined) out += spec.tag + value;
  }
  return out;
}

/**
 * With skipUnknownText, a text index missing from the table is dropped
 * instead of failing, for readers that do not hold the mission string table.
 */
export function parseAmp(amp: string, strings: StringTable, skipUnknownText = false): AmpFields {
  if (!/^\d*$/.test(amp)) throw new Error(`AMP must be digits, got "${amp}"`);
  const fields: AmpFields = {};
  let at = 0;
  let last = "";
  while (at < amp.length) {
    const tag = amp.slice(at, at + 2);
    const spec = TAG_BY_CODE.get(tag);
    if (!spec) throw new Error(`AMP tag ${tag} is not defined`);
    if (tag <= last) throw new Error(`AMP tag ${tag} is out of order or repeated`);
    const value = amp.slice(at + 2, at + 2 + spec.width);
    if (value.length !== spec.width) throw new Error(`AMP tag ${tag} is truncated`);
    spec.decode(value, fields, strings, skipUnknownText);
    last = tag;
    at += 2 + spec.width;
  }
  return fields;
}

/** The milsymbol option strings for the non-kinematic amplifiers. */
export function ampSymbolOptions(fields: AmpFields): Record<string, string> {
  const options: Record<string, string> = {};
  for (const name of TEXT_AMPLIFIERS) {
    if (fields[name]) options[name] = fields[name]!;
  }
  if (fields.quantity) options.quantity = String(fields.quantity);
  if (fields.reinforcedReduced) options.reinforcedReduced = `(${fields.reinforcedReduced})`;
  if (fields.combatEffectiveness) options.combatEffectiveness = fields.combatEffectiveness;
  if (fields.evaluationRating) options.evaluationRating = fields.evaluationRating;
  if (fields.signatureEquipment) options.signatureEquipment = "!";
  if (fields.hostile) options.hostile = "ENY";
  if (fields.iffSif) options.iffSif = `M${fields.iffSif.mode} ${fields.iffSif.code}`;
  if (fields.equipmentTeardownTime !== undefined) {
    options.equipmentTeardownTime = String(fields.equipmentTeardownTime);
  }
  return options;
}
