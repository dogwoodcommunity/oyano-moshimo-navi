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
          まずは登録なしで確認できます。印刷して家族会議に持っていく、LINEで共有する、後でアプリに引き継ぐ。そんな使い方を想定しています。
        </p>
        <div className="actions">
          <Link className="button" href="/start">自分の状況に合わせて整理する</Link>
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
            <Link className="secondary" href={`/diagnosis?status=${checklist.ctaStatus}`}>
              この状況でリスト化する
            </Link>
          </article>
        ))}
      </section>

      <section className="portal-band guide-bottom-band">
        <div className="container portal-band-inner">
          <div>
            <p className="eyebrow">Save and share</p>
            <h2>チェックした内容を、家族ボードと期限通知へつなげる。</h2>
            <p>
              無料チェックリストで全体像をつかんだ後、状況整理チェックに進むと、タスク・期限・相談先カテゴリを保存しやすい形に変換できます。
            </p>
          </div>
          <Link className="button" href="/start">状況整理チェックへ</Link>
        </div>
      </section>
    </main>
  );
}
