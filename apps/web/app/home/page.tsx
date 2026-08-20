"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { statusLabel, targetLabel } from "@oyano/shared";
import { listLocalCases, type CaseRecord } from "@/lib/store";

function progressLabel(caseRecord: CaseRecord) {
  if (caseRecord.status === "result_ready" || caseRecord.status === "converted") return "整理済み";
  if (caseRecord.status === "submitted") return "確認中";
  return "入力途中";
}

function unresolvedTaskCount(caseRecord: CaseRecord) {
  return caseRecord.result?.tasks.length ?? 0;
}

export default function FamilyBoardPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCases(listLocalCases());
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
