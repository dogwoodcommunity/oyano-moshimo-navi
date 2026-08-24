const JAPAN_TIME_ZONE = "Asia/Tokyo";

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function japanDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: JAPAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  return `${partValue(parts, "year")}-${partValue(parts, "month")}-${partValue(parts, "day")}`;
}

export function japanDateInputAfterDays(days: number, date = new Date()) {
  return japanDateInputValue(new Date(date.getTime() + days * 24 * 60 * 60 * 1000));
}
