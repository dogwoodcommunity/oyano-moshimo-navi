"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { statusLabel, targetLabel } from "@oyano/shared";
import {
  addDiaryEntry,
  diaryAdvice,
  listDiaryEntries,
  listLocalCases,
  type CaseRecord,
  type DiaryAttachment,
  type DiaryEntry
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
  "体調は安定している",
  "薬・服薬で気になることがある",
  "食事や水分量が気になる",
  "歩行・転倒が心配",
  "物忘れ・発言の変化があった",
  "病院・介護先から連絡があった"
];

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
  return targetLabel({
    targetRelationship: caseRecord.answers.targetRelationship,
    targetName: caseRecord.answers.targetName,
    additionalTargets: []
  });
}

function summarizeProfile(caseRecord: CaseRecord) {
  const answers = caseRecord.answers;
  return [
    { label: "いまの状況", value: statusLabel(caseRecord.selectedStatus) },
    { label: "家族構成", value: answers.familyStructure || "未入力" },
    { label: "実家・住まい", value: answers.hasHome === "yes" ? "確認が必要" : answers.hasHome === "no" ? "なし" : "不明" },
    { label: "財産・書類", value: answers.knowsAssets === "mostly" ? "だいたい把握" : answers.knowsAssets === "some" ? "一部だけ把握" : "不明" }
  ];
}

export default function FamilyBoardPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<Record<string, DiaryEntry[]>>({});
  const [forms, setForms] = useState<Record<string, DiaryFormState>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const localCases = listLocalCases();
    setCases(localCases);
    setActiveCaseId((current) => current ?? localCases[0]?.id ?? null);
    setDiaryEntries(Object.fromEntries(localCases.map((item) => [item.id, listDiaryEntries(item.id)])));
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
  const attachments = activeEntries.flatMap((entry) =>
    entry.attachments.map((file) => ({ ...file, entryDate: entry.date }))
  );

  const stats = activeCase ? [
    { value: activeTasks.length, label: "未完了タスク", detail: nextTask ? `次は${formatDate(nextTask.dueDate)}` : "状況登録後に表示" },
    { value: activeEntries.length, label: "手帳の記録", detail: "日々の変化を保存" },
    { value: attachments.length, label: "写真・資料", detail: "日記に紐づけ" }
  ] : [
    { value: 0, label: "登録中の対象者", detail: "まず1人目から" },
    { value: 0, label: "手帳の記録", detail: "写真も保存できます" },
    { value: 0, label: "未完了タスク", detail: "自動で作成します" }
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

  async function attachFiles(caseId: string, fileList: FileList | null) {
    const files = Array.from(fileList ?? []).slice(0, 4);
    const nextAttachments = await Promise.all(files.map(async (file) => ({
      id: crypto.randomUUID(),
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
    <main className="container board-page family-notebook-page">
      <section className="notebook-hero">
        <div>
          <p className="pill">家族の管理手帳</p>
          <h1>{activeCase ? `${personName(activeCase)}のマイページ` : "1人目の家族手帳を作ります。"}</h1>
          <p>
            {activeCase
              ? "日々の変化、写真、資料、期限のある手続きをこの人ごとに残します。2人目以降は上の切り替えで別々に管理できます。"
              : "まずは1人だけ登録します。状況を選ぶと、この人専用の手帳と確認リストができます。"}
          </p>
        </div>
        <div className="notebook-hero-actions">
          {activeCase ? (
            <>
              <a className="button" href="#today-diary">今日の記録を書く</a>
              <Link className="secondary" href="/start">別の人を追加</Link>
            </>
          ) : (
            <Link className="button" href="/start">1人目を登録する</Link>
          )}
        </div>
      </section>

      {cases.length > 0 ? (
        <section className="person-switcher" aria-label="対象者を切り替える">
          {cases.map((caseRecord, index) => (
            <button
              className={caseRecord.id === activeCase?.id ? "is-active" : ""}
              key={caseRecord.id}
              type="button"
              onClick={() => setActiveCaseId(caseRecord.id)}
            >
              <span>{index + 1}人目</span>
              <strong>{personName(caseRecord)}</strong>
              <small>{statusLabel(caseRecord.selectedStatus)}</small>
            </button>
          ))}
          <Link className="person-add-card" href="/start">＋ 追加</Link>
        </section>
      ) : null}

      <section className="board-stats notebook-stats" aria-label="選択中の対象者の状況">
        {stats.map((item) => (
          <div key={item.label}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </div>
        ))}
      </section>

      {!loaded ? (
        <section className="panel board-empty">
          <h2>読み込み中です</h2>
        </section>
      ) : null}

      {loaded && !activeCase ? (
        <section className="panel board-empty empty-notebook-card">
          <h2>まだ対象者が登録されていません。</h2>
          <p>父母、義父母、祖父母、親戚など、まず1人だけ登録してください。登録後はこの画面がその人のマイページになります。</p>
          <Link className="button" href="/start">1人目を登録する</Link>
        </section>
      ) : null}

      {activeCase ? (
        <section className="mypage-grid" aria-label={`${personName(activeCase)}の管理ページ`}>
          <div className="mypage-main">
            <article className="profile-book-card">
              <div className="profile-book-head">
                <div className="profile-avatar" aria-hidden="true">
                  {personName(activeCase).slice(0, 1)}
                </div>
                <div>
                  <p className="pill">{progressLabel(activeCase)}</p>
                  <h2>{personName(activeCase)}</h2>
                  <p>{statusLabel(activeCase.selectedStatus)}</p>
                </div>
              </div>
              <div className="profile-row-grid">
                {summarizeProfile(activeCase).map((row) => (
                  <div key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
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
                <h2>当てはまるものを押すと、手帳に追記できます。</h2>
                <p>細かく書けない日でも、ボタンだけで変化の種を残せます。</p>
              </div>
              <div className="health-chip-grid">
                {healthNotes.map((note) => (
                  <button key={note} type="button" onClick={() => appendDiaryNote(activeCase.id, note)}>
                    <span aria-hidden="true">＋</span>
                    {note}
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

            <article className="ai-consult-card notebook-ai-card" aria-label="AI相談">
              <div>
                <p className="pill">Plus</p>
                <h3>この人の記録をもとにAI相談</h3>
                <p>毎回ゼロから説明せず、家族構成・日々の記録・期限を踏まえて相談できる有料機能として設計します。</p>
              </div>
              <Link className="secondary" href="/plans">Plusを見る</Link>
            </article>
          </aside>
        </section>
      ) : null}

      <section className="board-plus notebook-plus">
        <div>
          <p className="pill">Family Plus</p>
          <h2>2人目以降は、それぞれのマイページを分けて管理。</h2>
          <p>父母・義父母・親戚を切り替え、手帳、写真、確認リスト、AI相談を人ごとに残せる形にします。</p>
        </div>
        <Link className="button" href="/plans">プランを見る</Link>
      </section>
    </main>
  );
}
