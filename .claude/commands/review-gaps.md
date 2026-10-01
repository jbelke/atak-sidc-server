---
description: Review the known local gaps in the SIDC server, verify each one, and mature the ones that are ready
argument-hint: "[optional: gap number or area, e.g. 4 or xsidc]"
---

# Review and mature local gaps

Work on the gaps below in this repo. If `$ARGUMENTS` names a gap number or an
area, do only that; otherwise do the whole list. Commit directly to `main`,
small atomic commits, per CLAUDE.md. Track every item in beads (`bd`), never in
markdown TODOs.

## Method, per gap

1. **Verify it still exists.** Read the code, run the test, or reproduce it on
   the dev server. Record the evidence (command + output) in the bd issue. If it
   is already fixed, close the issue with that evidence and move on.
2. **Classify it:** `bug` (wrong output today), `gap` (missing capability),
   `decision` (needs a trade-off the user owns), or `blocked` (needs input from
   outside the repo, such as sample messages).
3. **Decisions go to the council** (Chairman, Skeptic, Executor, plus 2–3 bench
   seats by topic). Close with the call and the evidence that would reverse it.
   If the call is the user's, ask with at most 2 options and a recommendation.
4. **Mature the smallest shippable slice** of each `bug` and `gap`. Write the
   failing test first. No new mechanism ahead of demonstrated need.
5. **Verify locally before you claim done:**
   - `npm test` (all `*.test.ts` under `src/lib`)
   - `npx tsc --noEmit -p .` run raw (`contextzip proxy …`); the filtered form can hide errors
   - `npx next lint --dir src` — compare the count against `main` before your change
   - `yarn dev -p 8417` (port 8080 is held by an OrbStack container), then curl
     every endpoint you touched and look at the PNG output, not only the SVG
   - for UI changes, open your own new tab, screenshot, and close only that tab
6. **Report** per gap: before, after, evidence, and what is still open.

## Known gaps (found 2026-10-01)

### Rendering and amplifiers
1. **Sizing of amplified symbols** (`atak-sidc-server-a68`). Raster output fits
   the whole amplified extent into `width` × `height`, so the frame shrinks as
   text is added. Define `size` against the frame, not the extent.
2. **Quantity (C) overlaps the echelon mark** on land units (e.g.
   `10031000151211000000?quantity=C`). The reference picker sidc.milsymb.net
   draws it in the same place, so this is milsymbol behaviour. Decide: follow
   the reference, or shift C above the echelon as MIL-STD-2525D shows.
3. **3D ignores amplifiers** (`atak-sidc-server-660`), and the 3D heading does
   not default from `direction` (`atak-sidc-server-dfp`).
4. **Amplifier values over 64 characters are cut silently.** Decide whether to
   return 400 instead.
5. **An unparseable SIDC renders a placeholder** with status 200. Consider a
   `strict=1` mode that returns 400.
6. **No test calls the Next route itself** (`atak-sidc-server-63d`). The tests
   cover `symbolRequest()` and milsymbol, not `GET /api/...`.

### XSIDC / CTC codec (`src/lib/ctc/`)
7. **The server cannot draw AMP text, DTG or location from an XSIDC**, because
   it has no mission string table, clock or AO origin. Decide whether a mission
   config can be loaded server-side (by `table_version`).
8. **No announcement frame** for new instance IDs, strings and amplifier
   records (`atak-sidc-server-7w9.8`).
9. **Frame details not in the workbook:** header byte 6 is a fixed `0x08` with
   no name; the optional 8-byte MAC trailer is not built or checked.
10. **Land speed column is not authored**; land tracks always send speed 9.
11. **The position projection is equirectangular** from the AO south-west
    corner. Measure the worst error at 150 km extent and high latitude.

### STANAG 4817 adapter (`src/lib/ctc/adapters/stanag4817.ts`)
12. **Assumptions to confirm against the 4817 schema:** speed is m/s; the echelon
    enum names (only names ending in two digits map today); `description.version
    = "30"` is ignored; there is no confidence field, so it encodes as 0.05.
13. **`extra` fields are dropped** (`fuel_pct`, `comms`, `region`, `sensor`).
    Decide which, if any, become `additionalInformation`.

### Other message formats (blocked on samples)
14. **CoT, SAPIENT and OTH-Gold adapters** (`atak-sidc-server-7w9.5`, `.6`,
    `.7`). Ask the user for real sample messages and the SAPIENT/OTG versions
    before you write code. Confirm "COTS" means CoT.

### Housekeeping
15. **4 lint errors** (`prefer-as-const`) in `src/lib/maplibre/SidcSymbol3DLayer.ts`
    and `SidcSymbolFieldLayer.ts`; they predate the CTC work.
16. **`yarn dev` is pinned to port 8080** in `package.json`, which clashes with
    the local OrbStack container. `yarn dev -p 8417` works because Next uses the
    last `-p`. Consider reading the port from `PORT`.
17. **Page titles read "Create Next App"** on `/` and `/library`.

## Done when

Every gap above is either closed with evidence, matured and verified locally,
or filed in bd as `decision` / `blocked` with the exact question for the user.
All work is committed and pushed (`git pull --rebase && git push`), and
`git rev-list --count @{u}..HEAD` prints `0`.
