import type { Metadata } from "next";
import Link from "next/link";
import { PwaInstallPanel } from "@/components/PwaInstallPanel";

export const metadata: Metadata = {
  title: "親のもしもナビを開く",
  description: "親のもしもナビの家族ボード、対象者登録、チェックリストへ進む最初の画面です。"
};

export default function InstallPage() {
  return (
    <main>
      <section className="plain-hero install-hero">
        <div className="plain-hero-inner install-hero-inner">
          <PwaInstallPanel />
        </div>
      </section>

      <section className="container portal-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">迷った時は</p>
            <h2>まずは家族で確認することを、少しずつ整理します。</h2>
          </div>
        </div>
        <div className="entry-grid">
          <div className="entry-card panel">
            <strong>親を1人ずつ管理</strong>
            <p>父母・義父母など、対象者ごとに状態とタスクを分けて見られます。</p>
          </div>
          <div className="entry-card panel">
            <strong>期限と担当を見える化</strong>
            <p>誰が何をするか、いつまでに動くかを家族ボードで確認します。</p>
          </div>
          <div className="entry-card panel">
            <strong>必要な時だけ戻る</strong>
            <p>毎日開かなくても、期限や変化がある時に戻れる場所にします。</p>
          </div>
        </div>
        <div className="actions">
          <Link className="button" href="/home">家族ボードへ</Link>
          <Link className="secondary" href="/safety">安心設計を見る</Link>
        </div>
      </section>
    </main>
  );
}
