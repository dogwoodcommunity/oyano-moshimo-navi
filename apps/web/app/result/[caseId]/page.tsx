"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { buildDiagnosisResult, type DiagnosisAnswers } from "@oyano/shared";
import { getLocalCase } from "@/lib/store";

export default function ResultPage() {
  const params = useParams<{ caseId: string }>();
  const searchParams = useSearchParams();
  const supportPackResult = searchParams.get("support_pack");
  const record = getLocalCase(params.caseId);
  const fallbackAnswers = {
    selectedStatus: record?.selectedStatus ?? "preparing",
    parentSituation: "",
    familyStructure: "",
    hasHome: "unknown",
    knowsAssets: "unknown",
    concerns: [],
    homeClearance: ""
  } satisfies DiagnosisAnswers;
  const result = record?.result ?? buildDiagnosisResult((record?.answers as DiagnosisAnswers | undefined) ?? fallbackAnswers);
  const appScheme = process.env.NEXT_PUBLIC_APP_SCHEME ?? "oyanomoshimo";
  const appUrl = record?.handoffToken
    ? `${appScheme}://handoff?${new URLSearchParams({ caseId: params.caseId, token: record.handoffToken }).toString()}`
    : "";

  return (
    <main className="container">
      <section className="result-summary">
        <p className="pill">{result.diagnosisType}</p>
        <h1 className="page-title">整理結果</h1>
        <p className="lead">{result.summary}</p>
        <div className="meta-row">
          <span className="meta-chip">case {params.caseId.slice(0, 8)}</span>
          <span className="meta-chip">保存すると家族で見られます</span>
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
          <span className="hint">この画面で確認できます。あとで見返す場合はアプリに保存します。</span>
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
        <h2>この結果を残して、家族で見るならアプリへ。</h2>
        <p>
          最初はアプリを入れなくても大丈夫です。まずWebで整理し、あとで見返したい時、家族と共有したい時、期限通知や写真管理が必要な時だけアプリに保存します。
        </p>
        <div className="handoff-choice-grid" aria-label="Webとアプリの役割">
          <div>
            <strong>Webでできること</strong>
            <span>状況を選ぶ、5分で整理する、結果を見る</span>
          </div>
          <div>
            <strong>アプリで続けること</strong>
            <span>家族ボード、期限通知、写真、タイムライン</span>
          </div>
        </div>
        <div className="actions">
          {appUrl ? (
            <a className="button" href={appUrl}>アプリに保存する</a>
          ) : (
            <Link className="button" href="/start">もう一度整理して保存する</Link>
          )}
          <Link className="secondary" href={`/result/${params.caseId}/share`}>家族に共有する</Link>
        </div>
        <p className="hint">アプリを使わない場合も、この画面で結果を確認できます。</p>
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
          <Link className="button" href={`/support-pack?caseId=${params.caseId}`}>内容を確認して申し込む</Link>
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
