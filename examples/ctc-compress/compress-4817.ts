/**
 * Compress STANAG 4817 JSON messages into CTC records.
 *
 *   node --experimental-strip-types examples/ctc-compress/compress-4817.ts \
 *     examples/ctc-compress/mission.json src/lib/ctc/adapters/fixtures/*.json
 *
 * Prints one line per message: XSIDC, record hex, amplifier record hex, and
 * the byte counts. Then prints the string table both sides must hold.
 */
import { readFileSync } from "node:fs";
import { trackFrom4817 } from "../../src/lib/ctc/adapters/stanag4817.ts";
import { StringTable } from "../../src/lib/ctc/amplifiers.ts";
import { missionConfig, tickAt } from "../../src/lib/ctc/mission.ts";
import { ampRecordBytes, toHex } from "../../src/lib/ctc/record.ts";
import { encodeTrack, Roster } from "../../src/lib/ctc/xsidc.ts";

const [missionPath, ...messagePaths] = process.argv.slice(2);
if (!missionPath || messagePaths.length === 0) {
  console.error("usage: compress-4817.ts <mission.json> <message.json>...");
  process.exit(2);
}

const mission = missionConfig(JSON.parse(readFileSync(missionPath, "utf8")));
const roster = new Roster();
const strings = new StringTable();

for (const path of messagePaths) {
  const json = readFileSync(path, "utf8");
  const message = JSON.parse(json);
  const { track, warnings } = trackFrom4817(message);
  const epoch = tickAt(mission, message.header?.time_sent ?? track.observedAt);
  const encoded = encodeTrack(track, { mission, roster, strings, epoch });
  const amp = ampRecordBytes(encoded.instanceId, encoded.amp);
  console.log(path);
  console.log(`  xsidc   ${encoded.xsidc}`);
  console.log(`  record  ${encoded.record}  (15 B, origin ${encoded.originIndex})`);
  console.log(`  amp     ${toHex(amp)}  (${amp.length} B, only when amplifiers change)`);
  console.log(`  size    ${Buffer.byteLength(json)} B JSON -> ${15 + amp.length} B first report, 15 B after`);
  for (const field of encoded.dropped) console.log(`  dropped ${field} (mission default used)`);
  for (const warning of warnings) console.log(`  warning ${warning}`);
}

console.log("string table:");
strings.strings.forEach((s, i) => console.log(`  ${String(i).padStart(4, "0")} ${s}`));
