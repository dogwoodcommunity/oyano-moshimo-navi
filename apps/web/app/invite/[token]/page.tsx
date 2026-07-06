import Link from "next/link";
import type { Metadata } from "next";

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
    <main className="container">
      <section className="panel elevated">
        <p className="eyebrow">Family Invite</p>
        <h1 className="page-title">家族ボードに招待されています。</h1>
        <p className="lead">
          アプリをお持ちの場合は、そのまま家族ボードを開けます。
          まだ入れていない場合は、このページを残してアプリ準備後にもう一度開いてください。
        </p>
        <div className="meta-row">
          <a className="button primary-cta" href={appUrl}>
            アプリで開く
          </a>
          <Link className="secondary" href="/home">
            サイトを見る
          </Link>
        </div>
      </section>

      <section className="columns" style={{ marginTop: 18 }}>
        <article className="panel">
          <h2>この招待でできること</h2>
          <ul className="list">
            <li>家族で同じタスクと期限を確認できます。</li>
            <li>担当者が決まっていないことを見えるようにできます。</li>
            <li>期限が近い手続きは、必要なときだけ通知で思い出せます。</li>
          </ul>
          <p className="hint">招待リンクは発行から7日間有効です。</p>
        </article>
      </section>
    </main>
  );
}
