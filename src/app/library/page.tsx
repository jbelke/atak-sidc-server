"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ms from "milsymbol";
import type {
  Affiliation,
  Context,
  Echelon,
  SymbolCatalogEntry,
  SymbolCatalogResponse,
} from "@/lib/symbol-catalog/types";
import {
  AFFILIATION_OPTIONS,
  CONTEXT_OPTIONS,
  ECHELON_OPTIONS,
  buildSidc,
} from "@/lib/symbol-catalog/sidc";
import styles from "./library.module.css";

const PAGE_SIZE = 48;

/** The 21 text amplifiers: milsymbol option, label, MIL-STD-2525D field letter. */
const AMPLIFIER_FIELDS: Array<[string, string, string]> = [
  ["additionalInformation", "Additional information", "H"],
  ["altitudeDepth", "Altitude / depth", "X"],
  ["combatEffectiveness", "Combat effectiveness", "K"],
  ["commonIdentifier", "Common identifier", "AF"],
  ["direction", "Direction of movement (deg)", "Q"],
  ["dtg", "Date-time group", "W"],
  ["equipmentTeardownTime", "Equipment teardown time", "AE"],
  ["evaluationRating", "Evaluation rating", "J"],
  ["higherFormation", "Higher formation", "M"],
  ["hostile", "Hostile", "N"],
  ["iffSif", "IFF / SIF", "P"],
  ["location", "Location", "Y"],
  ["platformType", "Platform type", "AD"],
  ["quantity", "Quantity", "C"],
  ["reinforcedReduced", "Reinforced or reduced", "F"],
  ["signatureEquipment", "Signature equipment", "L"],
  ["specialHeadquarters", "Special headquarters", "AA"],
  ["speed", "Speed", "Z"],
  ["staffComments", "Staff comments", "G"],
  ["type", "Type", "V"],
  ["uniqueDesignation", "Unique designation", "T"],
];

/** Each field filled with its own letter, to show where it is drawn. */
const FIELD_LETTER_VALUES: Record<string, string> = Object.fromEntries(
  AMPLIFIER_FIELDS.map(([name, , letter]) => [name, name === "direction" ? "45" : letter])
);

interface QaResult {
  validIcon: boolean;
  affiliation?: string;
  dimension?: string;
  context?: string;
  functionId?: string;
}

function buildSidcForEntry(
  entry: SymbolCatalogEntry,
  affiliation: Affiliation,
  context: Context,
  echelon: Echelon | ""
): string {
  return buildSidc({
    affiliation,
    context,
    symbolSet: entry.symbolSet,
    mainIcon: entry.mainIcon,
    echelon: echelon || undefined,
  });
}

function runQa(sidc: string, standard: "APP6" | "2525"): QaResult {
  try {
    const symbol = new ms.Symbol(sidc, {
      size: 100,
      standard: standard === "2525" ? "2525" : "APP6",
    });
    const meta = symbol.getMetadata?.() ?? {};
    const validIcon = Boolean(
      (symbol as { validIcon?: boolean }).validIcon
    );
    return {
      validIcon,
      affiliation: meta.affiliation as string | undefined,
      dimension: meta.dimension as string | undefined,
      context: meta.context as string | undefined,
      functionId: meta.functionid as string | undefined,
    };
  } catch {
    return { validIcon: false };
  }
}

export default function SymbolLibraryPage(): JSX.Element {
  const [catalog, setCatalog] = useState<SymbolCatalogResponse | null>(null);
  const [query, setQuery] = useState("");
  const [symbolSet, setSymbolSet] = useState("");
  const [affiliation, setAffiliation] = useState<Affiliation>("friend");
  const [context, setContext] = useState<Context>("reality");
  const [echelon, setEchelon] = useState<Echelon | "">("");
  const [standard, setStandard] = useState<"APP6" | "2525">("APP6");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qa, setQa] = useState<QaResult | null>(null);
  const [amplifiers, setAmplifiers] = useState<Record<string, string>>({});
  const [showAmplifiers, setShowAmplifiers] = useState(true);

  const loadCatalog = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (symbolSet) params.set("set", symbolSet);
    params.set("standard", standard);

    const res = await fetch(`/api/catalog?${params.toString()}`);
    const data = (await res.json()) as SymbolCatalogResponse;
    setCatalog(data);
    setPage(0);
  }, [query, symbolSet, standard]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCatalog();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadCatalog]);

  const entries = catalog?.entries ?? [];
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pageEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? pageEntries[0] ?? null,
    [entries, selectedId, pageEntries]
  );

  const activeSidc = selected
    ? buildSidcForEntry(selected, affiliation, context, echelon)
    : "";

  useEffect(() => {
    if (!activeSidc) {
      setQa(null);
      return;
    }
    setQa(runQa(activeSidc, standard));
  }, [activeSidc, standard]);

  const symbolUrl = (sidc: string, ext: string, extra = "") =>
    `/api/${standard}/${sidc}.${ext}?size=120${extra}`;

  const amplifierQuery = useMemo(() => {
    if (!showAmplifiers) return "&amplifiers=off";
    const params = new URLSearchParams();
    for (const [name] of AMPLIFIER_FIELDS) {
      if (amplifiers[name]) params.set(name, amplifiers[name]);
    }
    const query = params.toString();
    return query ? `&${query}` : "";
  }, [amplifiers, showAmplifiers]);

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <a href="/" className={styles.navLink}>← API home</a>
        <h1>Symbol library</h1>
        <p>
          APP-6(D) catalog from STANAG tables — browse, filter, and QA all{" "}
          {catalog?.symbolSets.reduce((n, s) => n + s.count, 0) ?? "…"} main
          icons across {catalog?.symbolSets.length ?? "…"} symbol sets.
        </p>

        <div className={styles.field}>
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="search"
            placeholder="Label, code, entity, remarks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="set">Symbol set</label>
          <select
            id="set"
            value={symbolSet}
            onChange={(e) => setSymbolSet(e.target.value)}
          >
            <option value="">All sets</option>
            {catalog?.symbolSets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="standard">Render standard</label>
          <select
            id="standard"
            value={standard}
            onChange={(e) =>
              setStandard(e.target.value === "2525" ? "2525" : "APP6")
            }
          >
            <option value="APP6">APP-6(D)</option>
            <option value="2525">MIL-STD-2525</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="affiliation">Affiliation</label>
          <select
            id="affiliation"
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value as Affiliation)}
          >
            {AFFILIATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="context">Context</label>
          <select
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value as Context)}
          >
            {CONTEXT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="echelon">Echelon (optional)</label>
          <select
            id="echelon"
            value={echelon}
            onChange={(e) =>
              setEchelon((e.target.value as Echelon) || "")
            }
          >
            <option value="">None</option>
            {ECHELON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <p className={styles.count}>
          Showing {entries.length} match{entries.length === 1 ? "" : "es"}
        </p>
      </aside>

      <section className={styles.main}>
        {pageEntries.length === 0 ? (
          <div className={styles.empty}>No symbols match the current filters.</div>
        ) : (
          <>
            <div className={styles.grid}>
              {pageEntries.map((entry) => {
                const sidc = buildSidcForEntry(
                  entry,
                  affiliation,
                  context,
                  echelon
                );
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`${styles.card} ${
                      selected?.id === entry.id ? styles.cardSelected : ""
                    }`}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <div className={styles.thumb}>
                      <img
                        src={symbolUrl(sidc, "svg")}
                        alt=""
                        width={80}
                        height={80}
                        loading="lazy"
                      />
                    </div>
                    <div className={styles.cardLabel}>{entry.label}</div>
                    <div className={styles.cardMeta}>
                      {entry.symbolSetName} · {entry.mainIcon}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className={styles.pagination}>
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {page + 1} of {pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      <aside className={styles.detail}>
        {selected ? (
          <>
            <h2>{selected.label}</h2>
            {qa && (
              <span
                className={`${styles.qaBadge} ${
                  qa.validIcon ? styles.qaPass : styles.qaFail
                }`}
              >
                {qa.validIcon ? "QA pass — valid icon" : "QA fail — no icon"}
              </span>
            )}
            <div className={styles.previewLarge}>
              <img
                src={symbolUrl(activeSidc, "svg", `&width=200&height=200${amplifierQuery}`)}
                alt={selected.label}
                width={280}
                height={200}
              />
            </div>
            <section className={styles.amplifiers}>
              <div className={styles.amplifierBar}>
                <label>
                  <input
                    type="checkbox"
                    checked={showAmplifiers}
                    onChange={(e) => setShowAmplifiers(e.target.checked)}
                  />{" "}
                  Show text amplifiers
                </label>
                <button type="button" onClick={() => setAmplifiers(FIELD_LETTER_VALUES)}>
                  Field letters
                </button>
                <button type="button" onClick={() => setAmplifiers({})}>
                  Clear
                </button>
              </div>
              <div className={styles.amplifierGrid}>
                {AMPLIFIER_FIELDS.map(([name, label, letter]) => (
                  <label key={name}>
                    <span>
                      {label} <code>{letter}</code>
                    </span>
                    <input
                      value={amplifiers[name] ?? ""}
                      disabled={!showAmplifiers}
                      onChange={(e) =>
                        setAmplifiers((current) => ({ ...current, [name]: e.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
            <table className={styles.metaTable}>
              <tbody>
                <tr>
                  <th>SIDC</th>
                  <td><code>{activeSidc}</code></td>
                </tr>
                <tr>
                  <th>Symbol set</th>
                  <td>{selected.symbolSetName} ({selected.symbolSet})</td>
                </tr>
                <tr>
                  <th>Main icon</th>
                  <td>{selected.mainIcon}</td>
                </tr>
                {qa?.affiliation && (
                  <tr>
                    <th>Decoded affiliation</th>
                    <td>{qa.affiliation}</td>
                  </tr>
                )}
                {qa?.dimension && (
                  <tr>
                    <th>Battle dimension</th>
                    <td>{qa.dimension}</td>
                  </tr>
                )}
                {qa?.context && (
                  <tr>
                    <th>Decoded context</th>
                    <td>{qa.context}</td>
                  </tr>
                )}
                {selected.remarks && (
                  <tr>
                    <th>Remarks</th>
                    <td>{selected.remarks}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className={styles.links}>
              <a href={symbolUrl(activeSidc, "svg", amplifierQuery)} target="_blank" rel="noreferrer">
                SVG
              </a>
              <a href={symbolUrl(activeSidc, "png", amplifierQuery)} target="_blank" rel="noreferrer">
                PNG
              </a>
              <a
                href={`/api/${standard}/${activeSidc}.glb?depth=8&targetSize=80`}
                target="_blank"
                rel="noreferrer"
              >
                GLB
              </a>
              <a
                href={`/api/${standard}/${activeSidc}.mesh?depth=8`}
                target="_blank"
                rel="noreferrer"
              >
                Mesh JSON
              </a>
              <a
                href={`/preview/maplibre?sidc=${activeSidc}&standard=${standard}`}
                target="_blank"
                rel="noreferrer"
              >
                MapLibre 3D
              </a>
            </div>
          </>
        ) : (
          <p className={styles.empty}>Select a symbol to inspect.</p>
        )}
      </aside>
    </div>
  );
}
