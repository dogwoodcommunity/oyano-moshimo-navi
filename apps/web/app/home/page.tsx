"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { statusLabel, targetLabel } from "@oyano/shared";
import {
  addDiaryEntry,
  createLocalId,
  diaryAdvice,
  listDiaryEntries,
  listLocalCases,
  updateCaseProfile,
  type CaseRecord,
  type DiaryAttachment,
  type DiaryEntry,
  type PersonProfile
} from "@/lib/store";

type DiaryFormState = {
  body: string;
  mood: DiaryEntry["mood"];
  files: DiaryAttachment[];
};

type TaskWithDue = NonNullable<CaseRecord["result"]>["tasks"][number];
type RecordFilter = "all" | "changed" | "attachments";

const emptyDiaryForm: DiaryFormState = {
  body: "",
  mood: "stable",
  files: []
};

const healthNotes = [
  { tone: "meal", title: "食事・水分", note: "食事や水分量が気になる" },
  { tone: "medicine", title: "薬・服薬", note: "薬・服薬で気になることがある" },
  { tone: "condition", title: "体調", note: "体調に変化があった" },
  { tone: "walking", title: "歩行・転倒", note: "歩行・転倒が心配" },
  { tone: "mood", title: "発言・気分", note: "物忘れ・発言の変化があった" },
  { tone: "contact", title: "病院・介護先", note: "病院・介護先から連絡があった" }
];

const setupPreviewItems = [
  "フルネーム・呼び名・続柄",
  "生年月日・今の状態",
  "病院・施設・主な連絡先",
  "薬や注意点",
  "書類・鍵の保管メモ",
  "写真・PDF付きの日記"
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
  return new Date().toISOString().slice(0, 10);
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

function readFileAsDataUrl(file: File): Promise<string | undefined> {
  if (!file.type.startsWith("image/")) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
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
    careStatus: profile.careStatus ?? statusLabel(caseRecord.selectedStatus),
    keyContact: profile.keyContact ?? "",
    hospitalOrFacility: profile.hospitalOrFacility ?? "",
    medicationNote: profile.medicationNote ?? "",
    documentLocationNote: profile.documentLocationNote ?? ""
  };
}

function profileCompletion(profile: PersonProfile) {
  const fields = [
    profile.fullName,
    profile.displayName,
    profile.relationship,
    profile.birthDate,
    profile.careStatus,
    profile.keyContact,
    profile.hospitalOrFacility,
    profile.medicationNote,
    profile.documentLocationNote
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
    ["生年月日", profile.birthDate],
    ["いまの状態", profile.careStatus],
    ["主な連絡窓口", profile.keyContact],
    ["病院・施設・ケア先", profile.hospitalOrFacility],
    ["薬・注意点", profile.medicationNote],
    ["書類・鍵の保管メモ", profile.documentLocationNote]
  ] as const;

  return items.filter(([, value]) => !value?.trim()).map(([label]) => label);
}

function summarizeProfile(caseRecord: CaseRecord, profile: PersonProfile) {
  return [
    { label: "呼び名", value: profile.displayName || personName(caseRecord) },
    { label: "生年月日", value: profile.birthDate || "未入力" },
    { label: "病院・ケア", value: profile.hospitalOrFacility || "未入力" },
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

function monthLabel(month: string) {
  const [, rawMonth] = month.split("-");
  return `${Number(rawMonth)}月の記録`;
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
  const nextTask = tasks[0];
  const nextTaskDays = daysUntil(nextTask?.dueDate);
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
      href: `/result/${caseId}`
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
    questions: Array.from(questions).slice(0, 4)
  };
}

export default function FamilyBoardPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<Record<string, DiaryEntry[]>>({});
  const [forms, setForms] = useState<Record<string, DiaryFormState>>({});
  const [profileForms, setProfileForms] = useState<Record<string, PersonProfile>>({});
  const [profileSavedCaseId, setProfileSavedCaseId] = useState<string | null>(null);
  const [recordFilter, setRecordFilter] = useState<RecordFilter>("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const localCases = listLocalCases();
    setCases(localCases);
    setActiveCaseId((current) => current ?? localCases[0]?.id ?? null);
    setDiaryEntries(Object.fromEntries(localCases.map((item) => [item.id, listDiaryEntries(item.id)])));
    setProfileForms(Object.fromEntries(localCases.map((item) => [item.id, profileSeed(item)])));
    setLoaded(true);
  }, []);

  const activeCase = useMemo(() => {
    if (cases.length === 0) return undefined;
    return cases.find((item) => item.id === activeCaseId) ?? cases[0];
  }, [activeCaseId, cases]);

  const activeEntries = activeCase ? diaryEntries[activeCase.id] ?? [] : [];
  const activeTasks = activeCase?.result?.tasks ?? [];
  const nextTask = activeTasks[0];
  const activeForm = activeCase ? forms[activeCase.id] ?? emptyDiaryForm : emptyDiaryForm;
  const activeProfile = activeCase ? profileForms[activeCase.id] ?? profileSeed(activeCase) : undefined;
  const activeProfileCompletion = activeProfile ? profileCompletion(activeProfile) : { filled: 0, total: 0, percent: 0 };
  const activeMissingProfileItems = activeProfile ? missingProfileItems(activeProfile) : [];
  const attachments = activeEntries.flatMap((entry) =>
    entry.attachments.map((file) => ({ ...file, entryDate: entry.date }))
  );
  const filteredEntries = activeEntries.filter((entry) => {
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
  const recentEntries = activeEntries.slice(0, 2);

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

  function updateProfileForm(caseId: string, patch: PersonProfile) {
    setProfileSavedCaseId(null);
    setProfileForms((current) => ({
      ...current,
      [caseId]: {
        ...(current[caseId] ?? {}),
        ...patch
      }
    }));
  }

  function saveProfile(caseId: string) {
    const profile = profileForms[caseId];
    if (!profile) return;

    const updated = updateCaseProfile(caseId, profile);
    if (!updated) return;

    setCases((current) => [updated, ...current.filter((item) => item.id !== caseId)]);
    setProfileForms((current) => ({
      ...current,
      [caseId]: profileSeed(updated)
    }));
    setProfileSavedCaseId(caseId);
  }

  async function attachFiles(caseId: string, fileList: FileList | null) {
    const files = Array.from(fileList ?? []).slice(0, 4);
    const nextAttachments = await Promise.all(files.map(async (file) => ({
      id: createLocalId("attachment"),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      previewUrl: await readFileAsDataUrl(file)
    } satisfies DiaryAttachment)));
    const current = forms[caseId] ?? emptyDiaryForm;
    updateForm(caseId, { files: [...current.files, ...nextAttachments].slice(0, 6) });
  }

  function saveDiary(caseId: string) {
    const form = forms[caseId] ?? emptyDiaryForm;
    if (!form.body.trim() && form.files.length === 0) return;
    const entry = addDiaryEntry({
      caseId,
      date: todayInputValue(),
      mood: form.mood,
      body: form.body.trim() || "写真・資料を追加しました。",
      attachments: form.files
    });
    setDiaryEntries((current) => ({
      ...current,
      [caseId]: [entry, ...(current[caseId] ?? [])]
    }));
    setForms((current) => ({
      ...current,
      [caseId]: emptyDiaryForm
    }));
  }

  return (
    <main className={`container board-page family-notebook-page ${activeCase ? "has-active-case" : "is-empty-case"}`}>
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
            <span>{activeCase ? `${activeRelationship} · ${activeCareStatus}` : "家族で進める親の管理帳"}</span>
            <strong>{activeCase ? notebookTitle(activePersonName) : "まず1人分の手帳から"}</strong>
          </div>
          {activeCase ? (
            <a className="cover-profile-link" href="#person-profile">プロフィール</a>
          ) : (
            <Link className="cover-profile-link" href="/start">作る</Link>
          )}
        </div>
        <nav className="cover-tabs" aria-label="手帳の切り替え">
          {activeCase ? (
            <>
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
              <Link href="/plans">＋ 手帳を追加</Link>
            </>
          ) : (
            <>
              <span className="is-active">はじめる</span>
              <Link href="/guides">読む</Link>
              <Link href="/safety">安心</Link>
            </>
          )}
        </nav>
      </section>

      {!loaded ? (
        <section className="nb-card board-empty">
          <h2>読み込み中です</h2>
        </section>
      ) : null}

      {loaded && !activeCase ? (
        <section className="nb-section empty-notebook-section">
          <article className="nb-card empty-notebook-card">
            <div>
              <p className="nb-eyebrow">はじめの一冊</p>
              <h1>この画面が、その人専用の手帳になります。</h1>
              <p>父母、義父母、祖父母、親戚など、まず気になる人を1人だけ登録します。状況を選ぶと、確認リストと毎日の記録欄ができます。</p>
            </div>
            <div className="setup-preview-grid" aria-label="登録後に入れられる情報">
              {setupPreviewItems.map((item) => <span key={item}>{item}</span>)}
            </div>
            <Link className="nb-save empty-start-button" href="/start">1人目の手帳を作る</Link>
          </article>
        </section>
      ) : null}

      {activeCase ? (
        <div className="notebook-workspace" aria-label={`${activePersonName}の管理手帳`}>
          <section className="nb-section" aria-label="今日見るところ">
            <div className="nb-section-head">
              <strong>今日見るところ</strong>
              <span className="rule" aria-hidden="true" />
              <span className="aside">{boardDateLabel()}</span>
            </div>
            <div className="nb-card">
              {todayRows.map((alert) => (
                <a className={`nb-row is-${alert.tone}`} href={normalizeAlertHref(alert.href)} key={`${alert.title}-${alert.body}`}>
                  <span className="lead">{alert.tone === "urgent" ? "急ぎ" : alert.tone === "warning" ? "確認" : "安心"}</span>
                  <strong>{alert.title}</strong>
                  <small>{alert.body}</small>
                  <span className="chev" aria-hidden="true">›</span>
                </a>
              ))}
            </div>
          </section>

          <section className="nb-section" id="today-diary">
            <div className="nb-section-head">
              <strong>今日の記録</strong>
              <span className="rule" aria-hidden="true" />
              <span className="aside">{activeEntries.length}件</span>
            </div>
            <article className="nb-card today-record-card">
              <p className="record-help">当てはまるものを押すと、下の記録欄に入ります。最後に一言だけ足して保存してください。</p>
              <div className="record-chip-grid" aria-label="今日の記録に追加する項目">
                {healthNotes.map((item) => (
                  <button className={`record-chip is-${item.tone}`} key={item.title} type="button" onClick={() => appendDiaryNote(activeCase.id, item.note)}>
                    <span aria-hidden="true" />
                    <strong>{item.title}</strong>
                  </button>
                ))}
              </div>
              <label className="diary-label" htmlFor={`diary-${activeCase.id}`}>
                今日あったこと
              </label>
              <textarea
                id={`diary-${activeCase.id}`}
                placeholder="例: 今日は退院後はじめて訪問看護の日。薬の飲み忘れが少しあった。次回通院は長女に相談する。"
                value={activeForm.body}
                onChange={(event) => updateForm(activeCase.id, { body: event.target.value })}
              />
              <div className="record-tool-row">
                <div className="mood-segment" aria-label="今日の変化">
                  {([
                    ["stable", "通常"],
                    ["changed", "変化あり"],
                    ["urgent", "急ぎ"]
                  ] as const).map(([value, label]) => (
                    <button
                      className={activeForm.mood === value ? "is-active" : ""}
                      key={value}
                      type="button"
                      onClick={() => updateForm(activeCase.id, { mood: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="file-button">
                  写真・PDF
                  <input
                    accept="image/*,.pdf"
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
                    <span key={file.id}>
                      {file.previewUrl ? <img alt="" src={file.previewUrl} /> : null}
                      {file.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <button className="nb-save" type="button" onClick={() => saveDiary(activeCase.id)}>
                {notebookTitle(activePersonName)}に残す
              </button>
            </article>
          </section>

          {notebookInsight ? (
            <section className="nb-section" aria-label="気づきメモ">
              <article className="kizuki-card">
                <span className="tag">気づきメモ</span>
                <strong>{notebookInsight.patternTitle}</strong>
                <p>{notebookInsight.patternBody}</p>
                <div className="kizuki-question">
                  <span>次に家族で聞くこと</span>
                  <b>{notebookInsight.questions[0]}</b>
                </div>
                <small>記録から見る観点の整理です。医療・法律・税務の判断はしません。</small>
              </article>
            </section>
          ) : null}

          <section className="nb-section" id="diary-history">
            <div className="nb-section-head">
              <strong>過去の手帳</strong>
              <span className="rule" aria-hidden="true" />
              <span className="aside">{activeEntries.length > 0 ? `${activeEntries.length}件` : "未記録"}</span>
            </div>
            <article className="nb-card history-card">
              {recentEntries.length > 0 ? (
                recentEntries.map((entry) => (
                  <div className="nb-row history-row" key={entry.id}>
                    <time>{formatLongDate(entry.date)}</time>
                    <strong>{entry.body}</strong>
                    <span className={`mood-badge is-${entry.mood}`}>{moodLabel(entry.mood)}</span>
                  </div>
                ))
              ) : (
                <p className="diary-empty">まだ記録はありません。今日の一言から手帳が育ちます。</p>
              )}
              {activeEntries.length > 0 ? (
                <details className="history-drawer">
                  <summary>すべて見る ›</summary>
                  <div className="record-filter-tabs" aria-label="記録の絞り込み">
                    {([
                      ["all", "すべて"],
                      ["changed", "変化・急ぎ"],
                      ["attachments", "写真・PDF"]
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
                      {diaryGroups.map((group) => (
                        <section className="diary-month-group" key={group.month}>
                          <div className="diary-month-head">
                            <h3>{monthLabel(group.month)}</h3>
                            <p>{group.items.length}件 / 変化 {group.changedCount}件 / 写真・資料 {group.attachmentCount}件</p>
                          </div>
                          {group.items.map((entry) => (
                            <article className="diary-entry-card" key={entry.id}>
                              <div className="diary-entry-meta">
                                <time>{formatLongDate(entry.date)}</time>
                                <span className={`mood-badge is-${entry.mood}`}>{moodLabel(entry.mood)}</span>
                              </div>
                              <p>{entry.body}</p>
                              {entry.attachments.length > 0 ? (
                                <div className="entry-attachments">
                                  {entry.attachments.slice(0, 3).map((file) => (
                                    <span key={file.id}>
                                      {file.previewUrl ? <img alt="" src={file.previewUrl} /> : "PDF"}
                                      {file.name}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <div className="entry-advice">
                                <strong>この日のメモから</strong>
                                <ul>
                                  {diaryAdvice(entry).map((item) => <li key={item}>{item}</li>)}
                                </ul>
                              </div>
                            </article>
                          ))}
                        </section>
                      ))}
                    </div>
                  ) : (
                    <p className="diary-empty">この絞り込みに合う記録はありません。</p>
                  )}
                </details>
              ) : null}
            </article>
          </section>

          <section className="nb-section" id="person-profile">
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
              <div className="profile-row-grid compact-profile-rows">
                {summarizeProfile(activeCase, activeProfile ?? {}).map((row) => (
                  <div className={row.value === "未入力" ? "is-missing" : ""} key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
              <details className="profile-edit-drawer">
                <summary>プロフィールを編集する</summary>
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
                  </div>
                ) : null}
                <p className="profile-safe-note">暗証番号・パスワード・マイナンバーの画像は保管できません。</p>
                <div className="profile-save-row">
                  <button className="profile-save-button" type="button" onClick={() => saveProfile(activeCase.id)}>
                    保存する
                  </button>
                  {profileSavedCaseId === activeCase.id ? <span>保存しました</span> : <small>あとから何度でも更新できます。</small>}
                </div>
              </details>
            </article>
          </section>

          <section className="nb-section">
            <div className="nb-section-head">
              <strong>確認リスト</strong>
              <span className="rule" aria-hidden="true" />
              <Link className="aside-link" href={`/result/${activeCase.id}`}>整理結果を見る</Link>
            </div>
            <article className="nb-card task-list-card">
              {activeTasks.length > 0 ? (
                activeTasks.slice(0, 5).map((task) => {
                  const dateParts = taskDateParts(task.dueDate);
                  const dueDays = daysUntil(task.dueDate);
                  return (
                    <Link className="nb-row task-row" href={`/result/${activeCase.id}`} key={`${task.title}-${task.dueDate}`}>
                      <span className={`task-date ${dueDays !== null && dueDays <= 3 ? "is-near" : ""}`}>
                        <small>{dateParts.month}</small>
                        <b>{dateParts.day}</b>
                      </span>
                      <strong>{task.title}</strong>
                      <span className="assignee-chip">担当が決まっていません</span>
                      <span className="chev" aria-hidden="true">›</span>
                    </Link>
                  );
                })
              ) : (
                <p className="diary-empty">まだタスクはありません。</p>
              )}
            </article>
          </section>

          <section className="nb-section">
            <div className="nb-section-head">
              <strong>写真・資料</strong>
              <span className="rule" aria-hidden="true" />
              <span className="aside">{attachments.length}件</span>
            </div>
            <article className="nb-card media-book-card">
              {attachments.length > 0 ? (
                <div className="media-grid">
                  {attachments.slice(0, 6).map((file) => (
                    <div className="media-tile" key={`${file.id}-${file.entryDate}`}>
                      {file.previewUrl ? <img alt="" src={file.previewUrl} /> : <span>PDF</span>}
                      <small>{formatDate(file.entryDate)}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="diary-empty">日記に写真やPDFを追加すると、ここにまとまります。</p>
              )}
            </article>
          </section>

          <p className="nb-plus-note">
            2人目の手帳、家族との共有、AI相談は <Link href="/plans">Plus</Link> で。
          </p>
        </div>
      ) : null}
    </main>
  );
}
