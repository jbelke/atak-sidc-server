import assert from "node:assert/strict";
import test from "node:test";
import { findOrigin, fromLocal, missionConfig, toLocal, type AoOrigin } from "./mission.ts";

const R = 6_371_008.8;
const RAD = Math.PI / 180;

function groundDistance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Worst ground error of encode (floor to a step) then decode (step centre), over cell corners. */
function worstRoundTripM(origin: AoOrigin): number {
  const q = origin.extentM / 10_000;
  let worst = 0;
  for (let i = 0; i <= 50; i++) {
    for (let j = 0; j <= 50; j++) {
      for (const [a, b] of [[1e-4, 1e-4], [0.9999, 0.9999], [1e-4, 0.9999], [0.9999, 1e-4]]) {
        const cellX = Math.min(9999, Math.round(i * 199.98));
        const cellY = Math.min(9999, Math.round(j * 199.98));
        const point = fromLocal(origin, (cellX + a) * q, (cellY + b) * q);
        const { east, north } = toLocal(origin, point.lat, point.lon);
        const back = fromLocal(origin, (Math.floor(east / q) + 0.5) * q, (Math.floor(north / q) + 0.5) * q);
        worst = Math.max(worst, groundDistance(point, back));
      }
    }
  }
  return worst;
}

test("a 150 km AO decodes every position to within one step, up to 85 degrees latitude", () => {
  // q = 15 m. Rounding alone costs half a step diagonal, 10.6 m; at 85 S the
  // widening north edge adds about 0.6 m.
  for (const lat of [-85, -60, 0, 45, 60, 84]) {
    const worst = worstRoundTripM({ lat, lon: 10, extentM: 150_000 });
    assert.ok(worst < 15, `origin ${lat}: worst ${worst.toFixed(2)} m`);
  }
});

test("an AO that crosses the 180th meridian holds points on both sides", () => {
  const origin = { lat: 0, lon: 179.5, extentM: 150_000 };
  const mission = missionConfig({ start: "2026-01-01T00:00:00Z", origins: [origin] });
  assert.equal(findOrigin(mission, 0.1, 179.9), 0);
  assert.equal(findOrigin(mission, 0.1, -179.9), 0);
  const { east, north } = toLocal(origin, 0.1, -179.9);
  const back = fromLocal(origin, east, north);
  assert.ok(Math.abs(back.lat - 0.1) < 1e-9);
  assert.ok(Math.abs(back.lon - -179.9) < 1e-9, `lon ${back.lon}`);
  assert.equal(findOrigin(mission, 0.1, 179.4), -1);
});
