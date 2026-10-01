// Calls the Next route handler GET /api/[standard]/[sidc] directly.
// `npm test` loads scripts/test-resolve.mjs so the route's "@/" imports resolve.
import assert from "node:assert/strict";
import test from "node:test";
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

test("GLB is a binary glTF", async () => {
  const res = await get(`/api/APP6/${LAND_UNIT}.glb`);
  assert.equal(res.status, 200);
  assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString("ascii"), "glTF");
});

test("amplifiers=off draws no text", async () => {
  const svg = await (await get(`/api/APP6/${LAND_UNIT}.svg?amplifiers=off&${AMPLIFIED}`)).text();
  assert.ok(!svg.includes("<text"));
});

test("an unknown file format answers 500", async () => {
  assert.equal((await get(`/api/APP6/${LAND_UNIT}.bmp`)).status, 500);
});
