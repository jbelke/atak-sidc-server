import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ms from "milsymbol";
import { trackFrom4817 } from "./adapters/stanag4817.ts";
import { encodeAmp, parseAmp, StringTable, type AmpFields } from "./amplifiers.ts";
import { missionConfig } from "./mission.ts";
import { ampRecordBytes, fromHex, parseAmpRecord, parseRecord, toHex } from "./record.ts";
import { decodeXsidc, encodeTrack, isXsidc, Roster } from "./xsidc.ts";

const fixture = (name: string) =>
  readFileSync(new URL(`./adapters/fixtures/${name}`, import.meta.url), "utf8");

const MISSION = missionConfig({
  start: "2026-10-01T00:00:00Z",
  origins: [
    { lat: 40, lon: 14, extentM: 100_000 }, // central Mediterranean
    { lat: 51, lon: 0.5, extentM: 100_000 }, // southern North Sea
  ],
});

test("every AMP field survives a round trip", () => {
  const fields: AmpFields = {
    quantity: 12,
    reinforcedReduced: "±",
    combatEffectiveness: "MARGINALLY OPERATIONAL",
    evaluationRating: "B2",
    signatureEquipment: true,
    hostile: true,
    iffSif: { mode: 3, code: "1234" },
    equipmentTeardownTime: 45,
    country: "826",
    uniqueDesignation: "A/1-64",
    higherFormation: "2BCT",
    type: "M1A2",
    platformType: "ELNOT",
    commonIdentifier: "Hawk",
    specialHeadquarters: "SHAPE",
    staffComments: "Moving north",
    additionalInformation: "Fuel 61%",
  };
  const strings = new StringTable();
  const amp = encodeAmp(fields, strings);
  assert.equal(amp, "0100120230330422050607312340804509826" + "200000210001220002230003240004250005260006270007");
  assert.deepEqual(parseAmp(amp, new StringTable([...strings.strings])), fields);
});

test("AMP rejects unknown tags, bad order, and unknown strings", () => {
  const strings = new StringTable(["x"]);
  assert.throws(() => parseAmp("99", strings), /not defined/);
  assert.throws(() => parseAmp("0510", strings), /out of order|not defined/);
  assert.throws(() => parseAmp("06" + "05", strings), /out of order/);
  assert.throws(() => parseAmp("200001", strings), /unknown string/);
  assert.throws(() => parseAmp("020", strings), /out of range/);
});

test("the amplifier record round-trips with its leading zeros", () => {
  const bytes = ampRecordBytes(42, "0500200000");
  assert.equal(bytes.length, 1 + 6); // 14 digits fit in 47 bits
  assert.deepEqual(parseAmpRecord(bytes), { instanceId: 42, amp: "0500200000" });
});

test("4817 NODE_STATUS compresses to a record plus AMP", () => {
  const { track, warnings } = trackFrom4817(fixture("4817-node-status.json"));
  assert.deepEqual(warnings, []);
  assert.equal(track.sidc, "130335000011010000000000000724");

  const strings = new StringTable();
  const encoded = encodeTrack(track, { mission: MISSION, roster: new Roster(), strings });
  assert.equal(encoded.sidc, "130335000011010000000000000724");
  assert.equal(encoded.originIndex, 0);
  assert.deepEqual(encoded.dropped, []);
  assert.deepEqual(strings.strings, ["SSK-0002", "OMNI Load Test Force", "submarine"]);
  assert.equal(encoded.amp, "09724" + "200000" + "210001" + "220002");
  assert.equal(encoded.record.length, 30);
  assert.ok(isXsidc(encoded.xsidc));

  const { ext } = decodeXsidc(encoded.xsidc, { strings });
  assert.equal(ext.instanceId, 1);
  assert.equal(ext.course, 69); // 345.8 deg
  assert.equal(ext.speed, 5); // 8.23 m/s = 16.0 kn, sea column 15-20
  assert.equal(ext.elevation, 68); // 220 m depth, band 191-229 m
  assert.equal(ext.obsTick, 928); // 16:28:09 is wire tick 5928
  assert.deepEqual(parseRecord(fromHex(encoded.record)).ext, encoded.ext);
});

test("4817 contact decodes to the amplifiers a receiver draws", () => {
  const { track } = trackFrom4817(JSON.parse(fixture("4817-contact.json")));
  const strings = new StringTable();
  const encoded = encodeTrack(track, { mission: MISSION, roster: new Roster(), strings, epoch: 5934 });
  assert.equal(encoded.originIndex, 1);
  assert.equal(encoded.sidc.slice(27), "578");

  const decoded = decodeXsidc(encoded.xsidc, {
    strings,
    mission: MISSION,
    epoch: 5934,
    originIndex: encoded.originIndex,
  });
  assert.deepEqual(decoded.options, {
    direction: "285",
    speed: "120-180 KT",
    altitudeDepth: "2438 M",
    dtg: "011629ZOCT26",
    location: "51.3126N 0.9749E",
    uniqueDesignation: "CONTACT-00038",
    type: "aircraft",
  });

  const svg = new ms.Symbol(decoded.sidc, { size: 80, ...decoded.options }).asSVG();
  // Air symbols draw speed and altitude as one label, and no DTG.
  for (const text of ["CONTACT-00038", "aircraft", "120-180 KT/2438 M"]) {
    assert.ok(svg.includes(`>${text}<`), text);
  }
});

test("a 4817 message is about a tenth of its JSON size on the wire", () => {
  const json = fixture("4817-node-status.json");
  const { track } = trackFrom4817(json);
  const encoded = encodeTrack(track, { mission: MISSION, roster: new Roster(), strings: new StringTable() });
  const wire = 15 + ampRecordBytes(encoded.instanceId, encoded.amp).length;
  assert.ok(wire < json.length / 40, `${wire} B vs ${json.length} B`);
  // Repeat reports send only the 15-byte record; AMP goes again only when it changes.
  assert.equal(toHex(fromHex(encoded.record)), encoded.record);
});

test("a track outside every AO is refused, not pinned to the edge", () => {
  const { track } = trackFrom4817(fixture("4817-node-status.json"));
  const mission = missionConfig({ start: MISSION.start, origins: [MISSION.origins[1]] });
  assert.throws(
    () => encodeTrack(track, { mission, roster: new Roster(), strings: new StringTable() }),
    /outside every AO/
  );
});
