/**
 * 測るのは1つの数字だけ。
 *   危機モードを開いた人のうち、対象者を登録し、7日以内に2件目の記録を書いた割合。
 *
 * イベントはこの5つに絞る。増やすほど、何を見ればよいか分からなくなる。
 */
export const FUNNEL_EVENTS = [
  "crisis_opened",
  "crisis_saved",
  "person_created",
  "record_written",
  "consult_asked"
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export type FunnelSummary = {
  days: number;
  crisisOpened: number;
  crisisOpenedApp: number;
  crisisOpenedWeb: number;
  personCreated: number;
  returnedWithin7Days: number;
  eventTotals: Record<string, number>;
};

export function funnelRate(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${Math.round((numerator / denominator) * 1000) / 10}%`;
}
