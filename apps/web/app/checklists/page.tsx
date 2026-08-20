import Link from "next/link";
import type { Metadata } from "next";
import { checklists } from "@/lib/checklists";

export const metadata: Metadata = {
  title: "親のもしも準備チェックリスト",
  description: "入院、介護、死亡直後、実家じまいで家族が確認することを、印刷や共有に使いやすいチェックリスト形式で整理しています。"
};

export default function ChecklistsPage() {
  return (
    <main className="container">
      <section className="result-summary checklist-hero">
        <p className="pill">無料チェックリスト</p>
        <h1 className="page-title">家族でそのまま使える、親のもしも準備リスト。</h1>
        <p className="lead">
          家族ボードで管理している人の状況に合わせて、確認漏れがないか見直すための一覧です。
        </p>
        <div className="actions">
          <Link className="button" href="/home">家族ボードへ戻る</Link>
          <Link className="secondary" href="/guides">準備ガイドを読む</Link>
        </div>
      </section>

      <section className="checklist-grid">
        {checklists.map((checklist) => (
          <article className="panel checklist-card" key={checklist.slug}>
            <div>
              <span className="meta-chip">{checklist.situation}</span>
              <h2>{checklist.title}</h2>
              <p>{checklist.summary}</p>
            </div>
            <ul className="checklist-items">
              {checklist.items.map((item) => (
                <li key={item}>
                  <span aria-hidden="true" />
                  <p>{item}</p>
                </li>
              ))}
            </ul>
            <div className="checklist-note">
              <strong>家族メモ</strong>
              <p>{checklist.familyNote}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
