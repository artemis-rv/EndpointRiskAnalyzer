/**
 * Parse value as UTC if it's an ISO string without timezone (backend often sends UTC without "Z").
 * @param {string|number|Date} value
 * @returns {Date|null}
 */
function parseAsUTC(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const s = String(value).trim();
  if (!s) return null;
  // If no timezone designator, backend/store typically uses UTC — parse as UTC so IST is correct
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !/Z|[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s + "Z");
  }
  return new Date(s);
}

/**
 * Format a date/time value for display in India Standard Time (IST, UTC+5:30).
 * @param {string|number|Date} value - ISO string, timestamp, or Date (UTC from backend if no Z)
 * @returns {string} Formatted string or "N/A" if invalid
 */
export function formatDateTimeIST(value) {
  const date = parseAsUTC(value);
  if (!date || Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: true,
  });
}
