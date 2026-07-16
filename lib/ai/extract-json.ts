/**
 * Claude often wraps JSON responses in markdown code fences (```json ... ```)
 * even when told not to. A raw JSON.parse on that throws. This strips fences
 * and, as a fallback, slices from the first { or [ to the last } or ].
 */
export function extractJson<T = unknown>(raw: string): T {
  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  if (!text.startsWith("{") && !text.startsWith("[")) {
    const start = text.search(/[{[]/);
    const end   = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }

  return JSON.parse(text) as T;
}
