import Link from "next/link";
import type { Metadata } from "next";
import { InviteAccept } from "@/components/InviteAccept";

type InvitePageProps = {
  params: {
    token: string;
  };
};

export const metadata: Metadata = {
  title: "家族ボードへの招待 | 親のもしもナビ",
  description: "親のもしもナビの家族ボード招待を確認するページです。"
};

export default function InvitePage({ params }: InvitePageProps) {
  const appScheme = process.env.NEXT_PUBLIC_APP_SCHEME ?? "oyanomoshimo";
  const appUrl = `${appScheme}://invite?token=${encodeURIComponent(params.token)}`;

  return (
    <main className="container family-page">
      <section className="family-hero">
        <p className="family-eyebrow">家族からの招待</p>
        <h1>同じ手帳を、一緒に見られるようになります。</h1>
        <p className="family-lead">
          親の状況、決めたこと、期限、写真を、家族で同じ画面から確認できます。
          新しく登録し直す必要はありません。
        </p>
      </section>

      <InviteAccept token={params.token} />

      <section className="family-card">
        <h2>この招待でできること</h2>
        <ul className="family-list">
          <li>家族で同じ記録と期限を確認できます。</li>
          <li>担当が決まっていないことを、見えるようにできます。</li>
          <li>期限が近い手続きを、必要なときだけ思い出せます。</li>
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
