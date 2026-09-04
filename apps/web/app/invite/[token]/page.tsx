import Link from "next/link";
import type { Metadata } from "next";
import { InviteAccept } from "@/components/InviteAccept";

type InvitePageProps = {
  params: {
    token: string;
  };
};

export const metadata: Metadata = {
  title: "共有された手帳への招待 | 親のもしもナビ",
  description: "親のもしもナビの共有手帳に、追加課金なしで参加するための招待ページです。"
};

export default function InvitePage({ params }: InvitePageProps) {
  const appScheme = process.env.NEXT_PUBLIC_APP_SCHEME ?? "oyanomoshimo";
  const appUrl = `${appScheme}://invite?token=${encodeURIComponent(params.token)}`;

  return (
    <main className="container family-page">
      <section className="family-hero">
        <p className="family-eyebrow">家族からの招待</p>
        <h1>共有された手帳に参加する。</h1>
        <p className="family-lead">
          親の状況、決めたこと、期限、写真を、家族で同じ画面から確認できます。
          新しく登録し直す必要はありません。招待された人の追加課金もありません。
        </p>
      </section>

      <InviteAccept token={params.token} />

      <section className="family-card">
        <h2>共有される内容と権限</h2>
        <ul className="family-list">
          <li>親の基本情報、日々の記録、確認リスト、写真が共有されます。</li>
          <li>「見るだけ」か「記録・確認リスト・写真を編集」かは、参加前に上の欄で確認できます。</li>
          <li>見るだけの人は、記録の追加・変更・削除やAI相談はできません。</li>
          <li>招待された人の追加課金はありません。</li>
        </ul>
        <p className="family-note">招待リンクは発行から7日間有効です。</p>
        <div className="family-hero-actions">
          <a className="secondary" href={appUrl}>アプリで開く</a>
          <Link className="secondary" href="/home">サイトを見る</Link>
        </div>
      </section>
    </main>
  );
}
