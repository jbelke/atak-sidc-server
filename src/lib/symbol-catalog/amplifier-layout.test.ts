import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ms from "milsymbol";
import { centreTextBaselines } from "../svg-text.ts";

// Text positions read from the live reference picker, sidc.milsymb.net, for
// ten symbol types with all 21 amplifiers set to their field letters.
const reference = JSON.parse(
  readFileSync(new URL("./fixtures/amplifier-layout.milsymb.net.json", import.meta.url), "utf8")
) as { symbols: Record<string, { sidc: string; text: Record<string, [number, number, string]> }> };

const FIELD_LETTERS = {
  additionalInformation: "H", altitudeDepth: "X", combatEffectiveness: "K", commonIdentifier: "AF",
  direction: "45", dtg: "W", equipmentTeardownTime: "AE", evaluationRating: "J", higherFormation: "M",
  hostile: "N", iffSif: "P", location: "Y", platformType: "AD", quantity: "C", reinforcedReduced: "F",
  signatureEquipment: "L", specialHeadquarters: "AA", speed: "Z", staffComments: "G", type: "V",
  uniqueDesignation: "T",
};

function textPositions(svg: string): Record<string, [number, number, string]> {
  const out: Record<string, [number, number, string]> = {};
  for (const m of Array.from(svg.matchAll(/<text\b([^>]*)>([^<]*)</g))) {
    const attr = (name: string) => m[1].match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? "";
    out[m[2]] = [Number(attr("x")), Number(attr("y")), attr("text-anchor")];
  }
  return out;
}

for (const [name, { sidc, text }] of Object.entries(reference.symbols)) {
  test(`amplifier text sits where the reference picker puts it: ${name}`, () => {
    const svg = centreTextBaselines(new ms.Symbol(sidc, { size: 100, ...FIELD_LETTERS }).asSVG());
    const ours = textPositions(svg);
    for (const [label, position] of Object.entries(text)) {
      assert.deepEqual(ours[label], position, `${name} ${label}`);
    }
  });
}

test("centred labels get a plain baseline that every renderer honours", () => {
  const svg = new ms.Symbol("10031000001211000000", { size: 100, specialHeadquarters: "AA" }).asSVG();
  assert.match(svg, /alignment-baseline="middle"/);
  const fixed = centreTextBaselines(svg);
  assert.doesNotMatch(fixed, /alignment-baseline/);
  assert.deepEqual(textPositions(fixed).AA, [100, 115, "middle"]);
});
