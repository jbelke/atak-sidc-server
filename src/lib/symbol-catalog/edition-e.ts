/**
 * Digit 23 of an APP-6(E) / MIL-STD-2525E SIDC. 0 keeps the symbol set's frame.
 * These are the values milsymbol applies when the full code is rendered.
 */
export const FRAME_SHAPES: Record<string, string> = {
  "0": "Normal",
  "1": "Space",
  "2": "Air",
  "3": "Land unit",
  "4": "Land equipment and sea surface",
  "5": "Land installation",
  "6": "Dismounted individual",
  "7": "Sea subsurface",
  "8": "Activity or event",
  "9": "Cyberspace",
  A: "Unframed",
};

export interface FrameShape {
  code: string;
  name: string;
}

/** Digit 23, or null when the code has no E tail. */
export function frameShapeFromSidc(sidc: string): FrameShape | null {
  if (!/^\d{22}/.test(sidc) || sidc.length < 23) return null;
  const code = sidc.charAt(22).toUpperCase();
  return { code, name: FRAME_SHAPES[code] ?? "Unrecognized" };
}

interface AmplifierMetadata {
  activity?: boolean;
  baseDimension?: string;
  dismounted?: boolean;
  unit?: boolean;
}

/**
 * milsymbol draws field AC (`country`) for equipment, installations,
 * dismounted individuals, and activities. Air, sea, subsurface, and land
 * units leave that option off the symbol, so the same label is placed in
 * the identity field those sets do draw.
 *
 * `auxiliaryEquipmentIndicator` (field AG) is never drawn. It is set because
 * milsymbol 3.0 only enters its text path when one option from a fixed list
 * is present, and `country` is not on that list.
 */
export function countryAmplifierOptions(
  meta: AmplifierMetadata,
  label: string
): {
  country: string;
  auxiliaryEquipmentIndicator: string;
  uniqueDesignation?: string;
  staffComments?: string;
} {
  const drawnAsCountry =
    Boolean(meta.dismounted) ||
    Boolean(meta.activity) ||
    (meta.baseDimension === "Ground" && !meta.unit);

  if (drawnAsCountry) {
    return { country: label, auxiliaryEquipmentIndicator: label };
  }
  if (
    meta.baseDimension === "Air" ||
    meta.baseDimension === "Sea" ||
    meta.baseDimension === "Subsurface"
  ) {
    return {
      country: label,
      auxiliaryEquipmentIndicator: label,
      uniqueDesignation: label,
    };
  }
  return {
    country: label,
    auxiliaryEquipmentIndicator: label,
    staffComments: label,
  };
}

interface EditionESymbol {
  getMetadata(): AmplifierMetadata;
  setOptions(options: {
    country?: string;
    auxiliaryEquipmentIndicator?: string;
    uniqueDesignation?: string;
    staffComments?: string;
  }): unknown;
}

/**
 * Apply a country label from digits 28-30. Frame shape is already read from
 * the SIDC. Fields named in `occupied` already hold caller text, so the
 * label does not replace them.
 */
export function applyEditionE(
  symbol: EditionESymbol,
  countryLabel: string,
  occupied: Iterable<string> = []
): void {
  if (!countryLabel) return;
  const options: Record<string, string | undefined> = countryAmplifierOptions(
    symbol.getMetadata(),
    countryLabel
  );
  for (const name of Array.from(occupied)) {
    if (name !== "country") delete options[name];
  }
  symbol.setOptions(options);
}
