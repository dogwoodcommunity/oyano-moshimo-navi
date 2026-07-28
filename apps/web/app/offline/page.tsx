import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "オフライン",
  description: "通信が切れている時の案内です。"
};

export default function OfflinePage() {
  return (
    <main>
      <section className="plain-hero offline-hero">
        <div className="hero-copy">
          <p className="eyebrow">通信が切れています</p>
          <h1>オンラインに戻ったら、もう一度開いてください。</h1>
          <p className="lead">
            家族ボード、保存、本人確認メール、支払いなどは通信が必要です。電波のよい場所で再読み込みしてください。
          </p>
          <div className="actions">
            <Link className="button" href="/home">トップへ戻る</Link>
            <Link className="secondary" href="/checklists">チェックリストを見る</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
