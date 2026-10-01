import assert from "node:assert/strict";
import test from "node:test";
import ms from "milsymbol";
import { countryFromSidc } from "../symbol-catalog/country.ts";
import { applyEditionE } from "../symbol-catalog/edition-e.ts";
import { AMPLIFIER_PARAMS, symbolRequest } from "./render.ts";

const LAND_UNIT = "10031000141211000000";

function draw(code: string, query: string): string {
  const { sidc, options } = symbolRequest(code, new URLSearchParams(query));
  const symbol = new ms.Symbol(sidc, { size: 80, ...options });
  applyEditionE(symbol, countryFromSidc(sidc), Object.keys(options));
  return symbol.asSVG();
}

const texts = (svg: string) => (svg.match(/>[^<>]+</g) ?? []).map((t) => t.slice(1, -1));

test("all 21 amplifiers are accepted as query parameters", () => {
  assert.equal(AMPLIFIER_PARAMS.length, 21);
  const query = new URLSearchParams(AMPLIFIER_PARAMS.map((name) => [name, name === "direction" ? "90" : "X"]));
  const { options } = symbolRequest(LAND_UNIT, query);
  assert.equal(Object.keys(options).length, 21);
});

test("amplifier text is escaped in the SVG", () => {
  const svg = draw(LAND_UNIT, "uniqueDesignation=" + encodeURIComponent("<script>&"));
  assert.ok(svg.includes("&lt;script&gt;&amp;"));
  assert.ok(!svg.includes("<script>"));
});

test("amplifiers a symbol set does not draw are ignored without error", () => {
  const sea = "10033000001207000000";
  const svg = draw(sea, "reinforcedReduced=(%2B)&uniqueDesignation=USV-1");
  assert.deepEqual(texts(svg), ["USV-1"]);
});

test("an XSIDC draws its kinematics, and query text fills the AMP text it cannot resolve", () => {
  const xsidc =
    "130335000011010000000000000724_0001006534659068695152280_09724200000210001220002";
  const svg = draw(xsidc, "uniqueDesignation=SSK-0002");
  const drawn = texts(svg);
  assert.ok(drawn.includes("SSK-0002"), drawn.join("|"));
  assert.ok(drawn.some((t) => t.includes("-210 M")), drawn.join("|"));
});

test("the country label does not replace a caller's designation", () => {
  const air = "130301000011010000000000000578";
  assert.ok(texts(draw(air, "")).includes("NOR"));
  const drawn = texts(draw(air, "uniqueDesignation=CONTACT-00038"));
  assert.ok(drawn.includes("CONTACT-00038"));
  assert.ok(!drawn.includes("NOR"));
});
