"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { FREE_PLAN_MEMBER_LIMIT, statusLabel, targetLabel } from "@oyano/shared";
import { MonitorTestReminder } from "@/components/MonitorTestReminder";
import { completeBrowserSupabaseAuthFromUrl, getBrowserSupabase, sendNotebookMagicLink } from "@/lib/browserSupabase";
import { japanDateInputAfterDays, japanDateInputValue } from "@/lib/date";
import { PREFECTURES } from "@/lib/prefectures";
import { markMonitorActivity } from "@/lib/monitorSession";
import {
  addCaseTask,
  addDiaryEntry,
  consumeNotebookStorageWarning,
  createLocalId,
  diaryAdvice,
  diaryCompanionComment,
  exportNotebookData,
  listDiaryEntries,
  listLocalCases,
  readCanManageFamilyBilling,
  replaceLocalNotebook,
  resetLocalNotebookData,
  updateDiaryEntry,
  updateCaseProfile,
  writeCanManageFamilyBilling,
  writePlan,
  updateCaseTask,
  type CaseRecord,
  type DiaryAttachment,
  type DiaryEntry,
  type EditableTask,
  type PersonProfile,
  type TaskProgress
} from "@/lib/store";

type DiaryFormState = {
  date: string;
  body: string;
  mood: DiaryEntry["mood"];
  files: DiaryAttachment[];
};

type DiaryEditForm = {
  date: string;
  mood: DiaryEntry["mood"];
  body: string;
};

type TaskWithDue = NonNullable<CaseRecord["result"]>["tasks"][number];
type TaskEditForm = {
  title: string;
  description: string;
  dueDate: string;
  priority: "1" | "2" | "3";
  progress: Exclude<TaskProgress, "skipped">;
  assignee: string;
  note: string;
};
type RecordFilter = "all" | "changed" | "attachments";
type CloudStatus = "idle" | "checking" | "sending" | "sent" | "syncing" | "synced" | "error";
type CloudAutoStatus = "idle" | "saving" | "saved" | "error";
type NotebookTab = "overview" | "record" | "profile" | "tasks" | "media";
type HandbookStepState = "done" | "now" | "next";
type ConsultDraft = {
  caseId: string;
  entryId?: string;
  sourceLabel: string;
  question: string;
};
type NotebookSyncPayload = {
  cases: CaseRecord[];
  diaryEntries: DiaryEntry[];
};
type PrefecturePromptDraft = {
  parentPrefecture: string;
  parentCity: string;
};

type DiaryCalendarCell = {
  key: string;
  date: string;
  day: number | null;
  count: number;
  tone: "none" | "stable" | "changed" | "urgent";
};

const notebookTabs: { id: NotebookTab; label: string; note: string }[] = [
  { id: "overview", label: "今日", note: "まず見る" },
  { id: "record", label: "記録", note: "書く・見返す" },
  { id: "profile", label: "基本情報", note: "プロフィール" },
  { id: "tasks", label: "確認", note: "やること" },
  { id: "media", label: "写真", note: "アルバム" }
];

const handbookStepLabels: Record<HandbookStepState, string> = {
  done: "入力あり",
  now: "次におすすめ",
  next: "あとで"
};

function blankDiaryForm(): DiaryFormState {
  return {
    date: todayInputValue(),
    body: "",
    mood: "stable",
    files: []
  };
}

const emptyDiaryForm: DiaryFormState = blankDiaryForm();

const MAX_LOCAL_PHOTO_COUNT = 3;
const MAX_LOCAL_PHOTO_EDGE = 1280;
const LOCAL_PHOTO_QUALITY = 0.78;
type PreparedPhoto = {
  attachment: DiaryAttachment;
  blob: Blob;
  warning?: string;
};

const healthNotes = [
  { tone: "meal", title: "食事・水分", note: "食事や水分量が気になる" },
  { tone: "medicine", title: "薬・服薬", note: "薬・服薬で気になることがある" },
  { tone: "condition", title: "体調", note: "体調に変化があった" },
  { tone: "walking", title: "歩行・転倒", note: "歩行・転倒が心配" },
  { tone: "mood", title: "発言・気分", note: "物忘れ・発言の変化があった" },
  { tone: "contact", title: "病院・介護先", note: "病院・介護先から連絡があった" }
];

const journeyCopy = {
  status: {
    label: "最初",
    title: "いまの状況を1人分にまとめる",
    body: "入院、退院後の在宅、介護、亡くなった後など、まずはこの人だけの手帳を作ります。"
  },
  diary: {
    label: "日々",
    title: "変化を1行ずつ残す",
    body: "体調、発言、病院・介護先からの連絡、家族で決めたことを日付つきで残します。"
  },
  care: {
    label: "連絡",
    title: "病院・介護・家族の窓口を決める",
    body: "誰が病院へ聞くか、誰が支払いを見るかを決めて、家族の連絡迷子を減らします。"
  },
  documents: {
    label: "保管",
    title: "書類・鍵・写真を探せる状態にする",
    body: "暗証番号は預からず、存在と保管場所だけを残します。実家の写真も日記にまとめます。"
  },
  wishes: {
    label: "希望",
    title: "大事にしたいことを家族で共有する",
    body: "本人の希望、会わせたい人、避けたい対応などを、断定ではなく家族の確認メモとして残します。"
  }
} as const;

const continuationFeatures = [
  {
    label: "共有",
    title: "家族にも同じ手帳を見せる",
    body: "病院へ聞く人、支払いを見る人、写真を残す人を分けて、同じ状況を見ながら進められます。"
  },
  {
    label: "複数",
    title: "2人目以降も切り替えて管理する",
    body: "父、母、義母、親戚など、1人ずつ状態が違っても手帳を分けて残せます。"
  },
  {
    label: "相談",
    title: "AI相談チャットで次の一歩を聞く",
    body: "毎回ゼロから説明せず、この人のプロフィールと日々の記録を前提に、次に聞くことを整理します。"
  },
  {
    label: "月次",
    title: "家族会議用にまとめる",
    body: "1か月の変化、写真、未確認リストをまとめて、家族や支援者に説明しやすくします。"
  }
];

const relationshipLabels = {
  mother: "母",
  father: "父",
  mother_in_law: "義母",
  father_in_law: "義父",
  grandparent: "祖父母",
  other: "親族・その他"
} as const;

function progressLabel(caseRecord: CaseRecord) {
  if (caseRecord.status === "result_ready" || caseRecord.status === "converted") return "管理中";
  if (caseRecord.status === "submitted") return "確認中";
  return "入力途中";
}

function todayInputValue() {
  return japanDateInputValue();
}

function dateInputAfterDays(days: number) {
  return japanDateInputAfterDays(days);
}

function formatDate(dateString?: string) {
  if (!dateString) return "未設定";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatLongDate(dateString?: string) {
  if (!dateString) return "日付なし";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function clipText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function daysUntil(dateString?: string) {
  if (!dateString) return null;
  const today = new Date(todayInputValue()).getTime();
  const due = new Date(`${dateString}T00:00:00`).getTime();
  if (Number.isNaN(due)) return null;
  return Math.ceil((due - today) / 86400000);
}

function daysSince(dateString?: string) {
  if (!dateString) return null;
  const today = new Date(`${todayInputValue()}T00:00:00`).getTime();
  const target = new Date(`${dateString}T00:00:00`).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.floor((today - target) / 86400000));
}

function dueText(task?: TaskWithDue) {
  const days = daysUntil(task?.dueDate);
  if (!task) return "確認リスト未作成";
  if (days === null) return `期限 ${task.dueDate}`;
  if (days < 0) return `${Math.abs(days)}日超過`;
  if (days === 0) return "今日";
  return `あと${days}日`;
}

function taskEditKey(caseId: string, taskIndex: number) {
  return `${caseId}:${taskIndex}`;
}

function taskPriorityValue(value: TaskEditForm["priority"]): 1 | 2 | 3 {
  if (value === "1") return 1;
  if (value === "3") return 3;
  return 2;
}

function taskPriorityText(priority?: number) {
  if (priority === 1) return "急ぎ";
  if (priority === 3) return "あとで";
  return "通常";
}

function taskProgressLabel(progress?: TaskProgress) {
  if (progress === "done") return "完了";
  if (progress === "doing") return "進行中";
  if (progress === "skipped") return "不要";
  return "未着手";
}

function taskFormSeed(task: TaskWithDue): TaskEditForm {
  const priority = task.priority === 1 ? "1" : task.priority === 3 ? "3" : "2";
  const progress = task.progress === "doing" || task.progress === "done" ? task.progress : "todo";
  return {
    title: task.title ?? "",
    description: task.description ?? "",
    dueDate: task.dueDate ?? todayInputValue(),
    priority,
    progress,
    assignee: task.assignee ?? "",
    note: task.note ?? ""
  };
}

function blankTaskForm(): TaskEditForm {
  return {
    title: "",
    description: "",
    dueDate: dateInputAfterDays(7),
    priority: "2",
    progress: "todo",
    assignee: "",
    note: ""
  };
}

function diaryEditSeed(entry: DiaryEntry): DiaryEditForm {
  return {
    date: entry.date,
    mood: entry.mood,
    body: entry.body
  };
}

function diaryTaskTitle(entry: DiaryEntry) {
  const text = entry.body;
  if (/薬|服薬|飲み忘れ/.test(text)) return "薬・服薬について確認する";
  if (/病院|退院|通院|医師|看護|訪問/.test(text)) return "病院・ケア先に次の予定を確認する";
  if (/認知|忘れ|徘徊|怒|混乱|発言/.test(text)) return "気になる発言・様子を家族で共有する";
  if (/支払|請求|保険|年金|通帳/.test(text)) return "支払い・書類の場所を確認する";
  if (/家|実家|鍵|片付|写真|荷物|書類/.test(text)) return "実家・書類の場所を写真で残す";
  return "この日の記録から家族で確認する";
}

function readFileAsDataUrl(file: Blob): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function photoUploadName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "photo";
  return `${baseName}.jpg`;
}

async function prepareLocalPhoto(file: File): Promise<PreparedPhoto | null> {
  if (!file.type.startsWith("image/")) return null;

  const fallbackUrl = await readFileAsDataUrl(file);
  let previewUrl = fallbackUrl;
  let uploadBlob: Blob = file;
  let uploadType = file.type || "image/jpeg";
  let compressedSize = file.size;
  let warning: string | undefined;

  if (typeof document !== "undefined" && fallbackUrl) {
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = fallbackUrl;
      });
      const scale = Math.min(1, MAX_LOCAL_PHOTO_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(image, 0, 0, width, height);
        const compressedBlob = await canvasToBlob(canvas, "image/jpeg", LOCAL_PHOTO_QUALITY);
        if (compressedBlob) {
          uploadBlob = compressedBlob;
          uploadType = "image/jpeg";
          compressedSize = compressedBlob.size;
          previewUrl = await readFileAsDataUrl(compressedBlob) ?? previewUrl;
        }
      }
    } catch {
      warning = "写真を軽くできませんでした。容量が大きい場合は保存できないことがあります。";
    }
  }

  if (file.size > compressedSize + 64_000) {
    warning = "写真を軽くして追加しました。メール確認済みなら、クラウドにも保存します。";
  }

  return {
    attachment: {
      id: createLocalId("attachment"),
      name: uploadType === "image/jpeg" ? photoUploadName(file.name) : file.name,
      type: uploadType,
      size: compressedSize,
      previewUrl,
      uploadStatus: "local"
    },
    blob: uploadBlob,
    warning
  };
}

function personName(caseRecord: CaseRecord) {
  const displayName = caseRecord.personProfile?.displayName?.trim();
  if (displayName) return displayName;

  return targetLabel({
    targetRelationship: caseRecord.answers.targetRelationship,
    targetName: caseRecord.answers.targetName,
    additionalTargets: []
  });
}

function relationshipName(caseRecord: CaseRecord) {
  const relationship = caseRecord.answers.targetRelationship ?? "mother";
  return relationshipLabels[relationship] ?? "家族";
}

function profileSeed(caseRecord: CaseRecord): PersonProfile {
  const profile = caseRecord.personProfile ?? {};
  const targetName = caseRecord.answers.targetName?.trim() ?? "";
  return {
    fullName: profile.fullName ?? targetName,
    displayName: profile.displayName ?? personName(caseRecord),
    relationship: profile.relationship ?? relationshipName(caseRecord),
    birthDate: profile.birthDate ?? "",
    parentPrefecture: profile.parentPrefecture ?? "",
    parentCity: profile.parentCity ?? "",
    userPrefecture: profile.userPrefecture ?? "",
    careStatus: profile.careStatus ?? statusLabel(caseRecord.selectedStatus),
    keyContact: profile.keyContact ?? "",
    hospitalOrFacility: profile.hospitalOrFacility ?? "",
    medicationNote: profile.medicationNote ?? "",
    documentLocationNote: profile.documentLocationNote ?? "",
    familyStructureNote: profile.familyStructureNote ?? caseRecord.answers.familyStructure ?? "",
    emergencyContact: profile.emergencyContact ?? "",
    carePreference: profile.carePreference ?? "",
    importantPeopleNote: profile.importantPeopleNote ?? ""
  };
}

function profileCompletion(profile: PersonProfile) {
  const fields = [
    profile.fullName,
    profile.displayName,
    profile.relationship,
    profile.parentPrefecture,
    profile.parentCity,
    profile.birthDate,
    profile.careStatus,
    profile.keyContact,
    profile.hospitalOrFacility,
    profile.medicationNote,
    profile.documentLocationNote,
    profile.familyStructureNote,
    profile.emergencyContact,
    profile.carePreference,
    profile.importantPeopleNote
  ];
  const filled = fields.filter((item) => item?.trim()).length;
  const total = fields.length;
  return {
    filled,
    total,
    percent: Math.round((filled / total) * 100)
  };
}

function missingProfileItems(profile: PersonProfile) {
  const items = [
    ["フルネーム", profile.fullName],
    ["呼び名", profile.displayName],
    ["関係", profile.relationship],
    ["親御さんの都道府県", profile.parentPrefecture],
    ["親御さんの市区町村", profile.parentCity],
    ["生年月日", profile.birthDate],
    ["いまの状態", profile.careStatus],
    ["主な連絡窓口", profile.keyContact],
    ["病院・施設・ケア先", profile.hospitalOrFacility],
    ["薬・注意点", profile.medicationNote],
    ["書類・鍵の保管メモ", profile.documentLocationNote],
    ["家族構成", profile.familyStructureNote],
    ["緊急連絡先", profile.emergencyContact],
    ["ケアで大事にしたいこと", profile.carePreference],
    ["会わせたい人・伝えたいこと", profile.importantPeopleNote]
  ] as const;

  return items.filter(([, value]) => !value?.trim()).map(([label]) => label);
}

function summarizeProfile(caseRecord: CaseRecord, profile: PersonProfile) {
  return [
    { label: "呼び名", value: profile.displayName || personName(caseRecord) },
    {
      label: "親の地域",
      value: profile.parentPrefecture
        ? `${profile.parentPrefecture}${profile.parentCity ? ` ${profile.parentCity}` : ""}`
        : "未入力"
    },
    { label: "生年月日", value: profile.birthDate || "未入力" },
    { label: "病院・ケア", value: profile.hospitalOrFacility || "未入力" },
    { label: "緊急連絡", value: profile.emergencyContact || profile.keyContact || "未入力" },
    { label: "大事な希望", value: profile.carePreference || "未入力" },
    { label: "書類・鍵", value: profile.documentLocationNote || "未入力" }
  ];
}

function moodLabel(mood: DiaryEntry["mood"]) {
  if (mood === "urgent") return "急ぎ";
  if (mood === "changed") return "変化あり";
  return "通常";
}

function groupDiaryEntries(entries: DiaryEntry[]) {
  const groups = new Map<string, DiaryEntry[]>();
  entries.forEach((entry) => {
    const key = entry.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });

  return Array.from(groups.entries()).map(([month, items]) => ({
    month,
    items,
    changedCount: items.filter((entry) => entry.mood === "changed" || entry.mood === "urgent").length,
    attachmentCount: items.reduce((sum, entry) => sum + entry.attachments.length, 0)
  }));
}

const diaryCalendarWeekdays = ["日", "月", "火", "水", "木", "金", "土"];

function monthInputValue(dateString?: string) {
  return (dateString || todayInputValue()).slice(0, 7);
}

function shiftMonth(month: string, offset: number) {
  const [rawYear, rawMonth] = month.split("-").map(Number);
  const date = new Date(rawYear, rawMonth - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthTitle(month: string) {
  const [rawYear, rawMonth] = month.split("-");
  return `${rawYear}年${Number(rawMonth)}月`;
}

function buildDiaryCalendar(entries: DiaryEntry[], month: string): DiaryCalendarCell[] {
  const [rawYear, rawMonth] = month.split("-").map(Number);
  const firstDate = new Date(rawYear, rawMonth - 1, 1);
  const dayCount = new Date(rawYear, rawMonth, 0).getDate();
  const byDate = new Map<string, DiaryEntry[]>();
  entries.forEach((entry) => {
    if (!entry.date.startsWith(month)) return;
    byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
  });

  const cells: DiaryCalendarCell[] = Array.from({ length: firstDate.getDay() }, (_, index) => ({
    key: `blank-${month}-${index}`,
    date: "",
    day: null,
    count: 0,
    tone: "none"
  }));

  for (let day = 1; day <= dayCount; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const dayEntries = byDate.get(date) ?? [];
    const tone = dayEntries.some((entry) => entry.mood === "urgent")
      ? "urgent"
      : dayEntries.some((entry) => entry.mood === "changed")
        ? "changed"
        : dayEntries.length > 0
          ? "stable"
          : "none";
    cells.push({
      key: date,
      date,
      day,
      count: dayEntries.length,
      tone
    });
  }

  return cells;
}

function monthLabel(month: string) {
  const [, rawMonth] = month.split("-");
  return `${Number(rawMonth)}月の記録`;
}

function buildMonthReview(entries: DiaryEntry[], profile: PersonProfile | undefined) {
  const text = entries.map((entry) => entry.body).join("\n");
  const urgentCount = entries.filter((entry) => entry.mood === "urgent").length;
  const changedCount = entries.filter((entry) => entry.mood === "changed").length;
  const attachmentCount = entries.reduce((sum, entry) => sum + entry.attachments.length, 0);
  const facts = [
    `${entries.length}件の記録`,
    `変化 ${changedCount + urgentCount}件`,
    `写真 ${attachmentCount}件`
  ];
  let tone: "urgent" | "changed" | "steady" = "steady";
  let title = "この月は、日々の様子を見返せます";
  let body = "変化が大きい日だけでなく、いつも通りの日も残っていると、あとから家族で状況を説明しやすくなります。";

  if (urgentCount > 0) {
    tone = "urgent";
    title = "急ぎの記録がある月です";
    body = "急な変化、病院・介護先からの連絡、家族で決めたことを優先して見返してください。";
  } else if (changedCount > 0) {
    tone = "changed";
    title = "変化が残っている月です";
    body = "通院や家族会議で説明できるように、変化した日とその後の様子を続けて確認しましょう。";
  } else if (entries.length >= 3) {
    title = "記録の流れが見えてきています";
    body = "同じ調子で1行ずつ残すと、数週間後に「いつから変わったか」を家族で振り返れます。";
  }

  const questions = new Set<string>();
  if (/退院|在宅|訪問|通院/.test(text)) questions.add("次回通院、訪問サービス、送迎担当は決まっていますか？");
  if (/薬|服薬|飲み忘れ/.test(text)) questions.add("薬の変更日、飲み忘れ、誰に相談したかを残せていますか？");
  if (/忘れ|認知|混乱|徘徊|発言/.test(text)) questions.add("実際の発言、日時、場所を事実として残せていますか？");
  if (/支払|請求|保険|年金/.test(text)) questions.add("支払い・保険・年金の書類の場所は家族で分かりますか？");
  if (/家|実家|鍵|片付|写真|荷物|書類/.test(text)) questions.add("鍵、重要書類、部屋の状態を写真で残しましたか？");
  if (!profile?.hospitalOrFacility?.trim()) questions.add("病院・施設・ケア先の窓口はプロフィールに入っていますか？");
  if (!profile?.emergencyContact?.trim() && !profile?.keyContact?.trim()) questions.add("緊急時に最初に連絡する人は決まっていますか？");
  if (questions.size === 0) questions.add("次に家族へ共有したいことを1つだけ選ぶなら何ですか？");

  const latestEntry = entries[0];
  const familyLine = latestEntry
    ? `今月の共有メモ: ${formatLongDate(latestEntry.date)}「${clipText(latestEntry.body, 54)}」。次は「${Array.from(questions)[0]}」を確認します。`
    : "今月の共有メモ: まだ記録がありません。まず今日の様子を1行だけ残します。";

  return {
    tone,
    title,
    body,
    facts,
    questions: Array.from(questions).slice(0, 3),
    familyLine
  };
}

function MonthReview({
  entries,
  profile,
  onConsult
}: {
  entries: DiaryEntry[];
  profile: PersonProfile | undefined;
  onConsult?: (question: string) => void;
}) {
  const review = buildMonthReview(entries, profile);
  const consultQuestion = buildDigestConsultQuestion(entries, profile, review.body);

  return (
    <div className={`month-review is-${review.tone}`}>
      <div>
        <span>この月の記録から自動で作ったまとめ</span>
        <strong>{review.title}</strong>
        <p>{review.body}</p>
        <small className="month-review-update-note">記録を追加・編集すると、この内容も自動で変わります。</small>
      </div>
      <div className="month-review-facts" aria-label="この月の集計">
        {review.facts.map((fact) => <em key={fact}>{fact}</em>)}
      </div>
      <div className="month-review-questions">
        <span>次に確認すること</span>
        <ul>
          {review.questions.map((question) => <li key={question}>{question}</li>)}
        </ul>
      </div>
      <div className="month-review-family-line">
        <span>家族に共有する一文</span>
        <p>{review.familyLine}</p>
      </div>
      {onConsult ? (
        <button className="month-review-consult" type="button" onClick={() => onConsult(consultQuestion)}>
          この月の記録まとめでAIに相談する
        </button>
      ) : (
        <Link className="month-review-consult" href={consultHref("", consultQuestion)}>この月の記録まとめでAIに相談する</Link>
      )}
    </div>
  );
}

function DiaryCalendar({
  entries,
  month,
  selectedDate,
  onMonthChange,
  onSelectDate,
  onClearDate
}: {
  entries: DiaryEntry[];
  month: string;
  selectedDate: string | null;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
  onClearDate: () => void;
}) {
  const cells = buildDiaryCalendar(entries, month);
  const selectedEntries = selectedDate ? entries.filter((entry) => entry.date === selectedDate) : [];

  return (
    <div className="record-calendar-card">
      <div className="record-calendar-head">
        <button type="button" onClick={() => onMonthChange(shiftMonth(month, -1))} aria-label="前の月を見る">‹</button>
        <strong>{formatMonthTitle(month)}</strong>
        <button type="button" onClick={() => onMonthChange(shiftMonth(month, 1))} aria-label="次の月を見る">›</button>
      </div>
      <div className="record-calendar-weekdays" aria-hidden="true">
        {diaryCalendarWeekdays.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="record-calendar-grid" aria-label="日付から記録を探す">
        {cells.map((cell) => (
          cell.day ? (
            <button
              aria-label={`${Number(month.slice(5, 7))}月${cell.day}日、${cell.count > 0 ? `記録${cell.count}件` : "記録なし"}`}
              className={[
                "record-calendar-day",
                cell.count > 0 ? "has-entry" : "",
                cell.tone !== "none" ? `is-${cell.tone}` : "",
                selectedDate === cell.date ? "is-selected" : ""
              ].filter(Boolean).join(" ")}
              key={cell.key}
              type="button"
              onClick={() => onSelectDate(cell.date)}
            >
              <span>{cell.day}</span>
              {cell.count > 0 ? <small>{cell.count}</small> : null}
            </button>
          ) : (
            <span className="record-calendar-blank" key={cell.key} aria-hidden="true" />
          )
        ))}
      </div>
      <div className="record-calendar-footer">
        <p>
          {selectedDate
            ? selectedEntries.length > 0
              ? `${formatLongDate(selectedDate)}の記録を表示しています（${selectedEntries.length}件）`
              : `${formatLongDate(selectedDate)}には記録がありません。件数が付いた日を選ぶと記録が表示されます。`
            : "日付を押すと、その日の記録だけを見返せます。"}
        </p>
        {selectedDate ? <button type="button" onClick={onClearDate}>全日付の記録を表示</button> : null}
      </div>
    </div>
  );
}

function notebookTitle(name: string) {
  const trimmed = name.trim() || "この人";
  if (trimmed.endsWith("さん") || trimmed.startsWith("お")) return `${trimmed}の手帳`;
  return `${trimmed}さんの手帳`;
}

function boardDateLabel() {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const today = new Date();
  return `${today.getMonth() + 1}/${today.getDate()}(${weekdays[today.getDay()]})`;
}

function cloudSyncTimeLabel(value?: string | null) {
  if (!value) return "未保存";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "保存済み";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
}

function notebookPayloadSignature(payload: NotebookSyncPayload) {
  return JSON.stringify(payload);
}

function attachmentForNotebookSync(attachment: DiaryAttachment): DiaryAttachment {
  if (!attachment.storageBucket || !attachment.storagePath || !attachment.previewUrl) {
    return attachment;
  }

  const { previewUrl: _previewUrl, ...syncAttachment } = attachment;
  return syncAttachment;
}

function diaryEntryForNotebookSync(entry: DiaryEntry): DiaryEntry {
  if (entry.attachments.length === 0) return entry;

  return {
    ...entry,
    attachments: entry.attachments.map(attachmentForNotebookSync)
  };
}

function diaryEntriesForNotebookSync(entries: DiaryEntry[]) {
  return entries.map(diaryEntryForNotebookSync);
}

function taskDateParts(dateString?: string) {
  if (!dateString) return { month: "--", day: "--" };
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { month: "期限", day: dateString };
  return {
    month: `${date.getMonth() + 1}月`,
    day: String(date.getDate())
  };
}

function normalizeAlertHref(href: string) {
  if (href === "#profile-edit-fields") return "#person-profile";
  return href;
}

function MascotNote({
  label,
  title,
  body,
  children
}: {
  label: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <aside className="mascot-note" aria-label={label}>
      <div className="mascot-note-face" aria-hidden="true">
        <img src="/brand/watch-bird-mark.svg" alt="" />
      </div>
      <div className="mascot-note-body">
        <span>{label}</span>
        <strong>{title}</strong>
        <p>{body}</p>
        {children}
      </div>
    </aside>
  );
}

function buildJourneyCards(entries: DiaryEntry[], profile: PersonProfile | undefined) {
  const hasDiary = entries.length > 0;
  const hasCareContact = Boolean(profile?.keyContact?.trim() || profile?.hospitalOrFacility?.trim() || profile?.emergencyContact?.trim());
  const hasDocuments = Boolean(profile?.documentLocationNote?.trim());
  const hasWishes = Boolean(profile?.carePreference?.trim() || profile?.importantPeopleNote?.trim());

  return [
    { ...journeyCopy.status, state: "done" },
    { ...journeyCopy.diary, state: hasDiary ? "done" : "now" },
    { ...journeyCopy.care, state: hasCareContact ? "done" : hasDiary ? "now" : "next" },
    { ...journeyCopy.documents, state: hasDocuments ? "done" : hasCareContact ? "now" : "next" },
    { ...journeyCopy.wishes, state: hasWishes ? "done" : hasDocuments ? "now" : "next" }
  ] as const;
}

function buildSupportActions(
  caseId: string,
  entries: DiaryEntry[],
  profile: PersonProfile | undefined,
  tasks: TaskWithDue[],
  completion: ReturnType<typeof profileCompletion>
) {
  const actions: { title: string; body: string; href: string; label: string }[] = [];
  const text = entries.slice(0, 10).map((entry) => entry.body).join("\n");
  const hasUnassignedTasks = tasks.length > 0;

  if (entries.length === 0) {
    actions.push({
      title: "まず今日の様子を1行残す",
      body: "変化がなくても大丈夫です。あとで家族に説明する時の起点になります。",
      href: "#today-diary",
      label: "書く"
    });
  }

  if (completion.percent < 85) {
    actions.push({
      title: "プロフィールを少し足す",
      body: "生年月日、緊急連絡先、病院・ケア先が入ると、相談や共有が一気に楽になります。",
      href: "#person-profile",
      label: "足す"
    });
  }

  if (!profile?.carePreference?.trim() && !profile?.importantPeopleNote?.trim()) {
    actions.push({
      title: "本人の希望をメモする",
      body: "好きな呼ばれ方、会わせたい人、避けたい対応などを断定せずに残しておきます。",
      href: "#person-profile",
      label: "残す"
    });
  }

  if (!profile?.documentLocationNote?.trim() || /家|実家|鍵|書類|片付|保険|年金|支払/.test(text)) {
    actions.push({
      title: "書類・鍵・支払いの場所を確認する",
      body: "暗証番号は書かず、どこに何があるかだけを家族で分かる形にします。",
      href: "#person-profile",
      label: "確認"
    });
  }

  if (hasUnassignedTasks) {
    actions.push({
      title: "確認リストの担当を決める",
      body: "期限つきの項目は、誰が見るか決めるだけで家族の不安が減ります。",
      href: "#task-checklist",
      label: "決める"
    });
  }

  actions.push({
    title: "家族共有と長期相談を検討する",
    body: "2人目の管理、家族招待、この人の記録を踏まえたAI相談はPlusで広げます。",
    href: "/plans",
    label: "Plus"
  });

  return actions.slice(0, 4);
}

function buildRecordDigest(entries: DiaryEntry[], profile: PersonProfile | undefined) {
  const urgentCount = entries.filter((entry) => entry.mood === "urgent").length;
  const changedCount = entries.filter((entry) => entry.mood === "changed").length;
  const attachmentCount = entries.reduce((sum, entry) => sum + entry.attachments.length, 0);
  const text = entries.slice(0, 12).map((entry) => entry.body).join("\n");
  const tags = [
    [/退院|在宅|訪問|通院/, "退院後・在宅"],
    [/薬|服薬|飲み忘れ/, "薬・服薬"],
    [/忘れ|認知|混乱|徘徊|発言/, "発言・記憶"],
    [/家|実家|鍵|片付|書類/, "実家・書類"],
    [/支払|請求|保険|年金/, "支払い"]
  ] as const;
  const concernTags = tags.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  const latestEntry = entries[0];
  const latestLabel = latestEntry ? formatLongDate(latestEntry.date) : "まだ記録なし";

  let summary = "まだ記録が少ないので、まずは今日の様子を1行だけ残す段階です。";
  if (entries.length >= 1) {
    summary = `${latestLabel}までに${entries.length}件の記録があります。変化や急ぎの記録を中心に、家族で見返せます。`;
  }
  if (urgentCount > 0) {
    summary = `急ぎの記録が${urgentCount}件あります。連絡先、受診先、家族の担当を先に確認してください。`;
  } else if (changedCount > 0) {
    summary = `変化の記録が${changedCount}件あります。次の通院や家族会議で説明しやすい状態です。`;
  }

  return {
    latestLabel,
    summary,
    stats: [
      { label: "記録", value: `${entries.length}` },
      { label: "変化", value: `${changedCount + urgentCount}` },
      { label: "写真", value: `${attachmentCount}` }
    ],
    tags: concernTags.length > 0 ? concernTags.slice(0, 4) : [profile?.careStatus || "日々の様子"]
  };
}

function buildEntryConsultQuestion(entry: DiaryEntry, profile: PersonProfile | undefined) {
  const person = profile?.displayName?.trim() || profile?.fullName?.trim() || profile?.relationship?.trim() || "この人";
  return `${formatLongDate(entry.date)}の記録「${clipText(entry.body, 96)}」をもとに、${person}について次に確認すること、家族に共有する一文、相談先で聞くことを整理してください。`;
}

function buildDigestConsultQuestion(entries: DiaryEntry[], profile: PersonProfile | undefined, summary?: string) {
  const person = profile?.displayName?.trim() || profile?.fullName?.trim() || profile?.relationship?.trim() || "この人";
  const latest = entries[0];
  if (!latest) {
    return `${person}の手帳をこれから育てます。最初にどんな記録を書けば、あとで家族や支援者に説明しやすくなりますか。`;
  }

  return `${person}の最近の記録のまとめ「${summary ?? clipText(latest.body, 90)}」をもとに、今週確認すること、家族に頼むこと、次に残す記録を整理してください。`;
}

function consultHref(caseId: string, question: string) {
  return `/consult?caseId=${encodeURIComponent(caseId)}&q=${encodeURIComponent(question)}`;
}

function buildNotebookInsight(
  caseId: string,
  entries: DiaryEntry[],
  profile: PersonProfile | undefined,
  tasks: TaskWithDue[],
  completion: ReturnType<typeof profileCompletion>
) {
  const text = entries.slice(0, 12).map((entry) => entry.body).join("\n");
  const urgentCount = entries.filter((entry) => entry.mood === "urgent").length;
  const changedCount = entries.filter((entry) => entry.mood === "changed").length;
  const attachmentCount = entries.reduce((sum, entry) => sum + entry.attachments.length, 0);
  const latestEntry = entries[0];
  const daysFromLastEntry = daysSince(latestEntry?.date);
  const openTasks = tasks.filter((task) => (task.progress ?? "todo") !== "done" && task.progress !== "skipped");
  const nextTask = openTasks[0];
  const nextTaskDays = daysUntil(nextTask?.dueDate);
  const unassignedCount = openTasks.filter((task) => !task.assignee?.trim()).length;
  const nearTasks = openTasks.filter((task) => {
    const days = daysUntil(task.dueDate);
    return days !== null && days <= 7;
  });
  const person = profile?.displayName?.trim() || profile?.fullName?.trim() || "この人";
  const alerts: { tone: "urgent" | "warning" | "good"; title: string; body: string; href: string }[] = [];

  if (urgentCount > 0) {
    alerts.push({
      tone: "urgent",
      title: "急ぎの記録があります",
      body: "急な変化として残した日があります。家族の連絡順と相談先を確認してください。",
      href: "#diary-history"
    });
  }

  if (nextTask && nextTaskDays !== null && nextTaskDays <= 3) {
    alerts.push({
      tone: nextTaskDays < 0 ? "urgent" : "warning",
      title: nextTaskDays < 0 ? "期限を過ぎた確認があります" : "近い期限があります",
      body: `${nextTask.title} は ${dueText(nextTask)} です。担当者を決めて進めましょう。`,
      href: "#task-checklist"
    });
  }

  if (completion.percent < 70) {
    alerts.push({
      tone: "warning",
      title: "本人情報がまだ薄いです",
      body: "フルネーム、生年月日、病院・施設、薬の注意点を足すと、相談時に説明しやすくなります。",
      href: "#profile-edit-fields"
    });
  }

  if (unassignedCount > 0) {
    alerts.push({
      tone: "warning",
      title: "担当未定の確認があります",
      body: `${unassignedCount}件の確認リストに担当が入っていません。家族で誰が見るかだけ決めておきましょう。`,
      href: "#task-checklist"
    });
  }

  if (entries.length === 0) {
    alerts.push({
      tone: "warning",
      title: "まだ記録がありません",
      body: "まずは今日あったことを1行だけ残してください。あとから振り返る土台になります。",
      href: "#today-diary"
    });
  } else if (daysFromLastEntry !== null && daysFromLastEntry >= 7) {
    alerts.push({
      tone: "warning",
      title: "記録が少し空いています",
      body: `${formatLongDate(latestEntry?.date)}から記録が止まっています。変化なしでも一言残すと安心です。`,
      href: "#today-diary"
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      tone: "good",
      title: "今日見るところは整っています",
      body: "記録、本人情報、期限がひと通り残っています。変化があった日だけ追加すれば大丈夫です。",
      href: "#today-diary"
    });
  }

  let patternTitle = "まだ傾向を見るには記録が少なめです";
  let patternBody = "1日1行でいいので、体調・発言・連絡・家族で決めたことを残すと、あとから流れが見えます。";
  let forecastTitle = "次に困りそうなことを、少しずつ見える化します";
  let forecastBody = "記録が増えるほど、期限・家族確認・写真で残すべきことを手帳内で拾いやすくなります。";
  if (/退院|在宅|訪問|通院/.test(text)) {
    patternTitle = "退院後・在宅の確認が続いています";
    patternBody = "通院、訪問サービス、薬、家族の役割を同じ日記に残すと、次の調整がしやすくなります。";
    forecastTitle = "退院後は、予定と役割の抜け漏れが起きやすいです";
    forecastBody = "次回通院、訪問サービス、薬の変更、送迎担当を同じ画面で確認できるようにしましょう。";
  } else if (/薬|服薬|飲み忘れ/.test(text)) {
    patternTitle = "薬・服薬の記録が出ています";
    patternBody = "薬の変更日、飲み忘れ、誰が確認したかを残すと、医療・介護の相談で説明しやすくなります。";
    forecastTitle = "薬の変化は、あとから説明に困りやすいです";
    forecastBody = "薬名そのものより、変更日・飲み忘れ・誰に相談したかを短く残すと振り返りやすくなります。";
  } else if (/忘れ|認知|怒|混乱|徘徊|発言/.test(text)) {
    patternTitle = "発言や記憶の変化が記録されています";
    patternBody = "事実、日時、場面を短く残しておくと、家族間の共有や専門窓口への相談に役立ちます。";
    forecastTitle = "発言や様子の変化は、事実メモが助けになります";
    forecastBody = "判断名を決めつけず、日時・場所・実際の発言を残すと、家族で話す材料になります。";
  } else if (/家|実家|鍵|片付|写真|荷物|書類/.test(text)) {
    patternTitle = "実家・書類まわりの整理が始まっています";
    patternBody = "部屋ごとの写真、鍵、ライフライン、重要書類の場所をセットで残すと後から困りにくくなります。";
    forecastTitle = "実家まわりは、写真と場所メモが後で効きます";
    forecastBody = "鍵、書類、ライフライン、部屋ごとの状態を写真つきで残すと、家族で同じ前提を持てます。";
  } else if (entries.length >= 3) {
    patternTitle = "記録の習慣ができ始めています";
    patternBody = "このペースで残すと、家族会議や相談時に「最近どうだったか」を説明しやすくなります。";
    forecastTitle = "次は、記録を家族で見返す段階です";
    forecastBody = "変化があった日だけでなく、変化がなかった日も少し残すと、流れが分かりやすくなります。";
  }

  const questions = new Set<string>();
  if (!profile?.birthDate) questions.add("生年月日や年齢は確認できていますか？");
  if (!profile?.hospitalOrFacility) questions.add("病院・施設・ケア先の名前と窓口は分かりますか？");
  if (!profile?.medicationNote) questions.add("薬の変更や飲み忘れで気になることはありますか？");
  if (/退院|在宅|訪問|通院/.test(text)) questions.add("次回通院や訪問サービスの日付は決まっていますか？");
  if (/支払|請求|保険|年金/.test(text)) questions.add("支払い・保険・年金の書類の場所は分かりますか？");
  if (/家|実家|鍵|片付|写真|荷物|書類/.test(text)) questions.add("鍵、重要書類、ライフラインの状態を写真で残しましたか？");
  if (questions.size === 0) questions.add("次に家族へ確認したいことを1つだけ書いておきますか？");

  let primaryAction = {
    label: "今日の記録を書く",
    title: "まず今日あったことを1行残す",
    body: "体調、病院からの連絡、家族で決めたこと。短くても残ると、次に相談する時の説明が楽になります。",
    href: "#today-diary"
  };

  if (urgentCount > 0) {
    primaryAction = {
      label: "連絡順を見る",
      title: "急ぎの記録を家族で確認する",
      body: "急な変化がある日は、誰が病院・介護先に連絡するか、誰へ共有するかを先に決めてください。",
      href: "#diary-history"
    };
  } else if (nearTasks.length > 0 && nextTask) {
    primaryAction = {
      label: "確認リストへ",
      title: "期限が近い確認を先に進める",
      body: `${nextTask.title} は ${dueText(nextTask)} です。担当と次の連絡先を入れておくと家族で動きやすくなります。`,
      href: "#task-checklist"
    };
  } else if (unassignedCount > 0) {
    primaryAction = {
      label: "担当を決める",
      title: "担当未定をなくす",
      body: "家族で見る手帳は、内容より先に「誰がやるか」が決まると動きます。1件だけでも担当を入れてください。",
      href: "#task-checklist"
    };
  } else if (completion.percent < 70) {
    primaryAction = {
      label: "基本情報へ",
      title: "相談に必要な本人情報を足す",
      body: "病院・施設、主な連絡先、薬の注意点が入ると、家族共有やAI相談の質が上がります。",
      href: "#person-profile"
    };
  } else if (attachmentCount === 0 && /家|実家|鍵|片付|写真|荷物|書類/.test(text)) {
    primaryAction = {
      label: "写真の使い方へ",
      title: "写真で残すものを決める",
      body: "実家・書類・鍵の話が出ています。場所が分かる写真を1枚添えるだけで、後の家族確認がかなり楽になります。",
      href: "#media-library"
    };
  }

  const firstQuestion = Array.from(questions)[0] ?? "次に家族へ確認したいことを1つだけ書いておきますか？";
  const familyMessage = latestEntry
    ? `${person}の共有メモ: ${formatLongDate(latestEntry.date)}「${clipText(latestEntry.body, 58)}」。次は「${firstQuestion}」を確認したいです。`
    : `${person}の手帳を作りました。まず今日の様子、病院・介護先、家族で決めたことを1行ずつ残していきます。`;

  const watchPoints = [
    nearTasks.length > 0
      ? `7日以内の確認が${nearTasks.length}件あります`
      : "期限が近いものは今のところ落ち着いています",
    unassignedCount > 0
      ? `担当未定が${unassignedCount}件あります`
      : "担当未定はありません",
    daysFromLastEntry === null
      ? "記録はまだありません"
      : daysFromLastEntry === 0
        ? "今日の記録があります"
        : `最後の記録から${daysFromLastEntry}日たっています`
  ];

  return {
    urgentCount,
    changedCount,
    attachmentCount,
    latestDateLabel: latestEntry ? formatLongDate(latestEntry.date) : "未記録",
    patternTitle,
    patternBody,
    forecastTitle,
    forecastBody,
    alerts: alerts.slice(0, 3),
    questions: Array.from(questions).slice(0, 4),
    primaryAction,
    familyMessage,
    watchPoints
  };
}

export default function FamilyBoardPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<Record<string, DiaryEntry[]>>({});
  const [forms, setForms] = useState<Record<string, DiaryFormState>>({});
  const [diaryEditForms, setDiaryEditForms] = useState<Record<string, DiaryEditForm>>({});
  const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null);
  const [diarySavedId, setDiarySavedId] = useState<string | null>(null);
  const [diaryUpdatedId, setDiaryUpdatedId] = useState<string | null>(null);
  const [taskAddedEntryId, setTaskAddedEntryId] = useState<string | null>(null);
  const [profileForms, setProfileForms] = useState<Record<string, PersonProfile>>({});
  const [profileSavedCaseId, setProfileSavedCaseId] = useState<string | null>(null);
  const [profileLocationErrorCaseId, setProfileLocationErrorCaseId] = useState<string | null>(null);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [prefecturePromptDrafts, setPrefecturePromptDrafts] = useState<Record<string, PrefecturePromptDraft>>({});
  const [taskForms, setTaskForms] = useState<Record<string, TaskEditForm>>({});
  const [editingTaskKey, setEditingTaskKey] = useState<string | null>(null);
  const [taskSavedKey, setTaskSavedKey] = useState<string | null>(null);
  const [taskComposerOpen, setTaskComposerOpen] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState<TaskEditForm>(() => blankTaskForm());
  const [newTaskSaved, setNewTaskSaved] = useState(false);
  const [familyMessageCopied, setFamilyMessageCopied] = useState(false);
  const [recordStorageMessage, setRecordStorageMessage] = useState<string | null>(null);
  const [recordStorageTone, setRecordStorageTone] = useState<"info" | "warning">("info");
  const [recordFilter, setRecordFilter] = useState<RecordFilter>("all");
  const [selectedDiaryDate, setSelectedDiaryDate] = useState<string | null>(null);
  const [diaryCalendarMonth, setDiaryCalendarMonth] = useState(() => monthInputValue());
  const [activeNotebookTab, setActiveNotebookTab] = useState<NotebookTab>("record");
  const [loaded, setLoaded] = useState(false);
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("checking");
  const [cloudMessage, setCloudMessage] = useState("このままでも使えますが、履歴削除や機種変更で消えることがあります。メール確認をするとクラウドにも保存できます。");
  const [cloudAutoStatus, setCloudAutoStatus] = useState<CloudAutoStatus>("idle");
  const [canManageFamilyBilling, setCanManageFamilyBilling] = useState(() => readCanManageFamilyBilling());
  const [lastCloudSyncedAt, setLastCloudSyncedAt] = useState<string | null>(null);
  const autoSyncTimerRef = useRef<number | null>(null);
  const lastSyncedPayloadRef = useRef("");
  const cloudSyncInFlightRef = useRef(false);
  const pendingAutoSyncPayloadRef = useRef<NotebookSyncPayload | null>(null);
  const cloudRestoringRef = useRef(false);
  const firstCloudLoadDoneRef = useRef(false);
  const skipInitialCloudRestoreRef = useRef(false);
  const cloudBackupRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("cloud") === "1" || window.location.hash === "#cloud-backup") {
        window.setTimeout(() => {
          if (!cloudBackupRef.current) return;
          cloudBackupRef.current.open = true;
          cloudBackupRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
        }, 80);
      }
      if (params.get("reset") === "1") {
        resetLocalNotebookData();
        skipInitialCloudRestoreRef.current = true;
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    const localCases = listLocalCases();
    setCases(localCases);
    setActiveCaseId((current) => current ?? localCases[0]?.id ?? null);
    setDiaryEntries(Object.fromEntries(localCases.map((item) => [item.id, listDiaryEntries(item.id)])));
    setProfileForms(Object.fromEntries(localCases.map((item) => [item.id, profileSeed(item)])));
    setPrefecturePromptDrafts(Object.fromEntries(localCases.map((item) => {
      const profile = profileSeed(item);
      return [item.id, {
        parentPrefecture: profile.parentPrefecture ?? "",
        parentCity: profile.parentCity ?? ""
      }];
    })));
    setLoaded(true);
  }, []);

  useEffect(() => {
    const client = getBrowserSupabase();
    if (!client) {
      setCloudStatus("error");
      setCloudMessage("クラウド保存の環境設定がまだありません。控えのダウンロードは使えます。");
      return;
    }

    let mounted = true;
    void completeBrowserSupabaseAuthFromUrl().then(({ handled, session, error }) => {
      if (!mounted) return;
      if (error) {
        setCloudStatus("error");
        setCloudMessage(`メール確認に失敗しました: ${error}`);
        return;
      }
      setCloudUserEmail(session?.user.email ?? null);
      setCloudEmail((current) => current || session?.user.email || "");
      setCloudStatus("idle");
      if (handled && session) {
        setCloudMessage("メール確認できました。この手帳は変更のたびにクラウドへ自動保存されます。");
      } else if (session) {
        setCloudMessage("ログイン済みです。この手帳は変更のたびにクラウドへ自動保存されます。");
      }
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setCloudUserEmail(session?.user.email ?? null);
      setCloudEmail((current) => current || session?.user.email || "");
      if (!session) {
        firstCloudLoadDoneRef.current = false;
        lastSyncedPayloadRef.current = "";
        setLastCloudSyncedAt(null);
        setCloudAutoStatus("idle");
        setCanManageFamilyBilling(true);
        writeCanManageFamilyBilling(true);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const activeCase = useMemo(() => {
    if (cases.length === 0) return undefined;
    return cases.find((item) => item.id === activeCaseId) ?? cases[0];
  }, [activeCaseId, cases]);

  useEffect(() => {
    setProfileEditorOpen(false);
    setEditingDiaryId(null);
    setDiarySavedId(null);
    setDiaryUpdatedId(null);
    setTaskAddedEntryId(null);
    setEditingTaskKey(null);
    setTaskSavedKey(null);
    setTaskComposerOpen(false);
    setNewTaskForm(blankTaskForm());
    setNewTaskSaved(false);
    setFamilyMessageCopied(false);
    setRecordStorageMessage(null);
    setRecordStorageTone("info");
    setRecordFilter("all");
    setSelectedDiaryDate(null);
    setDiaryCalendarMonth(monthInputValue());
    setActiveNotebookTab("record");
  }, [activeCase?.id]);

  const activeEntries = activeCase ? diaryEntries[activeCase.id] ?? [] : [];
  const activeTasks = activeCase?.result?.tasks ?? [];
  const nextTask = activeTasks[0];
  const activeForm = activeCase ? forms[activeCase.id] ?? emptyDiaryForm : emptyDiaryForm;
  const activeProfile = activeCase ? profileForms[activeCase.id] ?? profileSeed(activeCase) : undefined;
  const activePrefecturePromptDraft = activeCase
    ? prefecturePromptDrafts[activeCase.id] ?? {
        parentPrefecture: activeProfile?.parentPrefecture ?? "",
        parentCity: activeProfile?.parentCity ?? ""
      }
    : { parentPrefecture: "", parentCity: "" };
  const shouldPromptParentPrefecture = Boolean(
    activeCase &&
    activeProfile &&
    (!activeProfile.parentPrefecture?.trim() || !activeProfile.parentCity?.trim())
  );
  const activeProfileCompletion = activeProfile ? profileCompletion(activeProfile) : { filled: 0, total: 0, percent: 0 };
  const activeMissingProfileItems = activeProfile ? missingProfileItems(activeProfile) : [];
  const attachments = activeEntries.flatMap((entry) =>
    entry.attachments.map((file) => ({ ...file, entryDate: entry.date }))
  );
  const filteredEntries = activeEntries.filter((entry) => {
    if (selectedDiaryDate && entry.date !== selectedDiaryDate) return false;
    if (recordFilter === "changed") return entry.mood === "changed" || entry.mood === "urgent";
    if (recordFilter === "attachments") return entry.attachments.length > 0;
    return true;
  });
  const diaryGroups = groupDiaryEntries(filteredEntries);
  const notebookInsight = activeCase ? buildNotebookInsight(activeCase.id, activeEntries, activeProfile, activeTasks, activeProfileCompletion) : undefined;
  const activePersonName = activeCase ? personName(activeCase) : "";
  const activeRelationship = activeCase ? activeProfile?.relationship || relationshipName(activeCase) : "";
  const activeCareStatus = activeCase ? activeProfile?.careStatus || statusLabel(activeCase.selectedStatus) : "";
  const todayRows = notebookInsight?.alerts.slice(0, 2) ?? [];
  const journeyCards = activeCase ? buildJourneyCards(activeEntries, activeProfile) : [];
  const supportActions = activeCase ? buildSupportActions(activeCase.id, activeEntries, activeProfile, activeTasks, activeProfileCompletion) : [];
  const isSharedFamilyMember = Boolean(cloudUserEmail && !canManageFamilyBilling);
  const visibleSupportActions = isSharedFamilyMember ? supportActions.filter((action) => action.href !== "/plans") : supportActions;
  const activeCaseIndex = activeCase ? cases.findIndex((caseRecord) => caseRecord.id === activeCase.id) : -1;
  const activeCaseOrdinal = activeCaseIndex >= 0 ? `${activeCaseIndex + 1}人目` : "この人";
  const recordDigest = activeCase ? buildRecordDigest(activeEntries, activeProfile) : undefined;
  const openTasks = activeTasks.filter((task) => (task.progress ?? "todo") !== "done");
  const unassignedTaskCount = openTasks.filter((task) => !task.assignee?.trim()).length;
  const latestEntry = activeEntries[0];
  const savedDiaryEntry = diarySavedId ? activeEntries.find((entry) => entry.id === diarySavedId) : undefined;
  const daysFromLatestEntry = daysSince(latestEntry?.date);
  const latestEntrySummary = latestEntry
    ? latestEntry.body.length > 92
      ? `${latestEntry.body.slice(0, 92)}…`
      : latestEntry.body
    : "まだ記録はありません。今日の様子を1行だけ残すと、ここに流れが出ます。";
  const latestEntryLabel = latestEntry
    ? daysFromLatestEntry === 0
      ? `今日の記録 · ${moodLabel(latestEntry.mood)}`
      : `${formatLongDate(latestEntry.date)}の記録 · ${moodLabel(latestEntry.mood)}`
    : "今日の記録はまだありません";
  const nextTaskCopy = unassignedTaskCount > 0
    ? `担当が決まっていない確認が${unassignedTaskCount}件あります`
    : openTasks[0]
      ? `${openTasks[0].title}（${dueText(openTasks[0])}）`
      : "いま未完了の確認リストはありません";
  const profileNextCopy = activeMissingProfileItems[0]
    ? `${activeMissingProfileItems[0]}を足すと、相談や共有がしやすくなります`
    : "基本情報はそろっています。変化があれば更新できます";
  const handbookSteps = activeCase ? [
    {
      key: "profile",
      title: "本人プロフィール",
      body: profileNextCopy,
      href: "#profile-edit-fields",
      action: "編集する",
      value: `${activeProfileCompletion.percent}%`,
      state: activeProfileCompletion.percent >= 85 ? "done" : "now"
    },
    {
      key: "record",
      title: "日々の記録",
      body: activeEntries.length > 0
        ? `${activeEntries.length}件の記録があります。過去の変化を見返せます。`
        : "今日の体調・発言・病院連絡を1行だけ残します。",
      href: activeEntries.length > 0 ? "#diary-history" : "#today-diary",
      action: activeEntries.length > 0 ? "見返す" : "書く",
      value: `${activeEntries.length}件`,
      state: activeEntries.length > 0 ? "done" : "now"
    },
    {
      key: "tasks",
      title: "確認リスト",
      body: nextTaskCopy,
      href: "#task-checklist",
      action: "確認する",
      value: `${openTasks.length}件`,
      state: openTasks.length > 0 ? (unassignedTaskCount > 0 ? "now" : "done") : "next"
    },
    {
      key: "media",
      title: "写真",
      body: attachments.length > 0
        ? "写真が日記にまとまっています。"
        : "部屋・書類・施設からの紙は、まず写真で日記に添付できます。",
      href: "#media-library",
      action: attachments.length > 0 ? "見る" : "使い方",
      value: `${attachments.length}件`,
      state: attachments.length > 0 ? "done" : "next"
    }
  ] satisfies {
    key: string;
    title: string;
    body: string;
    href: string;
    action: string;
    value: string;
    state: HandbookStepState;
  }[] : [];
  const handbookDoneCount = handbookSteps.filter((step) => step.state === "done").length;
  const handbookReadinessPercent = handbookSteps.length > 0 ? Math.round((handbookDoneCount / handbookSteps.length) * 100) : 0;
  const handbookReadinessCopy = handbookDoneCount >= 3
    ? "共有や相談に使える手帳に近づいています。変化があった日だけ追記すれば大丈夫です。"
    : "まずは本人情報・今日の記録・確認リストをそろえると、この人の手帳として使いやすくなります。";
  const handbookReadinessNote = isSharedFamilyMember
    ? "あなたは共有メンバーとして、この人の記録・確認リスト・写真を一緒に更新できます。追加課金の手続きは不要です。"
    : activeCaseIndex <= 0
      ? "1人目は無料でここまで育てられます。家族に共有したい、2人目も管理したい、記録を前提に相談したいと思った時だけPlusで広げます。"
      : "2人目以降も、プロフィール・記録・確認リスト・写真がそろうほど家族で使いやすくなります。支払いは家族手帳の作成者がまとめて管理します。";

  function tabForHash(hash: string): NotebookTab | undefined {
    if (hash === "#today-diary" || hash === "#diary-history") return "record";
    if (hash === "#person-profile" || hash === "#profile-edit-fields") return "profile";
    if (hash === "#task-checklist") return "tasks";
    if (hash === "#media-library") return "media";
    return undefined;
  }

  function openNotebookSection(hash: string) {
    const tab = tabForHash(hash);
    if (tab) setActiveNotebookTab(tab);
    if (hash === "#diary-history") markMonitorActivity("diaryHistoryOpened");
    if (tab === "tasks") markMonitorActivity("checklistOpened");
    if (hash === "#person-profile" || hash === "#profile-edit-fields") setProfileEditorOpen(true);

    window.setTimeout(() => {
      document.querySelector(hash)?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 0);
  }

  function openConsultDraft(draft: ConsultDraft) {
    window.location.assign(consultHref(draft.caseId, draft.question));
  }

  function openConsultFromEntry(entry: DiaryEntry) {
    if (!activeCase) return;
    openConsultDraft({
      caseId: activeCase.id,
      entryId: entry.id,
      sourceLabel: `${formatLongDate(entry.date)}の記録から`,
      question: buildEntryConsultQuestion(entry, activeProfile)
    });
  }

  function openConsultFromDigest() {
    if (!activeCase) return;
    openConsultDraft({
      caseId: activeCase.id,
      entryId: latestEntry?.id,
      sourceLabel: latestEntry ? "最近の記録から" : "手帳のはじめ方から",
      question: buildDigestConsultQuestion(activeEntries, activeProfile, recordDigest?.summary)
    });
  }

  function notebookTabNote(tab: NotebookTab) {
    if (tab === "record") return `${activeEntries.length}件`;
    if (tab === "profile") return `${activeProfileCompletion.percent}%`;
    if (tab === "tasks") return `${activeTasks.filter((task) => (task.progress ?? "todo") !== "done").length}件`;
    if (tab === "media") return `${attachments.length}件`;
    return "まず見る";
  }

  async function copyFamilyMessage(message: string) {
    try {
      await navigator.clipboard.writeText(message);
      setFamilyMessageCopied(true);
      window.setTimeout(() => setFamilyMessageCopied(false), 2200);
    } catch {
      setFamilyMessageCopied(false);
    }
  }

  function updateForm(caseId: string, patch: Partial<DiaryFormState>) {
    setForms((current) => ({
      ...current,
      [caseId]: {
        ...(current[caseId] ?? emptyDiaryForm),
        ...patch
      }
    }));
  }

  function appendDiaryNote(caseId: string, note: string) {
    const current = forms[caseId] ?? emptyDiaryForm;
    const body = current.body.trim() ? `${current.body.trim()}\n・${note}` : `・${note}`;
    updateForm(caseId, { body });
  }

  function updateProfileForm(caseId: string, patch: Partial<PersonProfile>) {
    setProfileSavedCaseId(null);
    setProfileLocationErrorCaseId(null);
    setProfileForms((current) => ({
      ...current,
      [caseId]: {
        ...(current[caseId] ?? {}),
        ...patch
      }
    }));
  }

  function updatePrefecturePromptDraft(caseId: string, patch: Partial<PrefecturePromptDraft>) {
    setPrefecturePromptDrafts((current) => ({
      ...current,
      [caseId]: {
        ...(current[caseId] ?? { parentPrefecture: "", parentCity: "" }),
        ...patch
      }
    }));
  }

  function saveParentPrefecturePrompt(caseId: string) {
    const draft = prefecturePromptDrafts[caseId];
    if (!draft?.parentPrefecture?.trim() || !draft.parentCity?.trim()) return;

    const profile = profileForms[caseId] ?? {};
    const nextProfile = {
      ...profile,
      parentPrefecture: draft.parentPrefecture.trim(),
      parentCity: draft.parentCity.trim()
    };
    const updated = updateCaseProfile(caseId, nextProfile);
    if (!updated) return;

    setCases((current) => [updated, ...current.filter((item) => item.id !== caseId)]);
    setProfileForms((current) => ({
      ...current,
      [caseId]: profileSeed(updated)
    }));
    setProfileSavedCaseId(caseId);
  }

  function saveProfile(caseId: string) {
    const profile = profileForms[caseId];
    if (!profile) return;
    if (!profile.parentPrefecture?.trim() || !profile.parentCity?.trim()) {
      setProfileSavedCaseId(null);
      setProfileLocationErrorCaseId(caseId);
      return;
    }

    const updated = updateCaseProfile(caseId, profile);
    if (!updated) return;

    setCases((current) => [updated, ...current.filter((item) => item.id !== caseId)]);
    setProfileForms((current) => ({
      ...current,
      [caseId]: profileSeed(updated)
    }));
    setProfileSavedCaseId(caseId);
    setProfileLocationErrorCaseId(null);
    if (profile.documentLocationNote?.trim()) markMonitorActivity("documentMemoSaved");
  }

  function openTaskEditor(caseId: string, taskIndex: number, task: TaskWithDue) {
    const key = taskEditKey(caseId, taskIndex);
    setTaskForms((current) => ({
      ...current,
      [key]: current[key] ?? taskFormSeed(task)
    }));
    setEditingTaskKey(key);
    setTaskSavedKey(null);
  }

  function updateTaskForm(key: string, patch: Partial<TaskEditForm>) {
    setTaskSavedKey(null);
    setTaskForms((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? blankTaskForm()),
        ...patch
      }
    }));
  }

  function updateNewTaskForm(patch: Partial<TaskEditForm>) {
    setNewTaskSaved(false);
    setNewTaskForm((current) => ({
      ...current,
      ...patch
    }));
  }

  function replaceCaseInState(updated: CaseRecord) {
    setCases((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
  }

  function saveTaskEdit(caseId: string, taskIndex: number) {
    const key = taskEditKey(caseId, taskIndex);
    const form = taskForms[key];
    if (!form) return;

    const patch: Partial<EditableTask> = {
      title: form.title,
      description: form.description,
      dueDate: form.dueDate,
      priority: taskPriorityValue(form.priority),
      progress: form.progress,
      assignee: form.assignee,
      note: form.note
    };
    const updated = updateCaseTask(caseId, taskIndex, patch);
    if (!updated) return;

    const nextTask = updated.result?.tasks[taskIndex];
    replaceCaseInState(updated);
    if (nextTask) {
      setTaskForms((current) => ({
        ...current,
        [key]: taskFormSeed(nextTask)
      }));
    }
    setEditingTaskKey(null);
    setTaskSavedKey(key);
  }

  function addManualTask(caseId: string) {
    const title = newTaskForm.title.trim();
    if (!title) return;

    const updated = addCaseTask(caseId, {
      title,
      description: newTaskForm.description.trim() || "家族で確認したいこととして追加しました。",
      dueDate: newTaskForm.dueDate || todayInputValue(),
      priority: taskPriorityValue(newTaskForm.priority),
      progress: newTaskForm.progress,
      assignee: newTaskForm.assignee.trim(),
      note: newTaskForm.note.trim() || "手入力で確認リストへ追加"
    });
    if (!updated) return;

    replaceCaseInState(updated);
    setNewTaskForm(blankTaskForm());
    setTaskComposerOpen(false);
    setNewTaskSaved(true);
    setTaskSavedKey(taskEditKey(caseId, 0));
  }

  function quickUpdateTask(caseId: string, taskIndex: number, patch: Partial<EditableTask>) {
    const updated = updateCaseTask(caseId, taskIndex, patch);
    if (!updated) return;

    const key = taskEditKey(caseId, taskIndex);
    const nextTask = updated.result?.tasks[taskIndex];
    replaceCaseInState(updated);
    if (nextTask) {
      setTaskForms((current) => ({
        ...current,
        [key]: taskFormSeed(nextTask)
      }));
    }
    setTaskSavedKey(key);
  }

  async function attachFiles(caseId: string, fileList: FileList | null) {
    const current = forms[caseId] ?? emptyDiaryForm;
    const slots = Math.max(0, MAX_LOCAL_PHOTO_COUNT - current.files.length);
    if (slots === 0) {
      setRecordStorageTone("warning");
      setRecordStorageMessage("写真は1回の記録につき3枚までにしています。メール確認済みなら、追加した写真はクラウドにも保存します。");
      return;
    }

    const allFiles = Array.from(fileList ?? []);
    const imageFiles = allFiles.filter((file) => file.type.startsWith("image/")).slice(0, slots);
    const ignoredCount = allFiles.length - imageFiles.length;
    const prepared = (await Promise.all(imageFiles.map(prepareLocalPhoto))).filter(Boolean) as PreparedPhoto[];
    const uploadedPrepared = await Promise.all(prepared.map(uploadPreparedPhoto));
    const warnings = uploadedPrepared.map((item) => item.warning).filter(Boolean) as string[];
    const uploadedCount = uploadedPrepared.filter((item) => item.attachment.uploadStatus === "uploaded").length;

    updateForm(caseId, { files: [...current.files, ...uploadedPrepared.map((item) => item.attachment)].slice(0, MAX_LOCAL_PHOTO_COUNT) });

    if (ignoredCount > 0) {
      warnings.push("PDFと4枚目以降の写真は一時停止しています。いまは写真3枚まで追加できます。");
    }
    if (warnings.length > 0) {
      setRecordStorageTone("warning");
      setRecordStorageMessage(Array.from(new Set(warnings)).join(" "));
    } else if (prepared.length > 0) {
      setRecordStorageTone("info");
      setRecordStorageMessage(
        uploadedCount > 0
          ? "写真を追加しました。クラウドにも保存しています。保存ボタンを押すと今日の記録に残ります。"
          : "写真を追加しました。保存ボタンを押すと今日の記録に残ります。メール確認をするとクラウドにも保存できます。"
      );
    }
  }

  async function uploadPreparedPhoto(item: PreparedPhoto): Promise<PreparedPhoto> {
    if (!cloudUserEmail) return item;

    const client = getBrowserSupabase();
    if (!client) return item;

    const token = await getAccessToken({ silent: true });
    if (!token) return item;

    try {
      const response = await fetch("/api/notebook/photo-upload-url", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: item.attachment.name,
          contentType: item.attachment.type,
          fileSizeBytes: item.blob.size
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.bucket || !result.storagePath || !result.token) {
        throw new Error(result.error ?? "写真のクラウド保管に失敗しました。");
      }

      const { error } = await client.storage
        .from(result.bucket)
        .uploadToSignedUrl(result.storagePath, result.token, item.blob, { contentType: item.attachment.type });

      if (error) throw error;

      return {
        ...item,
        attachment: {
          ...item.attachment,
          storageBucket: result.bucket,
          storagePath: result.storagePath,
          uploadedAt: new Date().toISOString(),
          uploadStatus: "uploaded"
        }
      };
    } catch {
      return {
        ...item,
        warning: [item.warning, "写真のクラウド保管に失敗しました。端末には追加していますが、あとでクラウド保存をもう一度確認してください。"]
          .filter(Boolean)
          .join(" ")
      };
    }
  }

  function saveDiary(caseId: string) {
    const form = forms[caseId] ?? emptyDiaryForm;
    if (!form.body.trim() && form.files.length === 0) return;
    const entryDate = form.date || todayInputValue();
    const entry = addDiaryEntry({
      caseId,
      date: entryDate,
      mood: form.mood,
      body: form.body.trim() || "写真を追加しました。",
      attachments: form.files
    });
    markMonitorActivity("dailyRecordSaved");
    const storageWarning = consumeNotebookStorageWarning();
    setDiaryEntries((current) => ({
      ...current,
      [caseId]: [entry, ...(current[caseId] ?? [])]
    }));
    setForms((current) => ({
      ...current,
      [caseId]: blankDiaryForm()
    }));
    setDiaryCalendarMonth(monthInputValue(entry.date));
    setSelectedDiaryDate(entry.date);
    setRecordFilter("all");
    setEditingDiaryId(null);
    setTaskAddedEntryId(null);
    setDiarySavedId(entry.id);
    setDiaryUpdatedId(null);
    if (storageWarning) {
      setRecordStorageTone("warning");
      setRecordStorageMessage(storageWarning);
    } else {
      setRecordStorageTone("info");
      setRecordStorageMessage(`${formatLongDate(entry.date)}の記録を保存しました。カレンダーからあとで見返せます。AI相談にも今すぐ反映されています。メール確認済みの手帳はクラウドにも自動保存します。`);
    }
    window.setTimeout(() => {
      document.querySelector("#diary-save-complete")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
  }

  function openDiaryEditor(entry: DiaryEntry) {
    setDiaryEditForms((current) => ({
      ...current,
      [entry.id]: current[entry.id] ?? diaryEditSeed(entry)
    }));
    setEditingDiaryId(entry.id);
    setDiarySavedId(null);
    setDiaryUpdatedId(null);
  }

  function scrollToDiaryEntry(entryId: string) {
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(`diary-entry-${entryId}`)?.scrollIntoView({
          block: "start",
          behavior: "smooth"
        });
      });
    }, 80);
  }

  function openDiaryEditorAndScroll(entry: DiaryEntry) {
    setSelectedDiaryDate(entry.date);
    setDiaryCalendarMonth(monthInputValue(entry.date));
    setRecordFilter("all");
    openDiaryEditor(entry);
    scrollToDiaryEntry(entry.id);
  }

  function closeDiaryEditor(entry: DiaryEntry) {
    setDiaryEditForms((current) => ({
      ...current,
      [entry.id]: diaryEditSeed(entry)
    }));
    setEditingDiaryId(null);
    setDiaryUpdatedId(null);
  }

  function updateDiaryEditForm(entryId: string, patch: Partial<DiaryEditForm>) {
    setDiarySavedId(null);
    setDiaryUpdatedId(null);
    setDiaryEditForms((current) => ({
      ...current,
      [entryId]: {
        ...(current[entryId] ?? { date: todayInputValue(), mood: "stable", body: "" }),
        ...patch
      }
    }));
  }

  function saveDiaryEdit(caseId: string, entryId: string) {
    const form = diaryEditForms[entryId];
    if (!form || !form.body.trim()) return;

    const updated = updateDiaryEntry(entryId, {
      date: form.date,
      mood: form.mood,
      body: form.body.trim()
    });
    if (!updated) return;
    const storageWarning = consumeNotebookStorageWarning();

    setDiaryEntries((current) => ({
      ...current,
      [caseId]: listDiaryEntries(caseId)
    }));
    setDiaryEditForms((current) => ({
      ...current,
      [entryId]: diaryEditSeed(updated)
    }));
    setEditingDiaryId(null);
    setDiarySavedId(null);
    setDiaryUpdatedId(entryId);
    setDiaryCalendarMonth(monthInputValue(updated.date));
    setSelectedDiaryDate(updated.date);
    setRecordFilter("all");
    if (storageWarning) {
      setRecordStorageTone("warning");
      setRecordStorageMessage(storageWarning);
    } else {
      setRecordStorageTone("info");
      setRecordStorageMessage(`${formatLongDate(updated.date)}の記録を更新しました。`);
    }
    scrollToDiaryEntry(entryId);
  }

  function addDiaryTask(caseId: string, entry: DiaryEntry) {
    const updated = addCaseTask(caseId, {
      title: diaryTaskTitle(entry),
      description: `${formatLongDate(entry.date)}の記録から追加: ${entry.body.slice(0, 90)}`,
      dueDate: dateInputAfterDays(entry.mood === "urgent" ? 1 : 7),
      priority: entry.mood === "urgent" ? 1 : 2,
      progress: "todo",
      assignee: "",
      note: "日記から確認リストへ追加"
    });
    if (!updated) return;

    replaceCaseInState(updated);
    setTaskAddedEntryId(entry.id);
  }

  function reloadNotebookState(nextCases = listLocalCases(), nextDiaryEntries?: DiaryEntry[]) {
    setCases(nextCases);
    setActiveCaseId((current) => current && nextCases.some((item) => item.id === current) ? current : nextCases[0]?.id ?? null);
    setDiaryEntries(Object.fromEntries(nextCases.map((item) => [
      item.id,
      nextDiaryEntries
        ? nextDiaryEntries
          .filter((entry) => entry.caseId === item.id)
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        : listDiaryEntries(item.id)
    ])));
    setProfileForms(Object.fromEntries(nextCases.map((item) => [item.id, profileSeed(item)])));
  }

  function allDiaryEntriesForSync() {
    return diaryEntriesForNotebookSync(Object.values(diaryEntries).flat());
  }

  function notebookSyncPayload(
    nextCases = cases,
    nextDiaryEntries = allDiaryEntriesForSync()
  ): NotebookSyncPayload {
    return {
      cases: nextCases,
      diaryEntries: diaryEntriesForNotebookSync(nextDiaryEntries)
    };
  }

  async function getAccessToken(options: { silent?: boolean } = {}) {
    const client = getBrowserSupabase();
    if (!client) {
      if (options.silent) {
        setCloudAutoStatus("error");
      } else {
        setCloudStatus("error");
        setCloudMessage("クラウド保存の環境設定がまだありません。");
      }
      return null;
    }

    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      if (options.silent) {
        setCloudAutoStatus("idle");
      } else {
        setCloudStatus("error");
        setCloudMessage("先にメール確認をしてください。確認後、この画面に戻ると保存できます。");
      }
      return null;
    }

    return token;
  }

  async function requestCloudLink() {
    const email = cloudEmail.trim();
    if (!email) {
      setCloudStatus("error");
      setCloudMessage("クラウド保存に使うメールアドレスを入力してください。");
      return;
    }

    setCloudStatus("sending");
    setCloudMessage("本人確認メールを送っています。");
    const result = await sendNotebookMagicLink(email);
    if (!result.ok) {
      setCloudStatus("error");
      setCloudMessage(result.error ?? "本人確認メールを送れませんでした。");
      return;
    }

    setCloudStatus("sent");
    setCloudMessage("本人確認メールを送りました。メール内のリンクを開くと、この手帳をクラウドへ保存できます。");
  }

  function applyFamilyBillingState(result: { canManageFamilyBilling?: unknown; isFamilyOwner?: unknown }) {
    const canManage = typeof result.canManageFamilyBilling === "boolean"
      ? result.canManageFamilyBilling
      : typeof result.isFamilyOwner === "boolean"
        ? result.isFamilyOwner
        : true;
    setCanManageFamilyBilling(canManage);
    writeCanManageFamilyBilling(canManage);
  }

  async function syncNotebookToCloud(options: { silent?: boolean; payload?: NotebookSyncPayload } = {}) {
    const payload = options.payload ?? notebookSyncPayload();
    const signature = notebookPayloadSignature(payload);

    if (cloudSyncInFlightRef.current) {
      if (options.silent) pendingAutoSyncPayloadRef.current = payload;
      return;
    }

    const token = await getAccessToken({ silent: options.silent });
    if (!token) return;

    cloudSyncInFlightRef.current = true;
    if (options.silent) {
      setCloudAutoStatus("saving");
    } else {
      setCloudStatus("syncing");
      setCloudMessage("クラウドに保存しています。");
    }

    try {
      const response = await fetch("/api/notebook/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCloudAutoStatus("error");
        if (!options.silent || result.error === "notebook_conflict") {
          setCloudStatus("error");
          setCloudMessage(result.message ?? result.error ?? "クラウド保存に失敗しました。");
        }
        return;
      }

      writePlan(result.plan);
      applyFamilyBillingState(result);
      lastSyncedPayloadRef.current = signature;
      setLastCloudSyncedAt(new Date().toISOString());
      setCloudAutoStatus("saved");
      setCloudStatus("synced");
      markMonitorActivity("cloudBackupConfirmed");
      // 上限で上げられなかった手帳があるなら、成功報告だけで終わらせない。
      const notice = typeof result.notice === "string" ? ` ${result.notice}` : "";
      if (!options.silent || notice) {
        setCloudMessage(
          `クラウドに保存しました。対象者${result.syncedPeople ?? payload.cases.length}人、記録${result.syncedEntries ?? payload.diaryEntries.length}件。${notice}`
        );
      } else {
        setCloudMessage("ログイン済みです。変更はクラウドへ自動保存されています。");
      }
    } finally {
      cloudSyncInFlightRef.current = false;
      const pendingPayload = pendingAutoSyncPayloadRef.current;
      pendingAutoSyncPayloadRef.current = null;
      if (pendingPayload) {
        const pendingSignature = notebookPayloadSignature(pendingPayload);
        if (pendingSignature !== lastSyncedPayloadRef.current) {
          window.setTimeout(() => {
            void syncNotebookToCloud({ silent: true, payload: pendingPayload });
          }, 150);
        }
      }
    }
  }

  async function restoreNotebookFromCloud(options: { silent?: boolean } = {}) {
    const token = await getAccessToken({ silent: options.silent });
    if (!token) return;

    cloudRestoringRef.current = true;
    if (options.silent) {
      setCloudAutoStatus("saving");
    } else {
      setCloudStatus("syncing");
      setCloudMessage("クラウドの控えを読み込んでいます。");
    }

    try {
      const response = await fetch("/api/notebook/sync", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCloudAutoStatus("error");
        if (!options.silent) {
          setCloudStatus("error");
          setCloudMessage(result.error ?? "クラウドから復元できませんでした。");
        }
        return;
      }

      const restoredCases = Array.isArray(result.cases) ? result.cases : [];
      const restoredEntries = Array.isArray(result.diaryEntries) ? result.diaryEntries : [];
      writePlan(result.plan);
      applyFamilyBillingState(result);
      const restoredNotebook = replaceLocalNotebook({
        cases: restoredCases,
        diaryEntries: restoredEntries
      });
      reloadNotebookState(restoredCases, restoredNotebook.diaryEntries);
      lastSyncedPayloadRef.current = notebookPayloadSignature(notebookSyncPayload(restoredNotebook.cases, restoredNotebook.diaryEntries));
      setLastCloudSyncedAt(new Date().toISOString());
      setCloudAutoStatus("saved");
      setCloudStatus("synced");
      setCloudMessage(options.silent ? "クラウドの控えを読み込みました。これからの変更は自動で保存されます。" : "クラウドの控えをこの端末に戻しました。");
    } finally {
      cloudRestoringRef.current = false;
    }
  }

  useEffect(() => {
    if (!loaded || !cloudUserEmail || firstCloudLoadDoneRef.current) return;

    firstCloudLoadDoneRef.current = true;
    if (skipInitialCloudRestoreRef.current) {
      skipInitialCloudRestoreRef.current = false;
      setCloudMessage("初めて使う人の見え方で表示しています。手帳を作ると、この端末とクラウドに保存できます。");
      setCloudStatus("idle");
      return;
    }

    const payload = notebookSyncPayload();
    const shouldRestoreFromCloud = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cloud") === "1";
    if (shouldRestoreFromCloud || payload.cases.length === 0) {
      void restoreNotebookFromCloud({ silent: true });
      return;
    }

    void syncNotebookToCloud({ silent: true, payload });
  }, [loaded, cloudUserEmail, cases.length]);

  useEffect(() => {
    if (!loaded || !cloudUserEmail || !firstCloudLoadDoneRef.current || cloudRestoringRef.current) return undefined;

    const payload = notebookSyncPayload();
    const signature = notebookPayloadSignature(payload);
    if (signature === lastSyncedPayloadRef.current) return undefined;

    if (autoSyncTimerRef.current) window.clearTimeout(autoSyncTimerRef.current);
    setCloudAutoStatus("saving");
    autoSyncTimerRef.current = window.setTimeout(() => {
      autoSyncTimerRef.current = null;
      void syncNotebookToCloud({ silent: true, payload });
    }, 1200);

    return () => {
      if (autoSyncTimerRef.current) {
        window.clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    };
  }, [loaded, cloudUserEmail, cases, diaryEntries]);

  function downloadNotebookExport() {
    const data = exportNotebookData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `oyano-moshimo-notebook-${todayInputValue()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={`container board-page family-notebook-page ${activeCase ? "has-active-case" : "is-empty-case"}`}>
      {activeCase ? (
        <section className="notebook-cover" aria-label="親のもしもナビの手帳表紙">
          <span className="ribbon" aria-hidden="true" />
          <div className="cover-brand">
            <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
            <span>親のもしもナビ</span>
          </div>
          <div className="cover-person">
            <div className="cover-person-photo" aria-hidden="true">
              <img src="/brand/watch-bird-mark.svg" alt="" />
            </div>
            <div className="cover-person-meta">
              <span>{`${activeRelationship} · ${activeCareStatus}`}</span>
              <strong>{notebookTitle(activePersonName)}</strong>
            </div>
            <a
              className="cover-profile-link"
              href="#person-profile"
              onClick={(event) => {
                event.preventDefault();
                openNotebookSection("#person-profile");
              }}
            >
              プロフィール
            </a>
          </div>
          <div className="cover-mascot-line">
            <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
            <span>今日は、まず記録を書けば大丈夫です。必要な確認はあとから開けます。</span>
          </div>
          <nav className="cover-tabs" aria-label="手帳の切り替え">
            {cases.map((caseRecord) => (
              <button
                className={caseRecord.id === activeCase.id ? "is-active" : ""}
                key={caseRecord.id}
                type="button"
                onClick={() => setActiveCaseId(caseRecord.id)}
              >
                {personName(caseRecord)}
              </button>
            ))}
          </nav>
        </section>
      ) : null}

      <MonitorTestReminder
        hasNotebook={Boolean(activeCase)}
        hasRecordToday={activeEntries.some((entry) => entry.date === todayInputValue())}
      />

      {!loaded ? (
        <section className="nb-card board-empty">
          <h2>読み込み中です</h2>
        </section>
      ) : null}

      {loaded && !activeCase ? (
        <section className="first-run-screen" aria-label="はじめての登録">
          <article className="first-run-hero">
            <div className="first-run-mascot" aria-hidden="true">
              <img src="/brand/watch-bird-mark.svg" alt="" />
            </div>
            <p className="nb-eyebrow">はじめて使う方へ</p>
            <h1>まず、1人分だけ手帳を作ります。</h1>
            <p>
              父母、義父母、祖父母、親戚など、気になる人を1人だけ選びます。
              呼び名、関係、都道府県、市区町村の4つから始めます。
            </p>
            <Link className="first-run-primary" href="/start">
              <strong>1人目の登録を始める</strong>
              <span>登録すると、その人専用の記録手帳ができます</span>
            </Link>
          </article>
          <article className="first-run-steps">
            <h2>この順番で進みます</h2>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <strong>誰の手帳かと地域を入れる</strong>
                  <small>地域は市区町村まで。番地や本名は不要です。</small>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>今日の記録を1行残す</strong>
                  <small>体調、病院からの連絡、家族に頼んだことを残します。</small>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>必要な確認だけ開く</strong>
                  <small>プロフィール、確認リスト、写真は手帳の中で整理します。</small>
                </div>
              </li>
            </ol>
          </article>
          <Link className="first-run-crisis" href="/crisis">
            <span>入院・危篤・亡くなった直後など、今すぐ確認したい時はこちら</span>
            <strong>急なときの確認へ</strong>
            <i aria-hidden="true">›</i>
          </Link>
          <article className="first-run-note">
            <strong>この画面は初めて使う人だけに出ます。</strong>
            <p>すでに手帳がある人は、次回からその人の記録画面が開きます。</p>
          </article>
        </section>
      ) : null}

      {activeCase ? (
        <div className="notebook-workspace" aria-label={`${activePersonName}の管理手帳`}>
          <section className="nb-section person-command-section" aria-label={`${activePersonName}の手帳メニュー`}>
            <article className="nb-card person-command-card record-first-card">
              <div className="record-first-head">
                <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                <div>
                  <p className="nb-eyebrow">この人の手帳</p>
                  <h1>今日あったことを、まず1行残します。</h1>
                  <p>体調、発言、病院・介護先からの連絡、家族に頼んだこと。短くても大丈夫です。</p>
                </div>
              </div>
              <button
                className="record-first-primary"
                type="button"
                onClick={() => openNotebookSection("#today-diary")}
              >
                <span>まずここ</span>
                <strong>今日の記録を書く</strong>
                <small>書くと、次に確認することが整理されます</small>
              </button>
              <div className={`record-first-latest ${latestEntry ? "has-entry" : "is-empty"}`}>
                <span>{latestEntryLabel}</span>
                <strong>{latestEntrySummary}</strong>
                <button
                  type="button"
                  onClick={() => openNotebookSection(latestEntry ? "#diary-history" : "#today-diary")}
                >
                  {latestEntry ? "記録を見る" : "1行だけ書く"}
                </button>
              </div>
              {latestEntry && notebookInsight ? (
                <div className="record-first-next">
                  <span>記録から見える次の一歩</span>
                  <strong>{notebookInsight.primaryAction.title}</strong>
                  <p>{notebookInsight.primaryAction.body}</p>
                  <a
                    href={notebookInsight.primaryAction.href}
                    onClick={(event) => {
                      if (!notebookInsight.primaryAction.href.startsWith("#")) return;
                      event.preventDefault();
                      openNotebookSection(notebookInsight.primaryAction.href);
                    }}
                  >
                    {notebookInsight.primaryAction.label}
                  </a>
                </div>
              ) : null}
              <details className="record-first-drawer">
                <summary>プロフィール・確認リスト・写真を開く</summary>
                <div className="record-first-menu" aria-label="必要な時だけ開く操作">
                  <a
                    href="#person-profile"
                    onClick={(event) => {
                      event.preventDefault();
                      openNotebookSection("#person-profile");
                    }}
                  >
                    <strong>この人の情報を整える</strong>
                    <small>呼び名、関係、病院、薬、連絡先</small>
                  </a>
                  <a
                    href="#task-checklist"
                    onClick={(event) => {
                      event.preventDefault();
                      openNotebookSection("#task-checklist");
                    }}
                  >
                    <strong>確認リストを見る</strong>
                    <small>{nextTaskCopy}</small>
                  </a>
                  <a
                    href="#media-library"
                    onClick={(event) => {
                      event.preventDefault();
                      openNotebookSection("#media-library");
                    }}
                  >
                    <strong>写真・資料を見る</strong>
                    <small>{attachments.length > 0 ? `${attachments.length}件あります` : "日記に添付した写真がここにまとまります"}</small>
                  </a>
                  <a
                    href="#diary-history"
                    onClick={(event) => {
                      event.preventDefault();
                      openNotebookSection("#diary-history");
                    }}
                  >
                    <strong>過去の記録を見る</strong>
                    <small>{activeEntries.length > 0 ? `${activeEntries.length}件の記録` : "まだ記録はありません"}</small>
                  </a>
                  {isSharedFamilyMember ? null : (
                    <Link href="/plans">
                      <strong>別の人の手帳を追加する</strong>
                      <small>2人目以降はFamily Plusで管理します</small>
                    </Link>
                  )}
                </div>
              </details>
            </article>
            <article className="nb-card handbook-readiness-panel" aria-label={`${activePersonName}の手帳の育ち具合`}>
              <div className="handbook-readiness-head">
                <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                <div>
                  <span>{activeCaseOrdinal}の手帳</span>
                  <strong>この人の情報が育つほど、共有と相談が役に立ちます。</strong>
                  <p>{handbookReadinessCopy}</p>
                </div>
              </div>
              <div className="handbook-readiness-score">
                <div>
                  <span>手帳の育ち具合</span>
                  <strong>{handbookReadinessPercent}%</strong>
                </div>
                <div className="handbook-readiness-track" aria-hidden="true">
                  <span style={{ width: `${handbookReadinessPercent}%` }} />
                </div>
                <small>{handbookDoneCount}/{handbookSteps.length}項目が使える状態です</small>
              </div>
              <div className="handbook-step-list">
                {handbookSteps.map((step) => (
                  <a
                    className={`handbook-step is-${step.state} is-${step.key}`}
                    href={step.href}
                    key={step.key}
                    onClick={(event) => {
                      event.preventDefault();
                      openNotebookSection(step.href);
                    }}
                  >
                    <span className="handbook-step-mark" aria-hidden="true" />
                    <div>
                      <small>{handbookStepLabels[step.state]} · {step.value}</small>
                      <strong>{step.title}</strong>
                      <p>{step.body}</p>
                    </div>
                    <em>{step.action}</em>
                  </a>
                ))}
              </div>
              <p className="handbook-readiness-note">
                {handbookReadinessNote}
              </p>
            </article>
            {shouldPromptParentPrefecture && activeCase ? (
              <article className="nb-card parent-prefecture-prompt" aria-label="親御さんの居住地入力">
                <div>
                  <p className="nb-eyebrow">地域設定</p>
                  <h2>親御さんの都道府県と市区町村を入れてください。</h2>
                  <p>
                    地域の相談先や手続きの案内は、利用者ではなく親御さんの居住地を基準に近づけます。
                    番地や詳細住所は入力せず、あとから変更できます。
                  </p>
                </div>
                <div className="parent-prefecture-form">
                  <label>
                    <span>都道府県（必須）</span>
                    <select
                      value={activePrefecturePromptDraft.parentPrefecture}
                      onChange={(event) => updatePrefecturePromptDraft(activeCase.id, { parentPrefecture: event.target.value })}
                      required
                    >
                      <option value="">選択してください</option>
                      {PREFECTURES.map((prefecture) => (
                        <option key={prefecture} value={prefecture}>{prefecture}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>市区町村（必須・番地不要）</span>
                    <input
                      maxLength={80}
                      placeholder="例: 神戸市、西宮市"
                      required
                      value={activePrefecturePromptDraft.parentCity}
                      onChange={(event) => updatePrefecturePromptDraft(activeCase.id, { parentCity: event.target.value })}
                    />
                  </label>
                </div>
                <div className="parent-prefecture-actions">
                  <button
                    className="profile-save-button"
                    type="button"
                    disabled={!activePrefecturePromptDraft.parentPrefecture.trim() || !activePrefecturePromptDraft.parentCity.trim()}
                    onClick={() => saveParentPrefecturePrompt(activeCase.id)}
                  >
                    保存する
                  </button>
                </div>
              </article>
            ) : null}
            <details className="cloud-backup-disclosure" id="cloud-backup" ref={cloudBackupRef}>
              <summary>
                <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                <span>手帳データの保存先</span>
                <strong>{cloudUserEmail ? "この端末とクラウドに保存" : "今はこの端末だけに保存"}</strong>
              </summary>
              <article className={`nb-card cloud-backup-card cloud-guard-card is-${cloudStatus}`} aria-label="手帳データの保存先">
                <div className="cloud-backup-head">
                  <div className="cloud-backup-icon" aria-hidden="true">
                    <img src="/brand/watch-bird-mark.svg" alt="" />
                  </div>
                  <div>
                    <p className="nb-eyebrow">手帳データの保存先</p>
                    <h2>{cloudUserEmail ? "この手帳はクラウドにも保存されています" : "今はこの端末だけに保存されています"}</h2>
                    <p>
                      {cloudUserEmail
                        ? "プロフィール、日記、写真メモ、確認リストの変更はクラウドへ自動保存されます。"
                        : "クラウド保存とは、手帳の控えをインターネット上にも残す機能です。記録の変更を自動で控えに残し、履歴削除・機種変更・端末故障のあとも、メール確認で手帳を戻せます。使うかどうかは任意です。"}
                    </p>
                  </div>
                </div>
                <ul className="cloud-trust-list" aria-label={cloudUserEmail ? "クラウド保存でできること" : "クラウド保存をおすすめする理由"}>
                  {cloudUserEmail ? (
                    <>
                      <li>変更のたびにクラウドへ自動保存します</li>
                      <li>機種変更後もメール確認で復元できます</li>
                      <li>家族共有の土台になります</li>
                    </>
                  ) : (
                    <>
                      <li>日記・プロフィール・確認リストの変更を自動で控えに残します</li>
                      <li>履歴削除・機種変更・端末故障のあともメール確認で戻せます</li>
                      <li>家族と同じ手帳を共有する時の保存先になります</li>
                    </>
                  )}
                </ul>
                {cloudUserEmail ? (
                  <div className="cloud-linked-box">
                    <span>クラウド保存先</span>
                    <strong>{cloudUserEmail}</strong>
                    <div className={`cloud-auto-line is-${cloudAutoStatus}`}>
                      <span aria-hidden="true" />
                      <em>
                        {cloudAutoStatus === "saving"
                          ? "自動保存中です"
                          : cloudAutoStatus === "error"
                            ? "自動保存を確認してください"
                            : lastCloudSyncedAt
                              ? `最終保存 ${cloudSyncTimeLabel(lastCloudSyncedAt)}`
                              : "変更が入ると自動で保存します"}
                      </em>
                    </div>
                  </div>
                ) : (
                  <div className="cloud-form">
                    <label>
                      <span>クラウド保存に使うメールアドレス</span>
                      <input
                        inputMode="email"
                        placeholder="例: family@example.com"
                        type="email"
                        value={cloudEmail}
                        onChange={(event) => setCloudEmail(event.target.value)}
                      />
                    </label>
                    <button type="button" onClick={requestCloudLink} disabled={cloudStatus === "sending"}>
                      {cloudStatus === "sending" ? "送信中" : "メールでクラウド保存を始める"}
                    </button>
                  </div>
                )}
                <p className="cloud-message">{cloudMessage}</p>
                <div className="cloud-action-row">
                  <button type="button" onClick={() => syncNotebookToCloud()} disabled={!cloudUserEmail || cloudStatus === "syncing" || cloudAutoStatus === "saving"}>
                    今すぐ保存
                  </button>
                  <button type="button" onClick={() => restoreNotebookFromCloud()} disabled={!cloudUserEmail || cloudStatus === "syncing" || cloudAutoStatus === "saving"}>
                    復元
                  </button>
                  <button type="button" onClick={downloadNotebookExport}>
                    ダウンロード
                  </button>
                </div>
                <small>暗証番号・パスワード・マイナンバー画像は保存対象にしないでください。</small>
              </article>
            </details>
            <nav className="notebook-tab-bar" aria-label={`${activePersonName}の手帳ページ`}>
              {notebookTabs.map((tab) => (
                <button
                  className={activeNotebookTab === tab.id ? "is-active" : ""}
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveNotebookTab(tab.id);
                    if (tab.id === "profile") setProfileEditorOpen(true);
                    if (tab.id === "tasks") markMonitorActivity("checklistOpened");
                  }}
                >
                  <strong>{tab.label}</strong>
                  <small>{notebookTabNote(tab.id)}</small>
                </button>
              ))}
            </nav>
          </section>

          <section className={`nb-section ${activeNotebookTab === "overview" ? "" : "is-hidden-tab"}`} aria-label="今日見るところ">
            <div className="nb-section-head">
              <strong>今日見るところ</strong>
              <span className="rule" aria-hidden="true" />
              <span className="aside">{boardDateLabel()}</span>
            </div>
            <div className="nb-card">
              {todayRows.map((alert) => {
                const href = normalizeAlertHref(alert.href);
                return (
                  <a
                    className={`nb-row is-${alert.tone}`}
                    href={href}
                    key={`${alert.title}-${alert.body}`}
                    onClick={(event) => {
                      if (!href.startsWith("#")) return;
                      event.preventDefault();
                      openNotebookSection(href);
                    }}
                  >
                    <span className="lead">{alert.tone === "urgent" ? "急ぎ" : alert.tone === "warning" ? "確認" : "安心"}</span>
                    <strong>{alert.title}</strong>
                    <small>{alert.body}</small>
                    <span className="chev" aria-hidden="true">›</span>
                  </a>
                );
              })}
            </div>
            <MascotNote
              label="今日の見方"
              title="全部見なくて大丈夫。まず上の2つだけ。"
              body="手帳は毎日長く触るものではなく、必要な日に迷わず戻れる場所として使います。"
            />
          </section>

          {notebookInsight ? (
            <section className={`nb-section ${activeNotebookTab === "overview" ? "" : "is-hidden-tab"}`} aria-label="今日の一手">
              <article className="nb-card next-action-card">
                <div className="next-action-head">
                  <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                  <div>
                    <span>今日の一手</span>
                    <strong>{notebookInsight.primaryAction.title}</strong>
                    <p>{notebookInsight.primaryAction.body}</p>
                  </div>
                </div>
                <a
                  className="next-action-button"
                  href={notebookInsight.primaryAction.href}
                  onClick={(event) => {
                    if (!notebookInsight.primaryAction.href.startsWith("#")) return;
                    event.preventDefault();
                    openNotebookSection(notebookInsight.primaryAction.href);
                  }}
                >
                  {notebookInsight.primaryAction.label}
                </a>
                <div className="family-share-note">
                  <div>
                    <span>家族に送るなら</span>
                    <p>{notebookInsight.familyMessage}</p>
                  </div>
                  <button type="button" onClick={() => copyFamilyMessage(notebookInsight.familyMessage)}>
                    {familyMessageCopied ? "コピー済み" : "コピー"}
                  </button>
                </div>
                <div className="watch-point-list" aria-label="今日の確認ポイント">
                  {notebookInsight.watchPoints.map((point) => <span key={point}>{point}</span>)}
                </div>
              </article>
            </section>
          ) : null}

          <section className={`nb-section ${activeNotebookTab === "overview" ? "" : "is-hidden-tab"}`} aria-label="記録から見えること">
            <div className="nb-section-head">
              <strong>記録から見えること</strong>
              <span className="rule" aria-hidden="true" />
              <a
                className="aside-link"
                href="#diary-history"
                onClick={(event) => {
                  event.preventDefault();
                  openNotebookSection("#diary-history");
                }}
              >
                過去の記録へ
              </a>
            </div>
            {recordDigest ? (
              <article className="record-digest-card overview-memory-card">
                <div className="record-digest-head">
                  <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                  <div>
                    <span>最近のまとめ</span>
                    <strong>{recordDigest.latestLabel}</strong>
                  </div>
                </div>
                <p>{recordDigest.summary}</p>
                <div className="record-digest-stats" aria-label="記録の集計">
                  {recordDigest.stats.map((item) => (
                    <div key={item.label}>
                      <strong>{item.value}</strong>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="record-tags" aria-label="記録から見えるテーマ">
                  {recordDigest.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                {notebookInsight ? (
                  <div className="overview-memory-next">
                    <span>次に見ておくこと</span>
                    <strong>{notebookInsight.forecastTitle}</strong>
                    <p>{notebookInsight.forecastBody}</p>
                  </div>
                ) : null}
                <div className="overview-memory-actions">
                  <a
                    href="#diary-history"
                    onClick={(event) => {
                      event.preventDefault();
                      openNotebookSection("#diary-history");
                    }}
                  >
                    過去の記録を見る
                  </a>
                  <a
                    href="#today-diary"
                    onClick={(event) => {
                      event.preventDefault();
                      openNotebookSection("#today-diary");
                    }}
                  >
                    今日の記録を書く
                  </a>
                </div>
              </article>
            ) : (
              <article className="nb-card overview-empty-memory-card">
                <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                <div>
                  <span>まだ記録はありません</span>
                  <strong>まず今日の様子を1行だけ残すと、ここに振り返りが出ます。</strong>
                  <p>体調、薬、病院とのやりとり、家族に頼んだこと。短くても、あとで見返せる手帳になります。</p>
                </div>
                <a
                  href="#today-diary"
                  onClick={(event) => {
                    event.preventDefault();
                    openNotebookSection("#today-diary");
                  }}
                >
                  今日の記録を書く
                </a>
              </article>
            )}
          </section>

          {visibleSupportActions.length > 0 ? (
            <section className={`nb-section ${activeNotebookTab === "overview" ? "" : "is-hidden-tab"}`} aria-label="次に備えること">
              <div className="nb-section-head">
                <strong>次に備えること</strong>
                <span className="rule" aria-hidden="true" />
                <span className="aside">おすすめ順</span>
              </div>
              <div className="support-action-list">
                {visibleSupportActions.map((action) => (
                  <a
                    className="support-action-card"
                    href={action.href}
                    key={action.title}
                    onClick={(event) => {
                      if (!action.href.startsWith("#")) return;
                      event.preventDefault();
                      openNotebookSection(action.href);
                    }}
                  >
                    <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                    <span>{action.label}</span>
                    <div>
                      <strong>{action.title}</strong>
                      <p>{action.body}</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section className={`nb-section ${activeNotebookTab === "overview" ? "" : "is-hidden-tab"}`} aria-label="必要な時だけ使う機能">
            <details className="nb-card optional-tools-card">
              <summary>
                <span>必要な時だけ使う</span>
                <strong>共有・相談・緊急カード</strong>
                <small>ふだんは閉じておき、必要になった時だけ開きます。</small>
              </summary>
              <div className="optional-tool-list">
                <Link className="optional-tool" href="/family">
                  <span>家族共有</span>
                  <strong>{isSharedFamilyMember ? "共有状態を見る" : "家族を招待する"}</strong>
                  <small>
                    {isSharedFamilyMember
                      ? "追加課金の手続きは不要です。作成者の手帳を一緒に更新します。"
                      : `病院に聞く人、支払いを見る人、写真を残す人を分けられます。あなたのほかに${FREE_PLAN_MEMBER_LIMIT}人まで無料です。`}
                  </small>
                </Link>
                <Link className="optional-tool" href="/consult">
                  <span>AI相談</span>
                  <strong>AI相談チャットを開く</strong>
                  <small>この人のプロフィールと最近の記録を読んで、次に確認することを一緒に整理します。</small>
                </Link>
                <Link className="optional-tool" href={`/emergency-card/${activeCase.id}`}>
                  <span>緊急カード</span>
                  <strong>印刷用の1枚を作る</strong>
                  <small>緊急連絡先、病院・施設、薬の注意だけをA5サイズで印刷できます。</small>
                </Link>
              </div>
            </details>
          </section>

          <section className={`nb-section ${activeNotebookTab === "record" ? "" : "is-hidden-tab"}`} id="today-diary">
            <div className="nb-section-head">
              <strong>日付を選んで記録を書く</strong>
              <span className="rule" aria-hidden="true" />
              <span className="aside">{activeEntries.length}件</span>
            </div>
            <article className="nb-card today-record-card">
              <div className="record-guide">
                <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                <p className="record-help">体調、会話、病院や介護先からの連絡を短く残します。保存すると、この下にナビからのひとことと、日付別の記録が残ります。</p>
              </div>
              <div className="record-chip-grid" aria-label="今日の記録に追加する項目">
                {healthNotes.map((item) => (
                  <button className={`record-chip is-${item.tone}`} key={item.title} type="button" onClick={() => appendDiaryNote(activeCase.id, item.note)}>
                    <span aria-hidden="true" />
                    <strong>{item.title}</strong>
                  </button>
                ))}
              </div>
              <div className="record-date-row">
                <label>
                  記録する日付
                  <input
                    type="date"
                    value={activeForm.date || todayInputValue()}
                    onChange={(event) => updateForm(activeCase.id, { date: event.target.value })}
                  />
                </label>
                <span>過去の日も選べます。あとでカレンダーから見返せます。</span>
              </div>
              <label className="diary-label" htmlFor={`diary-${activeCase.id}`}>
                この日に残すこと
              </label>
              <textarea
                id={`diary-${activeCase.id}`}
                placeholder="例: 今日は退院後はじめて訪問看護の日。薬の飲み忘れが少しあった。次回通院は長女に相談する。"
                value={activeForm.body}
                onChange={(event) => updateForm(activeCase.id, { body: event.target.value })}
              />
              <details className="diary-voice-help">
                <summary>声で入力する方法を見る（使わなくても大丈夫）</summary>
                <ol>
                  <li>上の白い入力欄を押します。</li>
                  <li>画面下に出る文字入力画面（キーボード）の「🎤」を押します。</li>
                  <li>残したい内容を話します。</li>
                </ol>
                <p>「🎤」が見当たらない時は、そのまま文字で入力してください。</p>
              </details>
              <div className="record-tool-row">
                <div className="mood-choice">
                  <div className="mood-choice-head">
                    <strong>記録の種類を選ぶ</strong>
                    <span>3つから1つ選択できます</span>
                  </div>
                  <div className="mood-segment" aria-label="今日の変化">
                    {([
                      ["stable", "通常"],
                      ["changed", "変化あり"],
                      ["urgent", "急ぎ"]
                    ] as const).map(([value, label]) => (
                      <button
                        aria-pressed={activeForm.mood === value}
                        className={activeForm.mood === value ? "is-active" : ""}
                        key={value}
                        type="button"
                        onClick={() => updateForm(activeCase.id, { mood: value })}
                      >
                        <span>{label}</span>
                        {activeForm.mood === value ? <small>選択中</small> : null}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="file-button">
                  写真を追加
                  <input
                    accept="image/*"
                    multiple
                    type="file"
                    onChange={(event) => {
                      void attachFiles(activeCase.id, event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              {activeForm.files.length > 0 ? (
                <div className="attachment-strip">
                  {activeForm.files.map((file) => (
                    <span className={file.previewUrl ? "has-preview" : file.storagePath ? "is-uploaded-photo" : undefined} key={file.id}>
                      {file.previewUrl ? <img alt="" src={file.previewUrl} /> : file.storagePath ? <img alt="" src="/brand/watch-bird-mark.svg" /> : null}
                      <small>{file.previewUrl ? file.name : file.storagePath ? "写真を保存済み" : file.name}</small>
                    </span>
                  ))}
                </div>
              ) : null}
              {recordStorageMessage ? (
                <p className={`record-storage-message is-${recordStorageTone}`}>{recordStorageMessage}</p>
              ) : null}
              <button className="nb-save" type="button" onClick={() => saveDiary(activeCase.id)}>
                この人の手帳に残す
              </button>
            </article>
            {savedDiaryEntry ? (
              <article className="nb-card diary-save-complete-card" id="diary-save-complete" role="status" aria-live="polite">
                <div className="diary-save-complete-head">
                  <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                  <div>
                    <span>保存しました</span>
                    <strong>{formatLongDate(savedDiaryEntry.date)}の記録を手帳に残しました。</strong>
                    <p>この下の過去の手帳にも反映されています。続けて相談・編集・見返しができます。</p>
                  </div>
                </div>
                <div className="diary-save-complete-body">
                  <span className={`mood-badge is-${savedDiaryEntry.mood}`}>{moodLabel(savedDiaryEntry.mood)}</span>
                  <p>{savedDiaryEntry.body}</p>
                </div>
                <div className="diary-save-complete-actions">
                  <button className="is-primary" type="button" onClick={() => openConsultFromEntry(savedDiaryEntry)}>
                    この記録でAI相談する
                  </button>
                  <button type="button" onClick={() => openNotebookSection("#diary-history")}>
                    保存された記録を見る
                  </button>
                  <button type="button" onClick={() => openDiaryEditorAndScroll(savedDiaryEntry)}>
                    この記録を編集する
                  </button>
                </div>
                <small>AI相談は1日1回無料です。同じ日に続けて相談したい時はFamily Plus（月980円・年9,800円）で使えます。</small>
              </article>
            ) : null}
          </section>

          {latestEntry && notebookInsight ? (
            <section className={`nb-section ${activeNotebookTab === "record" ? "" : "is-hidden-tab"}`} aria-label="ナビからの次の一歩">
              <article className="kizuki-card">
                <img className="kizuki-mascot" src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                <span className="tag">ナビからのひとこと</span>
                <strong>{notebookInsight.patternTitle}</strong>
                <p>{notebookInsight.patternBody}</p>
                <div className="kizuki-forecast">
                  <span>次に備えること</span>
                  <b>{notebookInsight.forecastTitle}</b>
                  <p>{notebookInsight.forecastBody}</p>
                </div>
                <div className="kizuki-question">
                  <span>次に家族で聞くこと</span>
                  <b>{notebookInsight.questions[0]}</b>
                  {notebookInsight.questions.length > 1 ? (
                    <ul className="kizuki-question-list">
                      {notebookInsight.questions.slice(1).map((question) => <li key={question}>{question}</li>)}
                    </ul>
                  ) : null}
                </div>
                <small>記録から見る観点の整理です。医療・法律・税務の判断はしません。</small>
              </article>
            </section>
          ) : null}

          <section className={`nb-section ${activeNotebookTab === "record" ? "" : "is-hidden-tab"}`} aria-label="AI相談チャットの使い方">
            <article className="nb-card record-ai-card">
              <div className="record-ai-head">
                <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                <div>
                  <span>AI相談チャット</span>
                  <strong>
                    {latestEntry ? "記録を書いたら、その内容でそのまま相談できます。" : "記録が1件あると、相談が具体的になります。"}
                  </strong>
                  <p>
                    保存後に出る「この記録でAI相談する」から、質問文が入ったチャットへ進みます。毎回ゼロから説明しなくてよくなります。
                  </p>
                  <p className="record-ai-storage-note">
                    AIの回答は自動保存されません。残したい回答で「この回答を手帳に残す」を押すと、「過去の手帳」にAI相談メモとして保存されます。
                  </p>
                </div>
              </div>
              <div className="record-ai-actions">
                <button type="button" onClick={openConsultFromDigest}>最近の記録でAI相談する</button>
                <a
                  href="#diary-history"
                  onClick={(event) => {
                    event.preventDefault();
                    openNotebookSection("#diary-history");
                  }}
                >
                  過去の記録を見る
                </a>
              </div>
              <small>相談内容は医療・法律・税務の判断ではありません。必要な判断は主治医や専門家に確認してください。</small>
            </article>
          </section>

          {journeyCards.length > 0 ? (
            <section className={`nb-section ${activeNotebookTab === "overview" ? "" : "is-hidden-tab"}`} aria-label="これからの道すじ">
              <div className="nb-section-head">
                <strong>これからの道すじ</strong>
                <span className="rule" aria-hidden="true" />
                <span className="aside">手帳の流れ</span>
              </div>
              <article className="nb-card journey-card">
                <MascotNote
                  label="この先の見方"
                  title="状態が変わっても、この順で足せば大丈夫です。"
                  body="入院中、退院後、介護、亡くなった後、実家じまいまで、同じ人の手帳に記録を重ねます。"
                />
                <ol className="journey-list">
                  {journeyCards.map((item) => (
                    <li className={`is-${item.state}`} key={item.label}>
                      <span
                        className="journey-state"
                        role="img"
                        aria-label={item.state === "done" ? "済み" : item.state === "now" ? "いま" : "このあと"}
                      >
                        <i className="journey-mark" aria-hidden="true" />
                      </span>
                      <div>
                        <small>{item.label}</small>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            </section>
          ) : null}

          <section className={`nb-section ${activeNotebookTab === "record" ? "" : "is-hidden-tab"}`} id="diary-history">
            <div className="nb-section-head">
              <strong>過去の手帳</strong>
              <span className="rule" aria-hidden="true" />
              <span className="aside">{activeEntries.length > 0 ? `${activeEntries.length}件` : "未記録"}</span>
            </div>
            <article className="nb-card history-card">
              {activeEntries.length > 0 ? (
                <DiaryCalendar
                  entries={activeEntries}
                  month={diaryCalendarMonth}
                  selectedDate={selectedDiaryDate}
                  onMonthChange={setDiaryCalendarMonth}
                  onSelectDate={(date) => {
                    setSelectedDiaryDate(date);
                    setRecordFilter("all");
                  }}
                  onClearDate={() => setSelectedDiaryDate(null)}
                />
              ) : null}
              {activeEntries.length > 0 ? (
                <div className="history-record-list" id="diary-history-records">
                  <div className="history-record-list-head">
                    <div>
                      <span>{selectedDiaryDate ? "選んだ日の記録" : "保存した記録"}</span>
                      <strong>{selectedDiaryDate ? formatLongDate(selectedDiaryDate) : "すべての記録"}</strong>
                    </div>
                    <em>{filteredEntries.length}件</em>
                  </div>
                  <div className="record-filter-tabs" aria-label="記録の絞り込み">
                    {([
                      ["all", "すべて"],
                      ["changed", "変化・急ぎ"],
                      ["attachments", "写真"]
                    ] as const).map(([value, label]) => (
                      <button
                        className={recordFilter === value ? "is-active" : ""}
                        key={value}
                        type="button"
                        onClick={() => setRecordFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {diaryGroups.length > 0 ? (
                    <div className="diary-timeline">
                      {diaryGroups.map((group) => {
                        const monthEntries = activeEntries.filter((entry) => entry.date.startsWith(group.month));

                        return (
                          <section className="diary-month-group" key={group.month}>
                          <div className="diary-month-head">
                            <h3>{monthLabel(group.month)}</h3>
                            <p>{group.items.length}件 / 変化 {group.changedCount}件 / 写真 {group.attachmentCount}件</p>
                          </div>
                          {group.items.map((entry) => {
                            const editForm = diaryEditForms[entry.id] ?? diaryEditSeed(entry);
                            const isEditing = editingDiaryId === entry.id;

                            return (
                              <article className={`diary-entry-card ${isEditing ? "is-editing" : ""}`} id={`diary-entry-${entry.id}`} key={entry.id}>
                                <div className="diary-entry-meta">
                                  <time>{formatLongDate(entry.date)}</time>
                                  <span className={`mood-badge ${entry.body.trimStart().startsWith("相談メモ:") ? "is-consult" : `is-${entry.mood}`}`}>
                                    {entry.body.trimStart().startsWith("相談メモ:") ? "AI相談メモ" : moodLabel(entry.mood)}
                                  </span>
                                </div>
                                {isEditing ? (
                                  <div className="diary-edit-panel" aria-label="日記の編集">
                                    <div className="diary-edit-panel-head">
                                      <strong>この記録を編集しています</strong>
                                      <p>内容を直したら、一番下の「変更を保存する」を押してください。記録内容は空欄では保存できません。</p>
                                    </div>
                                    <label>
                                      日付
                                      <input
                                        type="date"
                                        value={editForm.date}
                                        onChange={(event) => updateDiaryEditForm(entry.id, { date: event.target.value })}
                                      />
                                    </label>
                                    <label>
                                      記録内容
                                      <textarea
                                        value={editForm.body}
                                        onChange={(event) => updateDiaryEditForm(entry.id, { body: event.target.value })}
                                      />
                                    </label>
                                    <div className="mood-choice">
                                      <div className="mood-choice-head">
                                        <strong>記録の種類を選ぶ</strong>
                                        <span>3つから1つ選択できます</span>
                                      </div>
                                      <div className="mood-segment" aria-label="記録の種類">
                                        {([
                                          ["stable", "通常"],
                                          ["changed", "変化あり"],
                                          ["urgent", "急ぎ"]
                                        ] as const).map(([value, label]) => (
                                          <button
                                            aria-pressed={editForm.mood === value}
                                            className={editForm.mood === value ? "is-active" : ""}
                                            key={value}
                                            type="button"
                                            onClick={() => updateDiaryEditForm(entry.id, { mood: value })}
                                          >
                                            <span>{label}</span>
                                            {editForm.mood === value ? <small>選択中</small> : null}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="diary-edit-actions">
                                      <button disabled={!editForm.body.trim()} type="button" onClick={() => saveDiaryEdit(activeCase.id, entry.id)}>変更を保存する</button>
                                      <button type="button" onClick={() => closeDiaryEditor(entry)}>変更せず閉じる</button>
                                    </div>
                                  </div>
                                ) : (
                                  <p>{entry.body}</p>
                                )}
                                {entry.attachments.length > 0 ? (
                                  <div className="entry-attachments">
                                    {entry.attachments.slice(0, 3).map((file) => (
                                      <span className={file.previewUrl ? "has-preview" : file.storagePath ? "is-uploaded-photo" : undefined} key={file.id}>
                                        {file.previewUrl ? <img alt="" src={file.previewUrl} /> : file.storagePath ? <img alt="" src="/brand/watch-bird-mark.svg" /> : null}
                                        <small>{file.previewUrl ? file.name : file.storagePath ? "写真を保存済み" : file.name}</small>
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                <div className="diary-entry-actions">
                                  <button
                                    disabled={editingDiaryId === entry.id}
                                    type="button"
                                    onClick={() => openDiaryEditor(entry)}
                                  >
                                    <strong>{editingDiaryId === entry.id ? "上で編集中" : "内容を編集する"}</strong>
                                    <small>日付や記録内容を直す</small>
                                  </button>
                                  <button type="button" onClick={() => addDiaryTask(activeCase.id, entry)}>
                                    <strong>確認することを作る</strong>
                                    <small>家族や病院にあとで聞く項目</small>
                                  </button>
                                  <button type="button" onClick={() => openConsultFromEntry(entry)}>
                                    <strong>AIに相談する</strong>
                                    <small>この記録をもとに質問する</small>
                                  </button>
                                </div>
                                {diaryUpdatedId === entry.id ? <small className="entry-feedback" role="status">変更を保存しました。</small> : null}
                                {taskAddedEntryId === entry.id ? (
                                  <small className="entry-feedback" role="status">
                                    「{diaryTaskTitle(entry)}」を、あとで確認することに追加しました。
                                  </small>
                                ) : null}
                                <div className="entry-advice">
                                  <strong>ナビからの寄り添い</strong>
                                  <em>{diaryCompanionComment(entry)}</em>
                                  <p>この記録を読むと、次はここだけ見ておくと安心です。</p>
                                  <ul>
                                    {diaryAdvice(entry).map((item) => <li key={item}>{item}</li>)}
                                  </ul>
                                </div>
                              </article>
                            );
                          })}
                          <details className="month-review-disclosure">
                            <summary>
                              <strong>{formatMonthTitle(group.month)}のまとめを見る</strong>
                              <span>この月の記録から自動作成・自動更新</span>
                            </summary>
                            <MonthReview
                              entries={monthEntries}
                              profile={activeProfile}
                              onConsult={(question) => {
                                if (!activeCase) return;
                                openConsultDraft({
                                  caseId: activeCase.id,
                                  entryId: monthEntries[0]?.id,
                                  sourceLabel: `${monthLabel(group.month)}から`,
                                  question
                                });
                              }}
                            />
                          </details>
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="diary-empty">
                      {selectedDiaryDate
                        ? `${formatLongDate(selectedDiaryDate)}には表示できる記録がありません。別の日を選ぶか、「全日付の記録を表示」を押してください。`
                        : "この絞り込みに合う記録はありません。"}
                    </p>
                  )}
                </div>
              ) : null}
              {activeEntries.length === 0 ? (
                <p className="diary-empty">まだ記録はありません。「今日の記録を書く」から、まず1行残してください。</p>
              ) : null}
            </article>
          </section>

          <section className={`nb-section ${activeNotebookTab === "profile" ? "" : "is-hidden-tab"}`} id="person-profile">
            <div className="nb-section-head">
              <strong>プロフィール</strong>
              <span className="rule" aria-hidden="true" />
              <span className="aside">{activeMissingProfileItems.length > 0 ? `あと${activeMissingProfileItems.length}項目` : "入力済み"}</span>
            </div>
            <article className="nb-card profile-summary-card">
              <div className="profile-summary-head">
                <div className="profile-avatar is-symbol" aria-hidden="true">
                  <img src="/brand/watch-bird-mark.svg" alt="" />
                </div>
                <div>
                  <p>{progressLabel(activeCase)}</p>
                  <h2>{activePersonName}</h2>
                  <span>{activeRelationship} · {activeCareStatus}</span>
                </div>
              </div>
              <div className="profile-completion">
                <div>
                  <span>プロフィール充実度</span>
                  <strong>{activeProfileCompletion.percent}%</strong>
                </div>
                <div className="profile-progress-track" aria-hidden="true">
                  <span style={{ width: `${activeProfileCompletion.percent}%` }} />
                </div>
                <small>{activeProfileCompletion.filled}/{activeProfileCompletion.total}項目 入力済み</small>
              </div>
              <div className="profile-edit-guide">
                <div>
                  <strong>基本情報を足すほど、日記・確認リスト・相談が使いやすくなります。</strong>
                  <p>まずはフルネーム、病院・ケア先、緊急連絡先だけでも入れておくと、家族で同じ前提を持てます。</p>
                </div>
                <button type="button" onClick={() => setProfileEditorOpen(true)}>
                  プロフィールを編集する
                </button>
              </div>
              {activeMissingProfileItems.length > 0 ? (
                <div className="profile-missing-box" aria-label="未入力のプロフィール項目">
                  <span>まだ足せる項目</span>
                  <div>
                    {activeMissingProfileItems.slice(0, 5).map((item) => <b key={item}>{item}</b>)}
                    {activeMissingProfileItems.length > 5 ? <b>ほか{activeMissingProfileItems.length - 5}項目</b> : null}
                  </div>
                </div>
              ) : (
                <div className="profile-missing-box is-complete">
                  <span>プロフィール</span>
                  <strong>必要な基本情報はそろっています。変化があればいつでも更新できます。</strong>
                </div>
              )}
              <div className="profile-row-grid compact-profile-rows">
                {summarizeProfile(activeCase, activeProfile ?? {}).map((row) => (
                  <div className={row.value === "未入力" ? "is-missing" : ""} key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
              <details
                className="profile-edit-drawer"
                open={profileEditorOpen || activeProfileCompletion.percent < 85}
                onToggle={(event) => setProfileEditorOpen(event.currentTarget.open)}
              >
                <summary>編集欄を開く・閉じる</summary>
                {activeProfile ? (
                  <div className="profile-form-grid" id="profile-edit-fields" aria-label="対象者プロフィール編集">
                    <label>
                      <span>フルネーム</span>
                      <input
                        placeholder="例: 山田 太郎"
                        value={activeProfile.fullName ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { fullName: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>呼び名</span>
                      <input
                        placeholder="例: お父さん、太郎さん"
                        value={activeProfile.displayName ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { displayName: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>関係</span>
                      <input
                        placeholder="例: 父、義母、叔父"
                        value={activeProfile.relationship ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { relationship: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>親御さんの居住都道府県（必須）</span>
                      <select
                        value={activeProfile.parentPrefecture ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { parentPrefecture: event.target.value })}
                        required
                      >
                        <option value="">選択してください</option>
                        {PREFECTURES.map((prefecture) => (
                          <option key={prefecture} value={prefecture}>{prefecture}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>市区町村（必須・番地不要）</span>
                      <input
                        maxLength={80}
                        placeholder="例: 神戸市、西宮市"
                        required
                        value={activeProfile.parentCity ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { parentCity: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>あなたの都道府県（任意）</span>
                      <select
                        value={activeProfile.userPrefecture ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { userPrefecture: event.target.value })}
                      >
                        <option value="">選択しない</option>
                        {PREFECTURES.map((prefecture) => (
                          <option key={prefecture} value={prefecture}>{prefecture}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>生年月日</span>
                      <input
                        type="date"
                        value={activeProfile.birthDate ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { birthDate: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>いまの状態</span>
                      <input
                        placeholder="例: 退院後・在宅療養"
                        value={activeProfile.careStatus ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { careStatus: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>主な連絡窓口</span>
                      <input
                        placeholder="例: 長女が病院連絡、長男が支払い"
                        value={activeProfile.keyContact ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { keyContact: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>家族構成</span>
                      <input
                        placeholder="例: 長男、長女、同居なし"
                        value={activeProfile.familyStructureNote ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { familyStructureNote: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>緊急連絡先</span>
                      <input
                        placeholder="例: 夜間は長男、病院からは長女"
                        value={activeProfile.emergencyContact ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { emergencyContact: event.target.value })}
                      />
                    </label>
                    <label className="profile-wide-field">
                      <span>病院・施設・ケア先</span>
                      <textarea
                        placeholder="例: 〇〇病院 退院支援窓口、訪問看護ステーション名など"
                        value={activeProfile.hospitalOrFacility ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { hospitalOrFacility: event.target.value })}
                      />
                    </label>
                    <label className="profile-wide-field">
                      <span>薬・注意点</span>
                      <textarea
                        placeholder="例: 飲み忘れ注意、薬の変更があった日、避けたい対応など"
                        value={activeProfile.medicationNote ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { medicationNote: event.target.value })}
                      />
                    </label>
                    <label className="profile-wide-field">
                      <span>書類・鍵などの保管メモ</span>
                      <textarea
                        placeholder="暗証番号やパスワードは書かず、存在と保管場所だけを残します。"
                        value={activeProfile.documentLocationNote ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { documentLocationNote: event.target.value })}
                      />
                    </label>
                    <label className="profile-wide-field">
                      <span>ケアで大事にしたいこと</span>
                      <textarea
                        placeholder="例: できるだけ自宅で過ごしたい。強い言い方は避けたい。"
                        value={activeProfile.carePreference ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { carePreference: event.target.value })}
                      />
                    </label>
                    <label className="profile-wide-field">
                      <span>会わせたい人・伝えたいこと</span>
                      <textarea
                        placeholder="例: 孫に会うと元気になる。昔の友人〇〇さんに連絡したい。"
                        value={activeProfile.importantPeopleNote ?? ""}
                        onChange={(event) => updateProfileForm(activeCase.id, { importantPeopleNote: event.target.value })}
                      />
                    </label>
                  </div>
                ) : null}
                <p className="profile-safe-note">暗証番号・パスワード・マイナンバーの画像は保管できません。</p>
                <div className="profile-save-row">
                  <button className="profile-save-button" type="button" onClick={() => saveProfile(activeCase.id)}>
                    保存する
                  </button>
                  {profileLocationErrorCaseId === activeCase.id ? (
                    <span role="alert">都道府県と市区町村の両方を入力してください。</span>
                  ) : profileSavedCaseId === activeCase.id ? (
                    <span>保存しました</span>
                  ) : (
                    <small>あとから何度でも更新できます。</small>
                  )}
                </div>
              </details>
            </article>
          </section>

          <section className={`nb-section ${activeNotebookTab === "tasks" ? "" : "is-hidden-tab"}`} id="task-checklist">
            <div className="nb-section-head">
              <strong>確認リスト</strong>
              <span className="rule" aria-hidden="true" />
              <Link className="aside-link" href={`/result/${activeCase.id}`}>整理結果を見る</Link>
            </div>
            <article className="nb-card task-list-card">
              <p className="task-list-help">
                確認リストは、病院に聞くことや家族へ頼むことを、あとで忘れず確認するための一覧です。既存カードを押すと編集、新しく気づいたことは下の「確認項目を追加」から足せます。
              </p>
              <div className={`task-add-card ${taskComposerOpen ? "is-open" : ""}`}>
                <div className="task-add-head">
                  <div>
                    <span>家族で決めたことを足す</span>
                    <strong>確認項目を追加</strong>
                    <p>病院に聞くこと、家族へ頼むこと、写真で残すことを1件ずつ追加できます。</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskComposerOpen((current) => !current);
                      setNewTaskSaved(false);
                    }}
                  >
                    {taskComposerOpen ? "閉じる" : "追加する"}
                  </button>
                </div>
                {taskComposerOpen ? (
                  <div className="task-edit-panel task-add-panel">
                    <label className="task-edit-field task-edit-wide">
                      <span>やること</span>
                      <input
                        placeholder="例: 退院後の通院日を病院に確認する"
                        value={newTaskForm.title}
                        onChange={(event) => updateNewTaskForm({ title: event.target.value })}
                      />
                    </label>
                    <label className="task-edit-field task-edit-wide">
                      <span>説明</span>
                      <textarea
                        placeholder="例: 次回通院日、送迎の有無、持ち物を確認して家族に共有する。"
                        value={newTaskForm.description}
                        onChange={(event) => updateNewTaskForm({ description: event.target.value })}
                      />
                    </label>
                    <div className="task-edit-grid">
                      <label className="task-edit-field">
                        <span>期限</span>
                        <input
                          type="date"
                          value={newTaskForm.dueDate}
                          onChange={(event) => updateNewTaskForm({ dueDate: event.target.value })}
                        />
                      </label>
                      <label className="task-edit-field">
                        <span>担当</span>
                        <input
                          placeholder="例: 自分 / 長男 / 妹"
                          value={newTaskForm.assignee}
                          onChange={(event) => updateNewTaskForm({ assignee: event.target.value })}
                        />
                      </label>
                      <label className="task-edit-field">
                        <span>状態</span>
                        <select
                          value={newTaskForm.progress}
                          onChange={(event) => updateNewTaskForm({ progress: event.target.value as TaskEditForm["progress"] })}
                        >
                          <option value="todo">未着手</option>
                          <option value="doing">進行中</option>
                          <option value="done">完了</option>
                        </select>
                      </label>
                      <label className="task-edit-field">
                        <span>優先度</span>
                        <select
                          value={newTaskForm.priority}
                          onChange={(event) => updateNewTaskForm({ priority: event.target.value as TaskEditForm["priority"] })}
                        >
                          <option value="1">急ぎ</option>
                          <option value="2">通常</option>
                          <option value="3">あとで</option>
                        </select>
                      </label>
                    </div>
                    <label className="task-edit-field task-edit-wide">
                      <span>家族メモ</span>
                      <textarea
                        placeholder="例: 兄にLINE済み。返事が来たら担当を決める。"
                        value={newTaskForm.note}
                        onChange={(event) => updateNewTaskForm({ note: event.target.value })}
                      />
                    </label>
                    <div className="task-edit-footer">
                      <button type="button" onClick={() => addManualTask(activeCase.id)}>
                        確認することを追加
                      </button>
                      <button type="button" onClick={() => setTaskComposerOpen(false)}>
                        やめる
                      </button>
                    </div>
                  </div>
                ) : null}
                {newTaskSaved ? <small className="task-add-feedback">確認することを追加しました。</small> : null}
              </div>
              {activeTasks.length > 0 ? (
                <>
                  {activeTasks.slice(0, 8).map((task, taskIndex) => {
                    const key = taskEditKey(activeCase.id, taskIndex);
                    const dateParts = taskDateParts(task.dueDate);
                    const dueDays = daysUntil(task.dueDate);
                    const form = taskForms[key] ?? taskFormSeed(task);
                    const isEditing = editingTaskKey === key;
                    const progress = task.progress ?? "todo";
                    return (
                      <div
                        className={`task-edit-card is-${progress} ${isEditing ? "is-open" : ""}`}
                        key={task.id ?? `${task.title}-${task.dueDate}-${taskIndex}`}
                      >
                        <div className="task-card-top">
                          <button
                            aria-expanded={isEditing}
                            className="task-open-button"
                            type="button"
                            onClick={() => openTaskEditor(activeCase.id, taskIndex, task)}
                          >
                            <span className={`task-date ${dueDays !== null && dueDays <= 3 && progress !== "done" ? "is-near" : ""}`}>
                              <small>{dateParts.month}</small>
                              <b>{dateParts.day}</b>
                            </span>
                            <span className="task-copy">
                              <span className="task-tap-hint">このカードを押すと編集できます</span>
                              <strong>{task.title}</strong>
                              <small>{task.description}</small>
                            </span>
                            <span className={`task-progress-chip is-${progress}`}>{taskProgressLabel(progress)}</span>
                          </button>
                          <button
                            className="task-edit-entry"
                            type="button"
                            onClick={() => openTaskEditor(activeCase.id, taskIndex, task)}
                          >
                            編集する
                          </button>
                        </div>
                        <div className="task-card-meta">
                          <span className={task.assignee ? "is-set" : "is-empty"}>{task.assignee ? `担当: ${task.assignee}` : "担当未定"}</span>
                          <span>優先度: {taskPriorityText(task.priority)}</span>
                          {task.note ? <span>メモあり</span> : null}
                        </div>
                        <div className="task-quick-actions" aria-label={`${task.title}の状態変更`}>
                          <button type="button" onClick={() => quickUpdateTask(activeCase.id, taskIndex, { progress: "doing" })}>
                            進行中
                          </button>
                          <button type="button" onClick={() => quickUpdateTask(activeCase.id, taskIndex, { progress: "done" })}>
                            完了
                          </button>
                          <button type="button" onClick={() => openTaskEditor(activeCase.id, taskIndex, task)}>
                            期限・担当を直す
                          </button>
                          {taskSavedKey === key ? <span>保存しました</span> : null}
                        </div>
                        {isEditing ? (
                          <div className="task-edit-panel">
                            <div className="task-edit-panel-head">
                              <strong>この確認項目を編集</strong>
                              <span>家族で分かる言葉に直して、担当や期限を入れておけます。</span>
                            </div>
                            <label className="task-edit-field task-edit-wide">
                              <span>やること</span>
                              <input
                                value={form.title}
                                onChange={(event) => updateTaskForm(key, { title: event.target.value })}
                              />
                            </label>
                            <label className="task-edit-field task-edit-wide">
                              <span>説明</span>
                              <textarea
                                value={form.description}
                                onChange={(event) => updateTaskForm(key, { description: event.target.value })}
                              />
                            </label>
                            <div className="task-edit-grid">
                              <label className="task-edit-field">
                                <span>期限</span>
                                <input
                                  type="date"
                                  value={form.dueDate}
                                  onChange={(event) => updateTaskForm(key, { dueDate: event.target.value })}
                                />
                              </label>
                              <label className="task-edit-field">
                                <span>担当</span>
                                <input
                                  placeholder="例: 自分 / 長男 / 妹"
                                  value={form.assignee}
                                  onChange={(event) => updateTaskForm(key, { assignee: event.target.value })}
                                />
                              </label>
                              <label className="task-edit-field">
                                <span>状態</span>
                                <select
                                  value={form.progress}
                                  onChange={(event) => updateTaskForm(key, { progress: event.target.value as TaskEditForm["progress"] })}
                                >
                                  <option value="todo">未着手</option>
                                  <option value="doing">進行中</option>
                                  <option value="done">完了</option>
                                </select>
                              </label>
                              <label className="task-edit-field">
                                <span>優先度</span>
                                <select
                                  value={form.priority}
                                  onChange={(event) => updateTaskForm(key, { priority: event.target.value as TaskEditForm["priority"] })}
                                >
                                  <option value="1">急ぎ</option>
                                  <option value="2">通常</option>
                                  <option value="3">あとで</option>
                                </select>
                              </label>
                            </div>
                            <label className="task-edit-field task-edit-wide">
                              <span>家族メモ</span>
                              <textarea
                                placeholder="例: 病院に確認済み。次は長女が書類を持って行く。"
                                value={form.note}
                                onChange={(event) => updateTaskForm(key, { note: event.target.value })}
                              />
                            </label>
                            <div className="task-edit-footer">
                              <button type="button" onClick={() => saveTaskEdit(activeCase.id, taskIndex)}>
                                変更を保存
                              </button>
                              <button type="button" onClick={() => setEditingTaskKey(null)}>
                                編集を閉じる
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </>
              ) : (
                <p className="diary-empty">まだタスクはありません。</p>
              )}
            </article>
          </section>

          <section className={`nb-section ${activeNotebookTab === "media" ? "" : "is-hidden-tab"}`} id="media-library">
            <div className="nb-section-head">
              <strong>写真</strong>
              <span className="rule" aria-hidden="true" />
              <span className="aside">{attachments.length}件</span>
            </div>
            <article className="nb-card media-book-card">
              {attachments.length > 0 ? (
                <div className="media-grid">
                  {attachments.slice(0, 6).map((file) => (
                    <div className="media-tile" key={`${file.id}-${file.entryDate}`}>
                      {file.previewUrl ? <img alt="" src={file.previewUrl} /> : <span>写真</span>}
                      <small>{formatDate(file.entryDate)}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="diary-empty">日記に写真を追加すると、ここにまとまります。</p>
              )}
              <MascotNote
                label="写真の使い方"
                title="実家や書類は、場所が分かる写真が後で効きます。"
                body="鍵、保険証券、部屋の状態、施設からの書類などは、日記に添付しておくと家族で同じ前提を持てます。"
              />
            </article>
          </section>

          {isSharedFamilyMember ? null : (
            <>
              <section className={`nb-section ${activeNotebookTab === "overview" ? "" : "is-hidden-tab"}`} aria-label="この手帳を家族で続ける">
                <article className="nb-card companion-panel">
                  <MascotNote
                    label="続けるなら"
                    title="1人目の手帳が育つほど、家族共有と相談の価値が出ます。"
                    body="まず無料で1人分を使い、家族2人までは一緒に見られる設計にします。2人目以降の対象者、容量、月まとめ、長期相談をPlusで広げます。"
                  />
                  <div className="companion-feature-grid">
                    {continuationFeatures.map((feature) => (
                      <div className="companion-feature" key={feature.title}>
                        <span>{feature.label}</span>
                        <strong>{feature.title}</strong>
                        <p>{feature.body}</p>
                      </div>
                    ))}
                  </div>
                  <Link className="companion-plan-link" href="/plans">
                    Plusでできることを見る
                  </Link>
                </article>
              </section>

              <p className={`nb-plus-note ${activeNotebookTab === "overview" ? "" : "is-hidden-tab"}`}>
                2人目以降の手帳、容量、月まとめ、長期相談は <Link href="/plans">Plus</Link> で。
              </p>
            </>
          )}
        </div>
      ) : null}
    </main>
  );
}
