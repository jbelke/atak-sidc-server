import assert from "node:assert/strict";
import test from "node:test";
import ms from "milsymbol";
import { countryFromSidc } from "./country.ts";
import {
  applyEditionE,
  frameShapeFromSidc,
} from "./edition-e.ts";

const INFANTRY = "10031000001211000000";
const EQUIPMENT = "10031500001101000000";
const AIR = "10030100001101000000";
const SEA = "10033000001207000000";
const DISMOUNT = "10032700001100000000";
const ACTIVITY = "10034000001100000000";

function render(sidc: string): string {
  const symbol = new ms.Symbol(sidc, { size: 80, standard: "APP6" });
  applyEditionE(symbol, countryFromSidc(sidc));
  return symbol.asSVG();
}

function label(svg: string, text: string): boolean {
  return svg.includes(`>${text}<`);
}

test("20-digit codes have no E tail", () => {
  assert.equal(countryFromSidc(INFANTRY), "");
  assert.equal(frameShapeFromSidc(INFANTRY), null);
  assert.equal(countryFromSidc("SFGPUCI-----USG"), "");
});

test("digits 28-30 map to an alpha-3 label", () => {
  assert.equal(countryFromSidc(`${INFANTRY}0000000840`), "USA");
  assert.equal(countryFromSidc(`${INFANTRY}0000000826`), "GBR");
  assert.equal(countryFromSidc(`${INFANTRY}0000000000`), "");
  assert.equal(countryFromSidc(`${INFANTRY}0000000999`), "999");
});

test("digit 23 names the frame override", () => {
  assert.deepEqual(frameShapeFromSidc(`${INFANTRY}0020000000`), {
    code: "2",
    name: "Air",
  });
  assert.deepEqual(frameShapeFromSidc(`${INFANTRY}0000000000`), {
    code: "0",
    name: "Normal",
  });
  assert.equal(frameShapeFromSidc(`${INFANTRY}00A0000000`)?.name, "Unframed");
});

test("a zero tail matches the 20-digit symbol", () => {
  assert.equal(render(INFANTRY), render(`${INFANTRY}0000000000`));
});

test("frame shape 2 draws a ground unit in an air frame", () => {
  const normal = render(INFANTRY);
  const airFrame = render(`${INFANTRY}0020000000`);
  assert.notEqual(normal, airFrame);
  assert.match(normal, /M25,50 l150,0/);
  assert.match(airFrame, /C 155,50 115,30 100,30/);
});

test("country is drawn for unit, equipment, air, sea, dismount, and activity", () => {
  const cases: Array<[string, string, string]> = [
    ["unit", INFANTRY, "USA"],
    ["equipment", EQUIPMENT, "USA"],
    ["air", AIR, "GBR"],
    ["sea", SEA, "USA"],
    ["dismount", DISMOUNT, "USA"],
    ["activity", ACTIVITY, "USA"],
  ];
  for (const [name, base, expected] of cases) {
    const numeric = expected === "GBR" ? "826" : "840";
    const svg = render(`${base}0000000${numeric}`);
    assert.equal(label(svg, expected), true, name);
    assert.equal(label(render(`${base}0000000000`), expected), false, `${name} blank`);
  }
});

test("an air-framed unit still shows its country", () => {
  const svg = render(`${INFANTRY}0020000840`);
  assert.match(svg, /C 155,50 115,30 100,30/);
  assert.equal(label(svg, "USA"), true);
});
