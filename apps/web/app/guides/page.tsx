import type { Metadata } from "next";
import { guides } from "@/lib/guides";
import { GuideSearch } from "@/components/GuideSearch";

export const metadata: Metadata = {
  title: "親のもしも準備ガイド",
  description: "入院、退院後の在宅、介護、認知症、死亡直後、相続前整理、実家じまいの状況別ガイド。家族が最初に整理することを検索できます。"
};

export default function GuidesPage() {
  return (
    <main className="container">
      <section className="result-summary">
        <p className="pill">無料ガイド</p>
        <h1 className="page-title">困った言葉で、必要な記事だけ読む。</h1>
        <p className="lead">
          入院、退院後の在宅、介護、看取り、亡くなった直後、相続前、実家じまい。専門判断を断定せず、家族が最初に整理することへ絞っています。
        </p>
      </section>

      <GuideSearch guides={guides} />
    </main>
  );
}
