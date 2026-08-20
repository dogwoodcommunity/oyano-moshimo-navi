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
  const supportPackHref = record?.handoffToken
    ? `/support-pack?${new URLSearchParams({ caseId: params.caseId, checkoutToken: record.handoffToken }).toString()}`
    : `/support-pack?caseId=${params.caseId}`;
  const resultValueItems = [
    {
      title: "日々の変化を残す",
      body: "体調、発言、病院や介護先からの連絡、家族で決めたことを日記として残せます。写真やPDFも一緒に置けます。"
    },
    {
      title: "期限と担当を見失わない",
      body: "今やること、あとで確認すること、担当未定のことをこの人ごとに分けて確認できます。"
    },
    {
      title: "家族に同じ前提を共有する",
      body: "本格共有は招待制で進めます。リンクだけで誰でも見られる形にせず、家族ごとに安全に共有します。"
    },
    {
      title: "相談が早くなる",
      body: "プロフィールと記録が残るので、AI相談や専門家相談で毎回ゼロから説明しなくて済みます。"
    }
  ];

  return (
    <main className="container">
      <section className="result-summary">
        <p className="pill">{result.diagnosisType}</p>
        <h1 className="page-title">{target}の整理結果</h1>
        <p className="lead">{result.summary}</p>
        <div className="meta-row">
          <span className="meta-chip">対象者 {target}</span>
          <span className="meta-chip">case {params.caseId.slice(0, 8)}</span>
          <span className="meta-chip">管理手帳に保存済み</span>
          <span className="meta-chip">専門判断は断定しません</span>
        </div>
      </section>

      <section className="panel result-next-value">
        <div>
          <p className="pill">このまま続ける理由</p>
          <h2>この結果を、{target}専用のマイページにできます。</h2>
          <p>
            親の状況は一度整理して終わりではありません。退院、介護、書類、家族の役割、実家の片付けは少しずつ変わります。
            だから、この結果をこの人の「管理手帳」として残し、これからの日々の記録と一緒に育てていきます。
          </p>
        </div>
        <div className="result-value-grid">
          {resultValueItems.map((item, index) => (
            <article key={item.title}>
              <span>{index + 1}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
        <div className="result-notebook-preview">
          <div>
            <strong>1人目のマイページでできること</strong>
            <ul>
              <li>フルネーム、生年月日、続柄、連絡窓口を登録</li>
              <li>日記、写真、PDF、病院・介護先メモを保存</li>
              <li>期限のある確認リストと担当未定を表示</li>
              <li>家族共有・AI相談・2人目以降はPlusで拡張</li>
            </ul>
          </div>
          <Link className="button" href="/home">1人目のマイページを作る</Link>
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
        <h2>{target}の管理手帳として続けます。</h2>
        <p>
          期限のあるタスク、担当未定、家族に聞くこと、日々の記録をこの人のマイページで進めます。
          あとから状況が変わったら、同じ対象者として更新できます。
        </p>
        <p className="hint">
          父母・義父母・親戚など複数人を管理する場合も、1人ずつ登録して、人ごとに状態、期限、担当、日記を分けます。
        </p>
        <div className="handoff-choice-grid" aria-label="家族ボードで続けること">
          <div>
            <strong>無料で始める</strong>
            <span>1人目のプロフィール、日記、写真、確認リスト</span>
          </div>
          <div>
            <strong>Plusで広げる</strong>
            <span>2人目以降、家族共有、AI相談、PDF出力</span>
          </div>
        </div>
        <div className="actions">
          <Link className="button" href="/home">この人のマイページへ進む</Link>
          <Link className="secondary" href="/plans">家族共有はPlusで設定</Link>
        </div>
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
