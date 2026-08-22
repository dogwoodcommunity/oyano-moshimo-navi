/**
 * 無料で使える範囲の、ただ一つの定義。
 *
 * Web・アプリ・サーバーの3か所で同じ数字を使う。ここ以外に書かない。
 * 画面には「2人目から有料」と出るのに、サーバーは3人まで通す、という
 * ずれが起きると、利用者は理由の分からない拒否に当たることになる。
 */

export type FamilyPlan = "free" | "plus";

/** 無料で作れる手帳（対象者）の数。2冊目からPlus。 */
export const FREE_PLAN_NOTEBOOK_LIMIT = 1;

/** 無料で招待できる人数（手帳を作った本人は数えない）。2人目からPlus。 */
export const FREE_PLAN_MEMBER_LIMIT = 1;

export function isPlus(plan: FamilyPlan | string | null | undefined): boolean {
  return plan === "plus";
}

export function notebookLimitFor(plan: FamilyPlan | string | null | undefined): number | null {
  return isPlus(plan) ? null : FREE_PLAN_NOTEBOOK_LIMIT;
}

export function memberLimitFor(plan: FamilyPlan | string | null | undefined): number | null {
  return isPlus(plan) ? null : FREE_PLAN_MEMBER_LIMIT;
}

export function canCreateNotebook(plan: FamilyPlan | string | null | undefined, current: number): boolean {
  const limit = notebookLimitFor(plan);
  return limit === null || current < limit;
}

/**
 * 断る文言は、断られた人に読ませるもの。
 * 「上限です」で終わらせず、いま持っているものは無事だと必ず添える。
 */
export const NOTEBOOK_LIMIT_MESSAGE =
  `無料で作れる手帳は${FREE_PLAN_NOTEBOOK_LIMIT}冊です。もう1人分をつくるにはPlusが要ります。いまの手帳はこれまで通り使えます。`;

export const MEMBER_LIMIT_MESSAGE =
  `無料で一緒に見られるのは、あなたのほかに${FREE_PLAN_MEMBER_LIMIT}人までです。もう1人ふやすにはPlusが要ります。`;
