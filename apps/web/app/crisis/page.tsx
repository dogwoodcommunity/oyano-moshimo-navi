import Link from "next/link";
import type { Metadata } from "next";
import { CRISIS_EMERGENCY_NOTE, CRISIS_SAFETY_NOTE, crisisScenarios } from "@oyano/shared";

export const metadata: Metadata = {
  title: "急なときに開く",
  description: "親が入院した夜、危篤と言われた時、亡くなった直後に、家族がいま何をすればよいかだけを順番に表示します。"
};

export default function CrisisIndexPage() {
  return (
    <main className="container crisis-page">
      <section className="crisis-hero">
        <p className="crisis-eyebrow">急なときに開く</p>
        <h1>いま起きていることを選んでください。</h1>
        <p className="crisis-lead">
          今から必要なことだけを、順番に出します。読み物ではありません。登録も入力もいりません。
        </p>
        <p className="crisis-emergency">{CRISIS_EMERGENCY_NOTE}</p>
      </section>

      <section className="crisis-choices" aria-label="いま起きていること">
        {crisisScenarios.map((scenario) => (
          <Link className="crisis-choice" href={`/crisis/${scenario.key}`} key={scenario.key}>
            <strong>{scenario.label}</strong>
            <small>{scenario.situation}</small>
            <span className="crisis-choice-chev" aria-hidden="true">›</span>
          </Link>
        ))}
      </section>

      <section className="crisis-note-card">
        <div className="crisis-note-mascot" aria-hidden="true">
          <img src="/brand/watch-bird-mark.svg" alt="" />
        </div>
        <div>
          <strong>どれにも当てはまらない時は</strong>
          <p>
            まだ急ぎではない、でも不安があるという時は、1人分の手帳を作って記録を残すところから始められます。
          </p>
          <div className="crisis-note-actions">
            <Link className="secondary" href="/home">家族ボードへ</Link>
            <Link className="secondary" href="/guides">読んで備える</Link>
          </div>
        </div>
      </section>

      <p className="crisis-safety">{CRISIS_SAFETY_NOTE}</p>
    </main>
  );
}
