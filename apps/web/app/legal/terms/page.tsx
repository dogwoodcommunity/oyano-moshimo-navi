import { getPublicOperatorContact, getPublicOperatorDisclosure, legalContactHref } from "@/lib/commercialReadiness";

export default function TermsPage() {
  const operator = getPublicOperatorContact();
  const disclosure = getPublicOperatorDisclosure();
  const contactHref = operator ? legalContactHref(operator.contact) : null;
  return (
    <main className="container">
      <section className="legal-hero">
        <p className="pill">Legal</p>
        <h1 className="page-title">利用規約</h1>
        <p className="lead">親のもしもナビの利用条件と、専門判断を断定しない方針を定めます。</p>
      </section>
      <section className="panel legal-panel">
        {disclosure ? (
          <p className="hint">施行日: {disclosure.termsEffectiveDate}／運営: {disclosure.operatorName}</p>
        ) : operator ? (
          <p className="hint">正式公開に向けて準備中です。施行日は正式公開日に確定します。運営・問い合わせ先はこのページの下部をご確認ください。</p>
        ) : (
          <p className="hint">運営者、問い合わせ先、施行日は正式公開前に最終反映します。</p>
        )}
        <h2>サービスの位置づけ</h2>
        <p>
          親のもしもナビは、家族が親の状況変化に応じて情報やタスクを整理するための支援サービスです。
          法律、税務、登記、医療、介護その他の専門判断を断定するものではありません。
        </p>
        <h2>禁止事項</h2>
        <ul className="list">
          <li>銀行暗証番号、パスワード、マイナンバー画像などの保存</li>
          <li>本人または家族の同意なく機微な情報を登録する行為</li>
          <li>虚偽情報、不正アクセス、サービス運営を妨げる行為</li>
        </ul>
        <h2>親本人の情報を入力する場合</h2>
        <p>
          親本人の入院、認知症、危篤、死亡などの情報を登録する場合、利用者は、本人に説明できる状態であれば利用目的と家族内共有の範囲を説明してください。
          本人への説明が難しい状態では、生活支援、医療・介護・死後手続きの整理に必要な最小限の情報に限って入力してください。
        </p>
        <h2>発動サポートパック</h2>
        <p>
          発動サポートパックは人的レビューや家族会議用レポート等のWebで申し込む人的サポートです。
          アプリ内デジタル機能のアンロックを目的とするものではありません。
        </p>
        <h2>思い出の手帳PDF</h2>
        <p>
          思い出の手帳PDFは、利用者が手帳へ入力した記録と表示可能な写真を、読み返しやすい順に並べる無料機能です。
          死亡証明書、診療記録、遺言書その他の公的・法的書類ではありません。
          無料提供に含まれるのはPDFデータを保存・印刷するための画面であり、紙の本の印刷、製本、配送は含みません。
        </p>
        <h2>免責</h2>
        <p>
          提示されるタスクや相談先カテゴリは一般的な整理支援です。法的・税務的判断は必ず専門家へ確認してください。
        </p>
        <h2 id="contact">運営・問い合わせ</h2>
        {operator ? (
          <p>
            運営者: {operator.operatorName}<br />
            運営責任者: {operator.responsiblePerson}<br />
            問い合わせ先: {contactHref ? <a href={contactHref}>{operator.contact}</a> : operator.contact}<br />
            受付・返信目安: {operator.contactResponseTarget}
          </p>
        ) : (
          <p>正式な運営者と問い合わせ先は、正式公開前にこのページへ表示します。</p>
        )}
      </section>
    </main>
  );
}
