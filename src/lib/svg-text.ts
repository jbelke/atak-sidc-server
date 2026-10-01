/** Height of the middle of Arial capitals above the baseline, as a share of font size. */
const ARIAL_MID_CAP = 15 / 42;

/**
 * milsymbol centres some labels (field AA, tactical point labels) with
 * alignment-baseline="middle". Browsers honour it; librsvg, which sharp uses
 * for raster output, does not, so the text lands half a line too high.
 * Rewrite those labels to a plain baseline at the same visual position.
 * A 42 px label moves down 15 px, which is where milsymbol 2 drew it.
 */
export function centreTextBaselines(svg: string): string {
  return svg.replace(/<text\b[^>]*\balignment-baseline="middle"[^>]*>/g, (tag) => {
    const y = tag.match(/\by="([-\d.]+)"/);
    const size = tag.match(/\bfont-size="([\d.]+)"/);
    if (!y || !size) return tag;
    const baseline = Math.round((Number(y[1]) + Number(size[1]) * ARIAL_MID_CAP) * 100) / 100;
    return tag
      .replace(/\s*\balignment-baseline="middle"/, "")
      .replace(/\by="[-\d.]+"/, `y="${baseline}"`);
  });
}
