// These excerpts are for display/navigation only. Never replace the diary body
// with an excerpt when saving, syncing, restoring or exporting a notebook.
const graphemeSegmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("ja", { granularity: "grapheme" })
  : null;

const continuation = /[\p{Mark}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/u;
const regionalIndicator = /[\u{1F1E6}-\u{1F1FF}]/u;

// Older browsers lack Intl.Segmenter. Keep code points intact and conservatively
// group combining marks, emoji modifiers/tags, ZWJ sequences, CRLF and flag pairs.
// This fallback is not a complete Unicode grapheme-boundary implementation.
function* fallbackSegments(value: string): Generator<string> {
  let cluster = "";
  let previous = "";
  let regionalCount = 0;
  for (const point of value) {
    const isRegional = regionalIndicator.test(point);
    const continues = cluster !== "" && (
      continuation.test(point) || point === "\u200d" || previous === "\u200d"
      || (previous === "\r" && point === "\n")
      || (isRegional && regionalCount % 2 === 1)
    );
    if (cluster && !continues) {
      yield cluster;
      cluster = "";
    }
    cluster += point;
    regionalCount = isRegional ? regionalCount + 1 : 0;
    previous = point;
  }
  if (cluster) yield cluster;
}

function* segments(value: string): Generator<string> {
  if (graphemeSegmenter) {
    for (const item of graphemeSegmenter.segment(value)) yield item.segment;
  } else {
    yield* fallbackSegments(value);
  }
}

/** Limit an excerpt by visible character groups, retaining its whitespace. */
export function truncateDisplayText(value: string, maxCharacters: number, suffix = "…"): string {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 0) {
    throw new RangeError("Display text limit must be a non-negative integer");
  }
  let count = 0;
  let excerpt = "";
  for (const segment of segments(value)) {
    if (count >= maxCharacters) return excerpt + suffix;
    excerpt += segment;
    count += 1;
  }
  return value;
}
