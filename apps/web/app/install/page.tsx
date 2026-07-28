import type { Metadata } from "next";
import Link from "next/link";
import { PwaInstallPanel } from "@/components/PwaInstallPanel";

export const metadata: Metadata = {
  title: "ホーム画面に追加",
  description: "親のもしもナビをPWAとしてホーム画面に追加し、アプリのように開くための案内です。"
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
            <p className="eyebrow">何ができるか</p>
            <h2>アプリ公開前の確認にも使えます。</h2>
          </div>
        </div>
        <div className="entry-grid">
          <div className="entry-card panel">
            <strong>すぐ開ける</strong>
            <p>ホーム画面のアイコンから、親のもしもナビへ直接戻れます。</p>
          </div>
          <div className="entry-card panel">
            <strong>通信が弱い時も案内を表示</strong>
            <p>ネットが切れても、最低限のオフライン案内を出します。</p>
          </div>
          <div className="entry-card panel">
            <strong>正式アプリへ移行しやすい</strong>
            <p>家族ボードの設計を確認しながら、後でExpoアプリへ寄せられます。</p>
          </div>
        </div>
        <div className="actions">
          <Link className="button" href="/home">トップへ戻る</Link>
          <Link className="secondary" href="/safety">安心設計を見る</Link>
        </div>
      </section>
    </main>
  );
}
