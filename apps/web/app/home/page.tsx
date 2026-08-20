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

function progressLabel(caseRecord: CaseRecord) {
  if (caseRecord.status === "result_ready" || caseRecord.status === "converted") return "整理済み";
  if (caseRecord.status === "submitted") return "確認中";
  return "入力途中";
}

function unresolvedTaskCount(caseRecord: CaseRecord) {
  return caseRecord.result?.tasks.length ?? 0;
}

type DiaryFormState = {
  body: string;
  mood: DiaryEntry["mood"];
  files: DiaryAttachment[];
};

const emptyDiaryForm: DiaryFormState = {
  body: "",
  mood: "stable",
  files: []
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
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

export default function FamilyBoardPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<Record<string, DiaryEntry[]>>({});
  const [forms, setForms] = useState<Record<string, DiaryFormState>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const localCases = listLocalCases();
    setCases(localCases);
    setDiaryEntries(Object.fromEntries(localCases.map((item) => [item.id, listDiaryEntries(item.id)])));
    setLoaded(true);
  }, []);

  const summary = useMemo(() => {
    const taskCount = cases.reduce((total, item) => total + unresolvedTaskCount(item), 0);
    return {
      people: cases.length,
      taskCount,
      unassigned: taskCount
    };
  }, [cases]);

  function updateForm(caseId: string, patch: Partial<DiaryFormState>) {
    setForms((current) => ({
      ...current,
      [caseId]: {
        ...(current[caseId] ?? emptyDiaryForm),
        ...patch
      }
    }));
  }

  async function attachFiles(caseId: string, fileList: FileList | null) {
    const files = Array.from(fileList ?? []).slice(0, 4);
    const attachments = await Promise.all(files.map(async (file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      previewUrl: await readFileAsDataUrl(file)
    } satisfies DiaryAttachment)));
    const current = forms[caseId] ?? emptyDiaryForm;
    updateForm(caseId, { files: [...current.files, ...attachments].slice(0, 6) });
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
    <main className="container board-page">
      <section className="board-hero">
        <p className="pill">家族ボード</p>
        <h1>親ごとに、今やることを管理します。</h1>
        <p>
          まずは1人目を登録します。整理結果はこの家族ボードに残り、あとから進捗や状況の変化を更新できます。
        </p>
        <div className="actions">
          <Link className="button" href="/start">1人目を登録する</Link>
          {cases.length > 0 ? <Link className="secondary" href="/start">別の親を追加する</Link> : null}
        </div>
      </section>

      <section className="board-stats" aria-label="家族ボードの状況">
        <div>
          <strong>{summary.people}</strong>
          <span>登録中の対象者</span>
        </div>
        <div>
          <strong>{summary.taskCount}</strong>
          <span>確認すること</span>
        </div>
        <div>
          <strong>{summary.unassigned}</strong>
          <span>担当を決めること</span>
        </div>
      </section>

      {!loaded ? (
        <section className="panel board-empty">
          <h2>読み込み中です</h2>
        </section>
      ) : null}

      {loaded && cases.length === 0 ? (
        <section className="panel board-empty">
          <h2>まだ対象者が登録されていません。</h2>
          <p>最初は1人だけで大丈夫です。親の状況を1つ選ぶと、確認リストを作ってこの画面に保存します。</p>
          <Link className="button" href="/start">1人目を登録する</Link>
        </section>
      ) : null}

      {cases.length > 0 ? (
        <section className="board-person-list" aria-label="登録済みの対象者">
          {cases.map((caseRecord, index) => {
            const answers = caseRecord.answers;
            const target = targetLabel({
              targetRelationship: answers.targetRelationship,
              targetName: answers.targetName,
              additionalTargets: []
            });
            const tasks = caseRecord.result?.tasks ?? [];
            const entries = diaryEntries[caseRecord.id] ?? [];
            const latestEntry = entries[0];
            const form = forms[caseRecord.id] ?? emptyDiaryForm;
            return (
              <article className="person-board-card" key={caseRecord.id}>
                <div className="person-card-head">
                  <span className="person-count">{index + 1}人目</span>
                  <span className="meta-chip">{progressLabel(caseRecord)}</span>
                </div>
                <h2>{target}</h2>
                <p>{statusLabel(caseRecord.selectedStatus)}</p>
                <div className="person-progress">
                  <span>確認リスト {tasks.length}件</span>
                  <span>担当未定 {tasks.length}件</span>
                </div>
                {tasks[0] ? (
                  <div className="next-task">
                    <small>次にやること</small>
                    <strong>{tasks[0].title}</strong>
                    <span>期限 {tasks[0].dueDate}</span>
                  </div>
                ) : (
                  <div className="next-task">
                    <small>次にやること</small>
                    <strong>状況を選んで確認リストを作ります</strong>
                  </div>
                )}
                <div className="actions">
                  <Link className="button" href={`/result/${caseRecord.id}`}>今やることを見る</Link>
                  <Link className="secondary" href="/start">変化を登録する</Link>
                </div>

                <section className="diary-panel" aria-label={`${target}の日々の記録`}>
                  <div className="diary-head">
                    <div>
                      <p className="pill">日々の記録</p>
                      <h3>{target}の手帳</h3>
                    </div>
                    <span>{entries.length}件</span>
                  </div>
                  <label className="diary-label" htmlFor={`diary-${caseRecord.id}`}>
                    今日あったこと、発言、体調、病院・介護の連絡、家族で決めたこと
                  </label>
                  <textarea
                    id={`diary-${caseRecord.id}`}
                    placeholder="例: 今日は退院後はじめて訪問看護の日。薬の飲み忘れが少しあった。長女に次回通院の付き添いを相談する。"
                    value={form.body}
                    onChange={(event) => updateForm(caseRecord.id, { body: event.target.value })}
                  />
                  <div className="diary-controls">
                    <select
                      aria-label="今日の変化"
                      value={form.mood}
                      onChange={(event) => updateForm(caseRecord.id, { mood: event.target.value as DiaryEntry["mood"] })}
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
                          void attachFiles(caseRecord.id, event.target.files);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {form.files.length > 0 ? (
                    <div className="attachment-strip">
                      {form.files.map((file) => (
                        <span key={file.id}>
                          {file.previewUrl ? <img alt="" src={file.previewUrl} /> : null}
                          {file.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <button className="button diary-save" type="button" onClick={() => saveDiary(caseRecord.id)}>
                    今日の記録を残す
                  </button>
                  {latestEntry ? (
                    <div className="latest-diary">
                      <small>最新の記録 {latestEntry.date}</small>
                      <p>{latestEntry.body}</p>
                      <ul>
                        {diaryAdvice(latestEntry).map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <p className="diary-empty">まだ記録はありません。写真だけでも残せます。</p>
                  )}
                </section>

                <section className="ai-consult-card" aria-label="AI相談">
                  <div>
                    <p className="pill">有料版</p>
                    <h3>AI相談</h3>
                    <p>登録情報、家族構成、日々の記録をもとに、毎回ゼロから説明しなくても相談できる機能として設計します。</p>
                  </div>
                  <Link className="secondary" href="/plans">Plusで使う</Link>
                </section>
              </article>
            );
          })}
        </section>
      ) : null}

      <section className="panel board-checkin">
        <p className="pill">月1確認</p>
        <h2>前回から変わったことはありますか？</h2>
        <p>入院、退院、介護サービス、家の片付け、書類の場所などが変わったら、対象者ごとに更新します。</p>
        <div className="actions">
          <Link className="secondary" href="/start">変化を登録する</Link>
          <Link className="secondary" href="/guides">確認の読み物を見る</Link>
        </div>
      </section>

      <section className="board-plus">
        <div>
          <p className="pill">Family Plus</p>
          <h2>2人目以降を本格管理するなら、有料プラン。</h2>
          <p>父母・義父母を分けて管理、家族会議用PDF、写真容量、履歴保存、カスタム通知に対応する想定です。</p>
        </div>
        <Link className="button" href="/plans">プランを見る</Link>
      </section>
    </main>
  );
}
