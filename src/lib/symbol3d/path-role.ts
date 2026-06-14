import type { SVGResultPath } from "three/examples/jsm/loaders/SVGLoader";
import * as THREE from "three";

export type SymbolPathRole = "frame" | "icon";

/**
 * Classify an SVG path as frame fill or inner icon/modifier.
 * milsymbol typically emits a light affiliation fill then dark icon paths.
 */
export function classifySymbolPath(
  path: SVGResultPath,
  index: number
): SymbolPathRole {
  const color = path.color;
  if (color instanceof THREE.Color) {
    const lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    if (lum < 0.22) {
      return "icon";
    }
    if (lum > 0.45) {
      return "frame";
    }
  }

  return index === 0 ? "frame" : "icon";
}
