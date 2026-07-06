"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { buildDiagnosisResult, type DiagnosisAnswers } from "@oyano/shared";
import { getLocalCase, requestSupportPack } from "@/lib/store";

export default function ResultPage() {
  const params = useParams<{ caseId: string }>();
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
  const token = record?.handoffToken ?? `handoff_${params.caseId}`;
  const appScheme = process.env.NEXT_PUBLIC_APP_SCHEME ?? "oyanomoshimo";
  const appUrl = `${appScheme}://handoff?${new URLSearchParams({ caseId: params.caseId, token }).toString()}`;

  return (
    <main className="container">
      <section className="result-summary">
        <p className="pill">{result.diagnosisType}</p>
        <h1 className="page-title">整理結果</h1>
        <p className="lead">{result.summary}</p>
        <div className="meta-row">
          <span className="meta-chip">case {params.caseId.slice(0, 8)}</span>
          <span className="meta-chip">アプリ引き継ぎ可</span>
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
          <span className="hint">Expoアプリへ引き継ぐと家族ボードで管理できます。</span>
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
        <h2>アプリ引き継ぎ</h2>
        <p className="hint">Expoアプリでは家族ボード、期限通知、写真管理、タイムライン、実家カルテを継続管理します。</p>
        <div className="actions">
          <a className="button" href={appUrl}>アプリへ引き継ぐ</a>
          <Link className="secondary" href={`/result/${params.caseId}/share`}>家族共有リンクを作る</Link>
        </div>
        <p className="hint">handoff token: {token}</p>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>発動サポートパック</h2>
        <p>
          入力内容の人力レビュー、家族会議用レポート、専門家・業者候補整理をWebで申し込む商品です。
          アプリ内では外部決済CTAを置かず、購入済みやレビュー中の状態表示に留めます。
        </p>
        <div className="actions">
          <button className="button" onClick={() => requestSupportPack(params.caseId)}>サポート依頼を作成</button>
          <Link className="secondary" href={`/support-pack?caseId=${params.caseId}`}>Stripe Checkout想定へ</Link>
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
