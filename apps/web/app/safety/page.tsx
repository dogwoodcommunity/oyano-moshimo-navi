import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "安全方針",
  description: "親のもしもナビが保存しない情報、断定しない判断、家族で安全に使うための考え方をまとめています。"
};

const safetyPrinciples = [
  {
    title: "危ない情報を預からない",
    body: "銀行暗証番号、パスワード、マイナンバー画像、通帳の全ページ画像など、漏れると取り返しにくい情報は保存対象にしません。"
  },
  {
    title: "専門判断を断定しない",
    body: "法律、税務、登記、医療、介護認定の結論は断定せず、確認すべき論点と相談先カテゴリを整理します。"
  },
  {
    title: "家族で共有できる形にする",
    body: "一人が抱えるメモではなく、期限、担当、写真、相談前の確認事項として共有しやすい単位へ分けます。"
  },
  {
    title: "生成AIへ送るものを、先に見せる",
    body: "長期相談で外部の生成AIへ送るのは、続柄、状態、年代、病院や薬のメモ、長期要約、最近と関連する過去の記録、相談内容です。プロフィールの氏名欄、生年月日そのもの、連絡先、書類や鍵の保管場所は送りません。ただし自由記述の氏名は確実に自動判定できないため、本人を特定できる情報は入力しないでください。口座番号のような数字は送信前に伏せます。"
  },
  {
    title: "事実とAIの提案を分ける",
    body: "手帳の記録を根拠にした要約と、AIが返した提案は別に保存します。利用者はAIが覚えている内容と根拠を確認し、補足・除外・削除ができます。"
  },
  {
    title: "必要になってから機能を増やす",
    body: "最初は1人分の管理手帳を作り、記録や期限を整えます。家族共有は無料枠で価値を確認し、複数人管理や長期相談は必要になった時に追加します。"
  }
];

export default function SafetyPage() {
  return (
    <main className="container">
      <section className="result-summary safety-hero">
        <p className="pill">安全方針</p>
        <h1 className="page-title">親の大事な情報を扱うから、保存しないものを先に決める。</h1>
        <p className="lead">
          親のもしもナビは、家族の不安を整理するためのサービスです。便利さだけを増やすのではなく、保存しない情報、断定しない判断、共有するときの守り方を明確にします。
        </p>
        <div className="actions">
          <Link className="button" href="/home">家族ボードへ戻る</Link>
          <Link className="secondary" href="/legal/disclaimer">免責事項を見る</Link>
        </div>
      </section>

      <section className="safety-grid">
        {safetyPrinciples.map((principle) => (
          <article className="panel safety-card" key={principle.title}>
            <span className="safety-mark" aria-hidden="true" />
            <h2>{principle.title}</h2>
            <p>{principle.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
