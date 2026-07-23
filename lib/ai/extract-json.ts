/**
 * Claude often wraps JSON responses in markdown code fences (```json ... ```)
 * even when told not to. A raw JSON.parse on that throws. This strips the
 * OUTER fence and, as a fallback, slices from the first { or [ to the last
 * } or ].
 *
 * Fence stripping only trims the first opening fence and the LAST closing
 * fence in the text — not a naive non-greedy match to the first closing
 * fence. A JSON string value can itself contain an example code block
 * (its own nested ``` pair, e.g. a function signature in a problem
 * statement); matching the first closing fence would truncate the JSON
 * right there and produce invalid JSON.
 */
export function extractJson<T = unknown>(raw: string): T {
  let text = raw.trim();

  if (text.startsWith("```")) {
    const firstNewline   = text.indexOf("\n");
    const lastFenceIndex = text.lastIndexOf("```");
    if (firstNewline !== -1 && lastFenceIndex > firstNewline) {
      text = text.slice(firstNewline + 1, lastFenceIndex).trim();
    }
  }

  if (!text.startsWith("{") && !text.startsWith("[")) {
    const start = text.search(/[{[]/);
    const end   = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }

  return JSON.parse(text) as T;
}
