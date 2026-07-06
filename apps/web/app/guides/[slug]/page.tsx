import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuide, guides } from "@/lib/guides";

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export default function GuideDetailPage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  return (
    <main className="container">
      <article className="guide-detail">
        <section className="result-summary">
          <p className="pill">{guide.category}</p>
          <h1 className="page-title">{guide.title}</h1>
          <p className="lead">{guide.summary}</p>
        </section>

        <section className="panel guide-intro">
          <p className="eyebrow">当事者が不安になるところ</p>
          <p>{guide.concern}</p>
        </section>

        <section className="columns guide-columns">
          <div className="panel">
            <h2>まずやること</h2>
            <ol className="list">
              {guide.firstActions.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </div>
          <div className="panel">
            <h2>家族に聞くこと</h2>
            <ul className="list">
              {guide.familyQuestions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>

        <section className="columns guide-columns">
          <div className="panel">
            <h2>やらない方がいいこと</h2>
            <ul className="list">
              {guide.avoid.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="panel">
            <h2>相談先カテゴリ</h2>
            <div className="meta-row">
              {guide.providers.map((item) => <span className="meta-chip" key={item}>{item}</span>)}
            </div>
            <p className="hint">候補の種類を整理するだけで、法律・税務判断は断定しません。</p>
          </div>
        </section>

        <section className="panel handoff-band guide-cta">
          <div>
            <p className="eyebrow">Next</p>
            <h2>この状況で、家族用のやることリストを作る。</h2>
            <p>ログイン前に整理結果を表示します。保存・共有・通知が必要な時だけアプリへ引き継げます。</p>
          </div>
          <div className="actions">
            <Link className="button" href={`/diagnosis?status=${guide.ctaStatus}`}>状況整理チェックへ</Link>
            <Link className="secondary" href="/guides">他のガイドを見る</Link>
          </div>
        </section>
      </article>
    </main>
  );
}
