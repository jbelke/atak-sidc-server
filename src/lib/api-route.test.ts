// Calls the Next route handler GET /api/[standard]/[sidc] directly.
// `npm test` loads scripts/test-resolve.mjs so the route's "@/" imports resolve.
import assert from "node:assert/strict";
import test from "node:test";
import ms from "milsymbol";
import { GET } from "../app/api/[standard]/[sidc]/route.ts";

const LAND_UNIT = "10031000141211000000";
const AMPLIFIED = "uniqueDesignation=ALPHA-1&direction=90&speed=20%20KT";

async function get(path: string): Promise<Response> {
  const url = new URL(path, "http://localhost");
  const [, , standard, sidc] = url.pathname.split("/");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return GET(new Request(url) as any, { params: { standard, sidc: decodeURIComponent(sidc) } });
}

/** Width and height from the PNG IHDR chunk. */
async function pngSize(res: Response): Promise<{ width: number; height: number }> {
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("SVG is served as image/svg+xml", async () => {
  const res = await get(`/api/APP6/${LAND_UNIT}.svg`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/svg+xml");
  assert.match(await res.text(), /^<svg /);
});

test("PNG fills the requested box by default, amplifiers included", async () => {
  const res = await get(`/api/APP6/${LAND_UNIT}.png?size=64&${AMPLIFIED}`);
  assert.equal(res.status, 200);
  assert.deepEqual(await pngSize(res), { width: 64, height: 64 });
});

test("sizing=frame keeps the frame scale and grows the image with the amplifiers", async () => {
  const bare = await pngSize(await get(`/api/APP6/${LAND_UNIT}.png?sizing=frame&size=100`));
  const amplified = await pngSize(await get(`/api/APP6/${LAND_UNIT}.png?sizing=frame&size=100&${AMPLIFIED}`));
  const expected = new ms.Symbol(LAND_UNIT, {
    size: 100,
    uniqueDesignation: "ALPHA-1",
    direction: "90",
    speed: "20 KT",
  }).getSize();
  assert.deepEqual(bare, { width: 158, height: 136 });
  assert.deepEqual(amplified, { width: Math.ceil(expected.width), height: Math.ceil(expected.height) });
});

test("GLB is a binary glTF", async () => {
  const res = await get(`/api/APP6/${LAND_UNIT}.glb`);
  assert.equal(res.status, 200);
  assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString("ascii"), "glTF");
});

test("the 3D heading defaults from direction, and heading wins when both are set", async () => {
  const fromDirection = await (await get(`/api/APP6/${LAND_UNIT}.mesh?direction=90`)).json();
  assert.equal(fromDirection.pose.headingDeg, 90);
  const explicit = await (await get(`/api/APP6/${LAND_UNIT}.mesh?direction=90&heading=45`)).json();
  assert.equal(explicit.pose.headingDeg, 45);
  const none = await (await get(`/api/APP6/${LAND_UNIT}.mesh`)).json();
  assert.equal(none.pose.headingDeg, 0);
});

test("an unknown SIDC draws a placeholder, and strict=1 rejects it with 400", async () => {
  const unknown = "10031000149999990000";
  assert.equal((await get(`/api/APP6/${unknown}.svg`)).status, 200);
  const strict = await get(`/api/APP6/${unknown}.svg?strict=1`);
  assert.equal(strict.status, 400);
  assert.match(await strict.text(), /SIDC/);
  assert.equal((await get(`/api/APP6/${LAND_UNIT}.svg?strict=1`)).status, 200);
});

test("an amplifier over 64 characters is cut, and strict=1 rejects it with 400", async () => {
  const long = "X".repeat(65);
  const cut = await (await get(`/api/APP6/${LAND_UNIT}.svg?uniqueDesignation=${long}`)).text();
  assert.ok(cut.includes(">" + "X".repeat(64) + "<"));
  const strict = await get(`/api/APP6/${LAND_UNIT}.svg?strict=1&uniqueDesignation=${long}`);
  assert.equal(strict.status, 400);
  assert.match(await strict.text(), /uniqueDesignation/);
});

test("amplifiers=off draws no text", async () => {
  const svg = await (await get(`/api/APP6/${LAND_UNIT}.svg?amplifiers=off&${AMPLIFIED}`)).text();
  assert.ok(!svg.includes("<text"));
});

test("an unknown file format answers 500", async () => {
  assert.equal((await get(`/api/APP6/${LAND_UNIT}.bmp`)).status, 500);
});
