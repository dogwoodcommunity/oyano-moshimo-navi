"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { buildDiagnosisResult, targetLabel, type DiagnosisAnswers } from "@oyano/shared";
import { getLocalCase } from "@/lib/store";

export default function ResultPage() {
  const params = useParams<{ caseId: string }>();
  const searchParams = useSearchParams();
  const supportPackResult = searchParams.get("support_pack");
  const record = getLocalCase(params.caseId);
  const fallbackAnswers = {
    selectedStatus: record?.selectedStatus ?? "preparing",
    targetRelationship: "mother",
    targetName: "",
    additionalTargets: [],
    parentSituation: "",
    familyStructure: "",
    hasHome: "unknown",
    knowsAssets: "unknown",
    concerns: [],
    homeClearance: ""
  } satisfies DiagnosisAnswers;
  const answers = (record?.answers as DiagnosisAnswers | undefined) ?? fallbackAnswers;
  const result = record?.result ?? buildDiagnosisResult(answers);
  const target = targetLabel(answers);
  const appScheme = process.env.NEXT_PUBLIC_APP_SCHEME ?? "oyanomoshimo";
  const appUrl = record?.handoffToken
    ? `${appScheme}://handoff?${new URLSearchParams({ caseId: params.caseId, token: record.handoffToken }).toString()}`
    : "";
  const supportPackHref = record?.handoffToken
    ? `/support-pack?${new URLSearchParams({ caseId: params.caseId, checkoutToken: record.handoffToken }).toString()}`
    : `/support-pack?caseId=${params.caseId}`;

  return (
    <main className="container">
      <section className="result-summary">
        <p className="pill">{result.diagnosisType}</p>
        <h1 className="page-title">{target}の整理結果</h1>
        <p className="lead">{result.summary}</p>
        <div className="meta-row">
          <span className="meta-chip">対象者 {target}</span>
          <span className="meta-chip">case {params.caseId.slice(0, 8)}</span>
          <span className="meta-chip">家族ボードに保存済み</span>
          <span className="meta-chip">専門判断は断定しません</span>
        </div>
      </section>

      <section className="columns">
        <div className="panel elevated">
          <h2>まずやること3つ</h2>
          <ol className="list">
            {result.firstSteps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
        <div className="panel elevated">
          <h2>家族に確認すること</h2>
          <ul className="list">
            {result.familyQuestions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h2>期限のあるタスク</h2>
          <span className="hint">この内容は家族ボードからあとで見返せます。</span>
        </div>
        <div className="task-list">
          {result.tasks.map((task) => (
            <article className="task-card" key={`${task.title}-${task.dueDate}`}>
              <strong>{task.title}</strong>
              <div className="meta-row">
                <span className="meta-chip">期限 {task.dueDate}</span>
                <span className="meta-chip">優先度 {task.priority}</span>
                <span className="meta-chip">{task.category}</span>
              </div>
              <span>{task.description}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="columns" style={{ marginTop: 18 }}>
        <div className="panel">
          <h2>登録しておく情報</h2>
          <ul className="list">
            {result.registryItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="panel">
          <h2>必要な相談先カテゴリ</h2>
          <ul className="list">
            {result.providerCategories.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <Link className="secondary" href="/providers" style={{ marginTop: 14 }}>相談先カテゴリを見る</Link>
        </div>
      </section>

      <section className="panel handoff-band" style={{ marginTop: 18 }}>
        <p className="pill">次にすること</p>
        <h2>この整理結果を、1人目として管理します。</h2>
        <p>
          期限のあるタスク、担当未定、家族に聞くことをこのまま家族ボードで進めます。あとから状況が変わったら、同じ対象者として更新できます。
        </p>
        <p className="hint">
          父母・義父母など複数人を管理する場合は、家族ボードから1人ずつ追加します。人ごとに状態、期限、担当を分けて管理します。
        </p>
        <div className="handoff-choice-grid" aria-label="家族ボードで続けること">
          <div>
            <strong>今やること</strong>
            <span>期限が近いこと、担当未定、家族への確認</span>
          </div>
          <div>
            <strong>あとで更新すること</strong>
            <span>状況の変化、完了した作業、追加メモ</span>
          </div>
        </div>
        <div className="actions">
          <Link className="button" href="/home">家族ボードで進捗を見る</Link>
          <Link className="secondary" href={`/result/${params.caseId}/share`}>家族に共有する</Link>
        </div>
        {appUrl ? <p className="hint">ネイティブアプリ連携用リンクも内部的に作成済みです。</p> : null}
      </section>

      <section className="board-plus" style={{ marginTop: 18 }}>
        <div>
          <p className="pill">Family Plus</p>
          <h2>2人目以降、PDF、履歴保存が必要なら。</h2>
          <p>父母・義父母を分けて管理したい、家族会議用PDFを出したい、写真や履歴を残したい場合に有料プランを案内します。</p>
        </div>
        <Link className="button" href="/plans">有料プランを見る</Link>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>発動サポートパック</h2>
        {supportPackResult === "success" ? (
          <p className="notice success">申し込みを受け付けました。運営側で内容を確認します。</p>
        ) : null}
        {supportPackResult === "cancel" ? (
          <p className="notice">申し込みは完了していません。必要になった時に、もう一度この画面から進めます。</p>
        ) : null}
        <p>
          入力内容の人力レビュー、家族会議用レポート、専門家・業者候補整理をWebで申し込む商品です。
          判断を代行するものではなく、家族で次に確認する順番を整理します。
        </p>
        <div className="actions">
          <Link className="button" href={supportPackHref}>内容を確認して申し込む</Link>
        </div>
        <p className="hint">現在の状態: {record?.supportPackStatus ?? "none"}</p>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>安全ガード</h2>
        <ul className="list">
          {result.warnings.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </main>
  );
}
