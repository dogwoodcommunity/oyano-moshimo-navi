import { getLegalDisclosure, legalContactHref } from "@/lib/commercialReadiness";

export default function TokushohoPage() {
  const disclosure = getLegalDisclosure();
  const contactHref = disclosure ? legalContactHref(disclosure.contact) : null;

  return (
    <main className="container legal-page">
      <section className="legal-hero">
        <p className="pill">Legal</p>
        <h1 className="page-title">特定商取引法に基づく表記</h1>
        <p className="lead">
          {disclosure
            ? "有料サービスの販売条件、提供時期、キャンセル条件、事業者情報を表示します。"
            : "現在、有料サービスの販売受付は開始していません。無料の手帳機能はこれまで通り利用できます。"}
        </p>
      </section>
      {disclosure ? (
        <section className="panel legal-panel">
          <table className="legal-disclosure-table">
            <tbody>
              <tr><th>販売事業者</th><td>{disclosure.businessName}</td></tr>
              <tr><th>運営責任者</th><td>{disclosure.responsiblePerson}</td></tr>
              <tr><th>所在地</th><td>{disclosure.address}</td></tr>
              <tr><th>電話番号</th><td>{disclosure.phone}（受付時間: {disclosure.phoneHours}）</td></tr>
              <tr><th>問い合わせ先</th><td>{contactHref ? <a href={contactHref}>{disclosure.contact}</a> : disclosure.contact}</td></tr>
              <tr><th>問い合わせ受付・返信目安</th><td>{disclosure.contactResponseTarget}</td></tr>
              <tr><th>販売価格</th><td>{disclosure.priceDescription}</td></tr>
              <tr><th>商品代金以外の必要料金</th><td>インターネット接続料金・通信料はお客様のご負担です。追加料金がある場合は、申込確定前に表示します。</td></tr>
              <tr><th>支払方法</th><td>クレジットカード等、決済画面に表示される方法</td></tr>
              <tr><th>支払時期</th><td>申込時に決済されます。継続課金の場合は、申込画面に表示する周期で自動更新されます。</td></tr>
              <tr><th>提供時期</th><td>{disclosure.serviceDelivery}</td></tr>
              <tr><th>キャンセル・解約・返金</th><td>{disclosure.cancellationPolicy}</td></tr>
              <tr><th>申込期間・販売数量</th><td>制限がある場合は、各申込画面に表示します。</td></tr>
              <tr><th>動作環境</th><td>最新版のSafari、Chrome、Edge、Brave。端末・OS・ブラウザの設定により一部機能を利用できない場合があります。</td></tr>
              <tr><th>注意事項</th><td>本サービスは家族の状況整理を支援するものであり、法律、税務、医療、介護認定等の専門判断を断定するものではありません。</td></tr>
            </tbody>
          </table>
        </section>
      ) : (
        <section className="panel legal-panel">
          <h2>有料サービスは受付準備中です</h2>
          <p>
            販売事業者、運営責任者、所在地、電話番号、問い合わせ先、価格、提供時期、キャンセル・返金条件を正式に確定し、
            このページへ表示するまでは、決済画面を開かない仕組みにしています。
          </p>
        </section>
      )}
    </main>
  );
}
