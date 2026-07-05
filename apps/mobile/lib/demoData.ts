import { buildDiagnosisResult, type DiagnosisAnswers, type ParentStatus } from "@oyano/shared";

export const demoPerson = {
  id: "00000000-0000-4000-8000-000000000101",
  displayName: "母",
  relationship: "親",
  currentStatus: "hospitalized" as ParentStatus
};

const answers: DiagnosisAnswers = {
  selectedStatus: demoPerson.currentStatus,
  parentSituation: "長期入院中。退院後の生活場所を相談している。",
  familyStructure: "母、長男、長女",
  hasHome: "yes",
  knowsAssets: "some",
  concerns: ["期限がある手続き", "家族の役割分担", "実家の片付け"],
  homeClearance: "鍵の場所は兄が把握。写真は未登録。"
};

export const demoResult = buildDiagnosisResult(answers);

export const demoTimeline = [
  { id: "t1", title: "入院した", date: "2026-07-01", body: "病院の窓口を確認。" },
  { id: "t2", title: "書類を見つけた", date: "2026-07-03", body: "保険証券らしき封筒あり。" }
];
