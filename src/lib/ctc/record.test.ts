import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeElevation,
  elevationBand,
  encodeConfidence,
  encodeCourse,
  encodeElevation,
  encodeSigmaH,
  encodeSpeed,
} from "./bands.ts";
import {
  DEFAULT_MISSION_DEFAULTS,
  formatExt,
  frameBytes,
  fromHex,
  parseExt,
  parseFrame,
  parseRecord,
  recordBytes,
  sidcFromWireBase,
  toHex,
  wireBaseFromSidc,
} from "./record.ts";

// Self-check values from the Wire and Domains sheets of
// .settings/sidc-2525-APP6/josh-ctc_calculator.v003.xls.xlsx
const WORKBOOK_RECORDS = [
  ["UUV", "130335000011040000000000000000", "0101082011305055122092321", "0c7aea0c001567aab43e7fb5dff121"],
  ["UGV", "130310000012190000000000000000", "0202084523512100189042320", "0b8c81b2c02acb0622f48fd672f690"],
  ["USV", "130630000012070000000000000000", "0303166100428000244072320", "17784367c04032aacff06cfa44ff80"],
  ["UAV", "130301000011030000000000000000", "0042085011435020125092321", "0b36aa35c008e96edbcc34330239e1"],
  ["LEO", "130505000011150000000000000000", "0505071200880045729152323", "12d02960c06af3f6f4227dee827d43"],
  ["GEO", "130305000011110000000000000000", "0606095000500048729102323", "0b5cd007c0805879ceeddac7ba57f3"],
] as const;

test("records match the workbook Domains sheet", () => {
  for (const [name, sidc, ext, hex] of WORKBOOK_RECORDS) {
    const base = wireBaseFromSidc(sidc);
    assert.equal(toHex(recordBytes(base, ext)), hex, name);
    assert.deepEqual(parseRecord(fromHex(hex)), { base, ext }, name);
    assert.equal(sidcFromWireBase(base, DEFAULT_MISSION_DEFAULTS), sidc, name);
    assert.equal(formatExt(parseExt(ext)), ext, name);
  }
});

test("one-record frame matches the workbook Wire sheet", () => {
  const record = recordBytes("3010110300", "0042085011435020125092320");
  assert.equal(toHex(record), "0b36aa35c008e96edbcc34330239e0");
  const frame = frameBytes({ tableVersion: 1, originIndex: 0, epoch: 1234, seq: 7 }, [record]);
  assert.equal(toHex(frame), "01010004d20708900b36aa35c008e96edbcc34330239e0");
  const parsed = parseFrame(frame);
  assert.deepEqual(parsed.header, { tableVersion: 1, originIndex: 0, epoch: 1234, seq: 7 });
  assert.equal(toHex(parsed.records[0]), toHex(record));
});

test("a corrupted frame fails its CRC", () => {
  const frame = fromHex("01010004d20708900b36aa35c008e96edbcc34330239e0");
  frame[12] ^= 0x01;
  assert.throws(() => parseFrame(frame), /CRC/);
});

test("band encoders reproduce the workbook picks", () => {
  // UAV at ~840 m, UUV at 19 m depth, LEO at 300 km, GEO at 35 786 km.
  assert.equal(encodeElevation(840), 20);
  assert.equal(encodeElevation(-19), 55);
  assert.equal(encodeElevation(300_000), 45);
  assert.equal(encodeElevation(35_786_000), 48);
  assert.equal(encodeElevation(0), 0);
  assert.equal(encodeElevation(undefined), 99);
  assert.ok(Math.abs(decodeElevation(20)! - 840) < 1);
  assert.deepEqual(elevationBand(50), undefined);

  assert.equal(encodeCourse(60), 12);
  assert.equal(encodeCourse(359), 0);
  assert.equal(encodeCourse(undefined), 72);
  assert.equal(encodeSpeed(200, "01"), 5);
  assert.equal(encodeSpeed(16, "35"), 5);
  assert.equal(encodeSpeed(16, "10"), 9);
  assert.equal(encodeSigmaH(175), 9);
  assert.equal(encodeSigmaH(176), 10);
  assert.equal(encodeSigmaH(undefined), 15);
  assert.equal(encodeConfidence(0.85), 8);
  assert.equal(encodeConfidence(1), 9);
});
