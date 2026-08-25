export function readBoundedNumber(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

/** 1回ごとに外部API費用が出るため、利用者・家族・サービス全体に上限を置く。 */
export const CONSULT_PER_CLIENT_DAILY_LIMIT = readBoundedNumber(
  process.env.CONSULT_CLIENT_DAILY_LIMIT,
  5,
  1,
  10
);

export const CONSULT_PER_FAMILY_MONTHLY_LIMIT = readBoundedNumber(
  process.env.CONSULT_FAMILY_MONTHLY_LIMIT,
  30,
  1,
  500
);

export const CONSULT_SERVICE_DAILY_LIMIT = readBoundedNumber(
  process.env.CONSULT_DAILY_LIMIT,
  50,
  1,
  5_000
);

export const CONSULT_MAX_OUTPUT_TOKENS = readBoundedNumber(
  process.env.CONSULT_MAX_OUTPUT_TOKENS,
  1_600,
  800,
  2_000
);

// Claude Sonnet 4.6 standard pricing as of 2026-08-23.
export const CONSULT_INPUT_USD_PER_MILLION_TOKENS = 3;
export const CONSULT_OUTPUT_USD_PER_MILLION_TOKENS = 15;
export const CONSULT_COST_USD_JPY_RATE = 150;

export function currentJstMonthStart(now = new Date()): string {
  const jstOffsetMs = 9 * 60 * 60 * 1_000;
  const jst = new Date(now.getTime() + jstOffsetMs);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - jstOffsetMs).toISOString();
}

export function currentJstDayStart(now = new Date()): string {
  const jstOffsetMs = 9 * 60 * 60 * 1_000;
  const jst = new Date(now.getTime() + jstOffsetMs);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - jstOffsetMs).toISOString();
}

export function wasUsedOnCurrentJstDay(usedAt: string | null | undefined, now = new Date()): boolean {
  if (!usedAt) return false;
  const usedAtMs = Date.parse(usedAt);
  if (!Number.isFinite(usedAtMs)) return false;
  return usedAtMs >= Date.parse(currentJstDayStart(now));
}
