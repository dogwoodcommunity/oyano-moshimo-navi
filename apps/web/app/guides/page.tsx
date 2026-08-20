import Link from "next/link";
import type { Metadata } from "next";
import { guides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "親のもしも準備ガイド",
  description: "入院、介護、認知症、死亡直後、相続前整理、実家じまいの状況別ガイド。家族が最初に整理することをまとめています。"
};

export default function GuidesPage() {
  return (
    <main className="container">
      <section className="result-summary">
        <p className="pill">無料ガイド</p>
        <h1 className="page-title">親のもしも準備を、状況別に読む。</h1>
        <p className="lead">
          入院、介護、認知症、死亡直後、相続前、実家じまい。専門判断を断定せず、家族が最初に整理することへ絞っています。
        </p>
      </section>

      <section className="guide-grid">
        {guides.map((guide) => (
          <Link className="panel guide-card" href={`/guides/${guide.slug}`} key={guide.slug}>
            <span className="meta-chip">{guide.category}</span>
            <strong>{guide.title}</strong>
            <p>{guide.summary}</p>
            <span className="guide-link">読む</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
