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

const emptyNotebookPromises = [
  {
    title: "1人目は無料で管理",
    body: "まず1人だけ、プロフィール・日記・期限リストを作れます。使えると感じてから広げます。"
  },
  {
    title: "日記がそのまま相談メモに",
    body: "体調、発言、病院連絡、写真を日付つきで残し、あとから家族や相談先に説明しやすくします。"
  },
  {
    title: "Plusで家族共有とAI相談",
    body: "2人目以降、招待制の家族共有、この人の記録を踏まえたAI相談を有料で広げます。"
  }
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

function daysUntil(dateString?: string) {
  if (!dateString) return null;
  const today = new Date(todayInputValue()).getTime();
  const due = new Date(`${dateString}T00:00:00`).getTime();
  if (Number.isNaN(due)) return null;
  return Math.ceil((due - today) / 86400000);
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
  const answers = caseRecord.answers;
  return [
    { label: "呼び名", value: profile.displayName || personName(caseRecord) },
    { label: "関係", value: profile.relationship || relationshipName(caseRecord) },
    { label: "いまの状況", value: profile.careStatus || statusLabel(caseRecord.selectedStatus) },
    { label: "生年月日", value: profile.birthDate || "未入力" },
    { label: "家族構成", value: answers.familyStructure || "未入力" },
    { label: "財産・書類", value: answers.knowsAssets === "mostly" ? "だいたい把握" : answers.knowsAssets === "some" ? "一部だけ把握" : "不明" }
  ];
}

export default function FamilyBoardPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<Record<string, DiaryEntry[]>>({});
  const [forms, setForms] = useState<Record<string, DiaryFormState>>({});
  const [profileForms, setProfileForms] = useState<Record<string, PersonProfile>>({});
  const [profileSavedCaseId, setProfileSavedCaseId] = useState<string | null>(null);
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

  const stats = activeCase ? [
    { value: dueText(nextTask), label: "次の確認日", detail: nextTask?.title ?? "確認リストを作成します" },
    { value: `${activeProfileCompletion.percent}%`, label: "プロフィール", detail: `${activeProfileCompletion.filled}/${activeProfileCompletion.total}項目 入力済み` },
    { value: `${activeEntries.length}件`, label: "手帳の記録", detail: attachments.length > 0 ? `写真・資料 ${attachments.length}件` : "日々の変化を保存" }
  ] : [
    { value: "1人目", label: "無料で作成", detail: "まず1人だけ登録" },
    { value: "日記", label: "毎日の記録", detail: "写真・PDFも一緒に保存" },
    { value: "Plus", label: "必要なら拡張", detail: "2人目・家族共有・AI相談" }
  ];

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
      {!activeCase ? (
        <section className="notebook-identity-card" aria-label="サービスの説明">
          <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
          <div>
            <strong>親のもしもナビ</strong>
            <span>MOSHIMO NAVI</span>
          </div>
          <p>家族で進める、親・親族ごとの管理手帳</p>
        </section>
      ) : null}

      <section className={`notebook-hero ${activeCase ? "is-person-hero" : ""}`}>
        <div className="notebook-hero-copy">
          <p className="pill">{activeCase ? "この人の管理手帳" : "まず1人目から"}</p>
          <h1>{activeCase ? `${personName(activeCase)}の管理手帳` : "親の状況を、1人ずつ管理します。"}</h1>
          <p>
            {activeCase
              ? "プロフィール、日々の記録、写真、資料、期限のある手続きをこの人ごとに残します。家族に説明するときも、相談するときも、この手帳が前提になります。"
              : "父母、義父母、親戚など、まず一番気になる人を1人だけ登録します。状況を選ぶと、その人専用の手帳と確認リストができます。"}
          </p>
          <div className="notebook-hero-actions">
            {activeCase ? (
              <>
                <a className="button" href="#today-diary">今日の記録を書く</a>
                <a className="secondary" href="#person-profile">プロフィールを整える</a>
              </>
            ) : (
              <Link className="button" href="/start">1人目の手帳を作る</Link>
            )}
          </div>
        </div>
        <div className="notebook-hero-preview" aria-hidden="true">
          <div className="preview-person-card">
            <span>管理する人</span>
            <strong>{activeCase ? personName(activeCase) : "1人目"}</strong>
            <small>{activeCase ? statusLabel(activeCase.selectedStatus) : "入院・在宅・介護など"}</small>
          </div>
          <div className="preview-note-row">
            <span>今日の記録</span>
            <strong>体調・発言・連絡を残す</strong>
          </div>
          <div className="preview-note-row">
            <span>次にやること</span>
            <strong>{nextTask?.title ?? "期限と担当を表示"}</strong>
          </div>
        </div>
      </section>

      {cases.length > 1 ? (
        <section className="person-switcher" aria-label="対象者を切り替える">
          {cases.map((caseRecord, index) => (
            <button
              className={caseRecord.id === activeCase?.id ? "is-active" : ""}
              key={caseRecord.id}
              type="button"
              onClick={() => setActiveCaseId(caseRecord.id)}
            >
              <span>{index === 0 ? "無料枠" : `${index + 1}人目`}</span>
              <strong>{personName(caseRecord)}</strong>
              <small>{statusLabel(caseRecord.selectedStatus)}</small>
            </button>
          ))}
        </section>
      ) : null}

      {!activeCase ? (
        <>
          <section className="board-stats notebook-stats" aria-label="このアプリで始められること">
            {stats.map((item) => (
              <div key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </div>
            ))}
          </section>

          <section className="notebook-promise-grid" aria-label="このアプリでできること">
            {emptyNotebookPromises.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </section>
        </>
      ) : null}

      {activeCase ? (
        <section className="today-overview-panel" aria-label={`${personName(activeCase)}の今日の管理`}>
          <div className="section-title-row">
            <div>
              <p className="pill">今日見るところ</p>
              <h2>{personName(activeCase)}の管理は、まずここだけ見れば大丈夫です。</h2>
            </div>
          </div>
          <div className="today-overview-grid">
            <a className="today-overview-card is-primary" href="#today-diary">
              <span>記録</span>
              <strong>今日あったことを書く</strong>
              <p>体調、発言、病院・介護先からの連絡、家族で決めたことを1分で残します。</p>
            </a>
            <Link className="today-overview-card" href={`/result/${activeCase.id}`}>
              <span>期限</span>
              <strong>{nextTask?.title ?? "確認リストを見る"}</strong>
              <p>{nextTask ? `${dueText(nextTask)}。忘れないように、この人のタスクとして残します。` : "状況を選ぶと、期限つきの確認リストができます。"}</p>
            </Link>
            <a className="today-overview-card" href="#person-profile">
              <span>本人情報</span>
              <strong>プロフィール {activeProfileCompletion.percent}%</strong>
              <p>
                {activeMissingProfileItems.length > 0
                  ? `次は「${activeMissingProfileItems.slice(0, 2).join("」「")}」を足すと、家族に説明しやすくなります。`
                  : "基本情報はかなり整っています。変化があれば更新してください。"}
              </p>
            </a>
          </div>
        </section>
      ) : null}

      {activeCase ? (
        <section className="board-stats notebook-stats active-notebook-stats" aria-label="選択中の対象者の状況">
          {stats.map((item) => (
            <div key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </div>
          ))}
        </section>
      ) : null}

      {!loaded ? (
        <section className="panel board-empty">
          <h2>読み込み中です</h2>
        </section>
      ) : null}

      {loaded && !activeCase ? (
        <section className="panel board-empty empty-notebook-card">
          <div>
            <p className="pill">登録後のイメージ</p>
            <h2>この画面が、その人専用のマイページになります。</h2>
            <p>父母、義父母、祖父母、親戚など、まず1人だけ。あとから2人目、3人目を別の手帳として追加できます。</p>
          </div>
          <div className="setup-preview-grid" aria-label="登録後に入れられる情報">
            {setupPreviewItems.map((item) => <span key={item}>{item}</span>)}
          </div>
          <Link className="button empty-start-button" href="/start">1人目の手帳を作る</Link>
        </section>
      ) : null}

      {activeCase ? (
        <section className="mypage-grid" aria-label={`${personName(activeCase)}の管理ページ`}>
          <div className="mypage-main">
            <article className="profile-book-card profile-editor-card" id="person-profile">
              <div className="profile-book-head">
                <div className="profile-avatar" aria-hidden="true">
                  {personName(activeCase).slice(0, 1)}
                </div>
                <div>
                  <p className="pill">{progressLabel(activeCase)}</p>
                  <h2>{personName(activeCase)}</h2>
                  <p>この人の基本情報を育てるほど、日記・確認リスト・相談が使いやすくなります。</p>
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
              <div className="profile-row-grid">
                {summarizeProfile(activeCase, activeProfile ?? {}).map((row) => (
                  <div key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
              {activeProfile ? (
                <div className="profile-form-grid" aria-label="対象者プロフィール編集">
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
              <div className="profile-save-row">
                <button className="button" type="button" onClick={() => saveProfile(activeCase.id)}>
                  プロフィールを更新する
                </button>
                {profileSavedCaseId === activeCase.id ? <span>保存しました</span> : <small>あとから何度でも更新できます。</small>}
              </div>
              {activeCase.answers.parentSituation ? (
                <div className="profile-note">
                  <span>最初に登録した状況</span>
                  <p>{activeCase.answers.parentSituation}</p>
                </div>
              ) : null}
            </article>

            <article className="health-check-card">
              <div>
                <p className="pill">今日のチェック</p>
                <h2>今日あったことを、1つ押してください。</h2>
                <p>押した内容は下の記録欄に入ります。あとから一言だけ足せば、家族に伝わる日記になります。</p>
              </div>
              <div className="health-chip-grid">
                {healthNotes.map((item) => (
                  <button className={`health-chip is-${item.tone}`} key={item.title} type="button" onClick={() => appendDiaryNote(activeCase.id, item.note)}>
                    <span aria-hidden="true" />
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.note}</small>
                    </div>
                    <em>記録に追加</em>
                  </button>
                ))}
              </div>
            </article>

            <article className="diary-panel notebook-diary-panel" id="today-diary">
              <div className="diary-head">
                <div>
                  <p className="pill">手帳</p>
                  <h3>今日の記録</h3>
                </div>
                <span>{activeEntries.length}件</span>
              </div>
              <label className="diary-label" htmlFor={`diary-${activeCase.id}`}>
                体調、発言、病院・介護の連絡、家族で決めたこと、写真やPDFを残せます。
              </label>
              <textarea
                id={`diary-${activeCase.id}`}
                placeholder="例: 今日は退院後はじめて訪問看護の日。薬の飲み忘れが少しあった。次回通院は長女に相談する。"
                value={activeForm.body}
                onChange={(event) => updateForm(activeCase.id, { body: event.target.value })}
              />
              <div className="diary-controls">
                <select
                  aria-label="今日の変化"
                  value={activeForm.mood}
                  onChange={(event) => updateForm(activeCase.id, { mood: event.target.value as DiaryEntry["mood"] })}
                >
                  <option value="stable">大きな変化なし</option>
                  <option value="changed">変化があった</option>
                  <option value="urgent">急ぎで確認したい</option>
                </select>
                <label className="file-button">
                  写真・PDFを追加
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
              <button className="button diary-save" type="button" onClick={() => saveDiary(activeCase.id)}>
                この人の手帳に残す
              </button>
            </article>

            <article className="diary-timeline-card">
              <div className="section-title-row">
                <div>
                  <p className="pill">これまで</p>
                  <h2>最近の記録</h2>
                </div>
              </div>
              {activeEntries.length > 0 ? (
                <div className="diary-timeline">
                  {activeEntries.slice(0, 4).map((entry) => (
                    <section className="diary-entry-card" key={entry.id}>
                      <time>{formatDate(entry.date)}</time>
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
                      <ul>
                        {diaryAdvice(entry).map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="diary-empty">まだ記録はありません。まずは「今日のチェック」を押すだけでも大丈夫です。</p>
              )}
            </article>
          </div>

          <aside className="mypage-side">
            <article className="task-calendar-card">
              <div className="mini-calendar">
                <span>{formatDate(nextTask?.dueDate)}</span>
                <strong>{dueText(nextTask)}</strong>
              </div>
              <div>
                <p className="pill">次にやること</p>
                <h2>{nextTask?.title ?? "確認リストを作成します"}</h2>
                <p>{nextTask?.description ?? "状況を選ぶと期限つきの確認リストが表示されます。"}</p>
              </div>
              <Link className="secondary" href={`/result/${activeCase.id}`}>確認リストを見る</Link>
            </article>

            <article className="task-stack-card">
              <div className="section-title-row">
                <div>
                  <p className="pill">タスク</p>
                  <h2>進める順番</h2>
                </div>
              </div>
              {activeTasks.length > 0 ? (
                <ol className="task-stack">
                  {activeTasks.slice(0, 5).map((task) => (
                    <li key={`${task.title}-${task.dueDate}`}>
                      <span>{formatDate(task.dueDate)}</span>
                      <strong>{task.title}</strong>
                      <small>優先度 {task.priority}</small>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="diary-empty">まだタスクはありません。</p>
              )}
            </article>

            <article className="media-book-card">
              <div className="section-title-row">
                <div>
                  <p className="pill">写真・資料</p>
                  <h2>この人の保管庫</h2>
                </div>
              </div>
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

            <article className="family-share-card">
              <div>
                <p className="pill">Family Plus</p>
                <h3>家族に共有して、同じ手帳を見る</h3>
                <p>
                  共有リンクだけで誰でも見られる形にはしません。家族共有はPlusで招待制にし、ログインした家族だけがこの人のプロフィール、日記、写真、期限を確認できます。
                </p>
              </div>
              <div className="share-rule-grid">
                <span>招待制</span>
                <span>URLだけでは不可</span>
                <span>Plus</span>
              </div>
              <Link className="secondary" href="/plans">家族共有を設定する</Link>
            </article>

            <article className="ai-consult-card notebook-ai-card" aria-label="AI相談">
              <div>
                <p className="pill">Plus</p>
                <h3>この人の記録をもとにAI相談</h3>
                <p>
                  毎回ゼロから説明せず、プロフィール・日記・写真メモ・期限を踏まえて「次に何を確認するか」を相談できる有料機能です。
                </p>
              </div>
              <Link className="secondary" href="/plans">Plusを見る</Link>
            </article>

            <article className="person-add-card side-add-person-card">
              <span>必要になったら</span>
              <strong>2人目・3人目を別の手帳で管理</strong>
              <small>Plusで父母、義父母、親戚を分けて登録できます。</small>
              <Link className="secondary" href="/plans">追加方法を見る</Link>
            </article>
          </aside>
        </section>
      ) : null}

      {!activeCase ? (
        <section className="board-plus notebook-plus">
          <div>
            <p className="pill">Family Plus</p>
            <h2>無料は1人目の手帳から。必要になったらPlusで広げる。</h2>
            <p>2人目以降の登録、家族への招待共有、この人の記録を踏まえたAI相談、PDF出力をPlusで使える設計にします。</p>
          </div>
          <Link className="button" href="/plans">プランを見る</Link>
        </section>
      ) : null}
    </main>
  );
}
