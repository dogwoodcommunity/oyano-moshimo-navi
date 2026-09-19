import { PREFECTURES } from "./prefectures";

export const PROVIDER_CATEGORIES = [
  { id: "cleanup", label: "遺品整理・生前整理", checks: "作業範囲、見積もりの内訳、追加費用、貴重品の扱いを確認してください。" },
  { id: "vacant-home", label: "空き家管理", checks: "巡回の頻度、報告方法、緊急時の対応、契約終了の条件を確認してください。" },
  { id: "real-estate", label: "不動産", checks: "売却・賃貸などの対応範囲、費用、契約条件を確認してください。" },
  { id: "demolition", label: "解体", checks: "工事の範囲、見積もりの内訳、追加費用、近隣への対応を確認してください。" },
  { id: "funeral", label: "葬儀", checks: "希望する形式、プランに含まれる内容、追加費用、支払い条件を確認してください。" },
  { id: "care-home", label: "介護施設・老人ホーム", checks: "入居条件、費用、介護・医療への対応、見学の可否を確認してください。" },
  { id: "judicial-scrivener", label: "司法書士", checks: "相談内容への対応範囲、担当者の資格、費用、依頼後の進め方を確認してください。" },
  { id: "tax-accountant", label: "税理士", checks: "相談内容への対応範囲、担当者の資格、費用、申告までの流れを確認してください。" },
  { id: "lawyer", label: "弁護士", checks: "相談内容への対応範囲、担当者の資格、相談料、依頼後の費用を確認してください。" },
  { id: "administrative-scrivener", label: "行政書士", checks: "相談内容への対応範囲、担当者の資格、費用、手続きの進め方を確認してください。" }
] as const;

export type ProviderQuery = {
  prefecture: string;
  city: string;
  categoryId: string;
};

export type ProviderListingRecord = {
  id: string;
  name: string;
  description: string;
  website: string;
  categoryIds: string[];
  areas: Array<{ prefecture: string; cities: string[] }>;
  reviewStatus: "approved" | "draft" | "paused";
  reviewedAt: string;
  publishFrom: string;
  publishUntil: string;
  placement: "sponsored" | "general";
  sponsorPriority?: number;
};

// Keep this public schema explicit: application/contact fields must never escape.
export type PublicProviderListing = {
  id: string;
  name: string;
  description: string;
  website: string;
  categoryIds: string[];
  areas: Array<{ prefecture: string; cities: string[] }>;
  reviewedAt: string;
  publishFrom: string;
  publishUntil: string;
  placement: "sponsored" | "general";
  sponsorPriority?: number;
};

const prefectureIds = new Set<string>(PREFECTURES);
const categoryIds = new Set<string>(PROVIDER_CATEGORIES.map((category) => category.id));
const invisibleCharacters = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/u;
const cityPattern = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々ヶー]+[市区町村]$/u;

export function normalizeProviderCity(city: string): string {
  return typeof city === "string" ? city.normalize("NFKC").replace(/\s/gu, "") : "";
}

function validCity(city: unknown): city is string {
  if (typeof city !== "string" || city.length > 100) return false;
  const normalized = normalizeProviderCity(city);
  return normalized.length <= 40 && cityPattern.test(normalized);
}

export function validateProviderQuery(query: ProviderQuery): string | null {
  if (!isObject(query) || !prefectureIds.has(query.prefecture)) return "都道府県を選んでください。";
  if (!validCity(query.city)) return "市区町村名を入力してください（例：横浜市、世田谷区）。番地は不要です。";
  if (!categoryIds.has(query.categoryId)) return "探したい業種を選んでください。";
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validClock(now: number): boolean {
  return typeof now === "number" && Number.isFinite(now) && Number.isFinite(new Date(now).getTime());
}

// Date.parse alone accepts impossible dates and timezone-less local timestamps.
function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone, , zoneHourText, zoneMinuteText] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]
    || Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) return null;
  if (zone !== "Z" && (Number(zoneHourText) > 14 || Number(zoneMinuteText) > 59
    || (Number(zoneHourText) === 14 && Number(zoneMinuteText) !== 0) || zone === "-00:00")) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength
    && value.trim() === value && !invisibleCharacters.test(value);
}

function validWebsite(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("https://")
    || /[\s\\?#]/u.test(value) || invisibleCharacters.test(value)) return false;
  if (value.slice("https://".length).split("/", 1)[0].includes("@")) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return false;
    const labels = url.hostname.split(".");
    // A public DNS name only; this also rejects normalized decimal/hex IP forms.
    if (labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return false;
    const suffix = labels[labels.length - 1];
    if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]+)$/i.test(suffix)
      || /^(localhost|local|internal|home|lan|invalid|test|onion)$/i.test(suffix)) return false;
    return true;
  } catch {
    return false;
  }
}

function publicListing(value: unknown, now: number, requireApproval: boolean): PublicProviderListing | null {
  if (!isObject(value)) return null;
  if (requireApproval ? value.reviewStatus !== "approved"
    : ("reviewStatus" in value && value.reviewStatus !== "approved")) return null;
  if (typeof value.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(value.id)
    || !validText(value.name, 120) || !validText(value.description, 1000) || !validWebsite(value.website)
    || (value.placement !== "sponsored" && value.placement !== "general")) return null;
  if (value.sponsorPriority !== undefined && (typeof value.sponsorPriority !== "number"
    || !Number.isSafeInteger(value.sponsorPriority) || value.sponsorPriority < 0)) return null;

  const reviewedAt = parseTimestamp(value.reviewedAt);
  const publishFrom = parseTimestamp(value.publishFrom);
  const publishUntil = parseTimestamp(value.publishUntil);
  if (reviewedAt === null || publishFrom === null || publishUntil === null
    || reviewedAt > now || publishFrom >= publishUntil || now < publishFrom || now >= publishUntil) return null;

  if (!Array.isArray(value.categoryIds) || value.categoryIds.length === 0
    || [...value.categoryIds].some((id) => typeof id !== "string" || !categoryIds.has(id))
    || new Set(value.categoryIds).size !== value.categoryIds.length) return null;
  if (!Array.isArray(value.areas) || value.areas.length === 0 || value.areas.length > PREFECTURES.length) return null;
  const areas: PublicProviderListing["areas"] = [];
  const seenPrefectures = new Set<string>();
  for (const area of value.areas) {
    if (!isObject(area) || typeof area.prefecture !== "string" || !prefectureIds.has(area.prefecture)
      || seenPrefectures.has(area.prefecture)) return null;
    seenPrefectures.add(area.prefecture);
    // Even prefecture-wide providers must enumerate reviewed municipalities.
    // A wildcard cannot verify that the user's city belongs to this prefecture.
    if (!Array.isArray(area.cities) || area.cities.length === 0 || [...area.cities].some((city) => !validCity(city))) return null;
    const cities = area.cities.map((city) => normalizeProviderCity(city as string));
    if (new Set(cities).size !== cities.length) return null;
    areas.push({ prefecture: area.prefecture, cities });
  }

  return {
    id: value.id,
    name: value.name,
    description: value.description,
    website: value.website,
    categoryIds: [...value.categoryIds],
    areas,
    reviewedAt: value.reviewedAt as string,
    publishFrom: value.publishFrom as string,
    publishUntil: value.publishUntil as string,
    placement: value.placement,
    ...(value.sponsorPriority !== undefined ? { sponsorPriority: value.sponsorPriority as number } : {})
  };
}

function duplicateIds(records: readonly unknown[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const record of records) {
    if (!isObject(record) || typeof record.id !== "string") continue;
    if (seen.has(record.id)) duplicates.add(record.id);
    seen.add(record.id);
  }
  return duplicates;
}

export function getPublicProviderListings(records: readonly ProviderListingRecord[], now: number): PublicProviderListing[] {
  if (!Array.isArray(records) || !validClock(now)) return [];
  const duplicates = duplicateIds(records);
  const result: PublicProviderListing[] = [];
  for (const record of records) {
    const listing = publicListing(record, now, true);
    if (listing && !duplicates.has(listing.id)) result.push(listing);
  }
  return result;
}

function compareNames(left: PublicProviderListing, right: PublicProviderListing): number {
  // Codepoint order is independent of browser/server locale and ICU versions.
  if (left.name !== right.name) return left.name < right.name ? -1 : 1;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function matchProviderListings(
  listings: readonly PublicProviderListing[],
  query: ProviderQuery,
  now: number
): { sponsored: PublicProviderListing[]; general: PublicProviderListing[] } {
  const result: { sponsored: PublicProviderListing[]; general: PublicProviderListing[] } = { sponsored: [], general: [] };
  if (!Array.isArray(listings) || !validClock(now) || validateProviderQuery(query)) return result;
  const city = normalizeProviderCity(query.city);
  const duplicates = duplicateIds(listings);
  for (const value of listings) {
    // Recheck expiry and schema when searching, including after a tab was left open.
    const listing = publicListing(value, now, false);
    if (!listing || duplicates.has(listing.id) || !listing.categoryIds.includes(query.categoryId)) continue;
    const servesArea = listing.areas.some((area) => area.prefecture === query.prefecture && area.cities.includes(city));
    if (servesArea) result[listing.placement].push(listing);
  }
  result.sponsored.sort((left, right) => (left.sponsorPriority ?? 0) - (right.sponsorPriority ?? 0) || compareNames(left, right));
  result.general.sort(compareNames);
  return result;
}
