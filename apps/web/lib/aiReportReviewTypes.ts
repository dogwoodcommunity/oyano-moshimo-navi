import type { ConsultAnswer } from "@oyano/shared";

export const AI_REPORT_REASON_LABELS: Record<string, string> = {
  unsafe: "危険な行動の提案", inappropriate: "不快・差別的な内容", incorrect: "誤った情報", other: "その他"
};
export const AI_REPORT_REVIEW_OPTIONS = [
  { status: "reviewing", outcome: "investigating", label: "確認中" },
  { status: "action_required", outcome: "unsafe_content", label: "要対応：危険な提案" },
  { status: "action_required", outcome: "incorrect_content", label: "要対応：誤情報" },
  { status: "action_required", outcome: "inappropriate_content", label: "要対応：不適切な表現" },
  { status: "action_required", outcome: "other_issue", label: "要対応：その他" },
  { status: "closed", outcome: "no_issue", label: "完了：問題を確認できず" },
  { status: "closed", outcome: "corrected", label: "完了：修正と確認済み" },
  { status: "closed", outcome: "content_unavailable", label: "完了：本文削除等により確認不能" }
] as const;
export type AiReportReviewChoice = typeof AI_REPORT_REVIEW_OPTIONS[number];
export type AiReportReview = {
  revision: number;
  status: "received" | AiReportReviewChoice["status"];
  outcome: AiReportReviewChoice["outcome"] | null;
  updatedAt: string | null;
  operatorId: string | null;
};
export type AiReportSummary = { id: string; reason: string; createdAt: string | null; review: AiReportReview };
export type AiReportDetail = AiReportSummary & {
  content: { question: string; answer: ConsultAnswer } | null;
  reviews: AiReportReview[];
};
export function aiReportReviewLabel(review: AiReportReview) {
  return review.status === "received" ? "未確認" : AI_REPORT_REVIEW_OPTIONS.find((option) =>
    option.status === review.status && option.outcome === review.outcome)?.label ?? "状態を確認できません";
}
