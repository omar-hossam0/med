/**
 * Display-only formatting helpers.
 *
 * Backend account records may store names in any casing (e.g. "omar hossam").
 * These helpers normalise names for presentation without altering the stored
 * value or the authenticated user object.
 */

/** Capitalise the first letter of each word: "omar hossam" -> "Omar Hossam". */
export function formatPersonName(value?: string | null): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** First name only, using the same capitalisation rules. */
export function formatFirstName(value?: string | null): string {
  return formatPersonName(value).split(" ")[0] ?? "";
}
