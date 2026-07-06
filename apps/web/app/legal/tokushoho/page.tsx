export default function TokushohoPage() {
  return (
    <main className="container">
      <section className="legal-hero">
        <p className="pill">Legal</p>
        <h1 className="page-title">特定商取引法に基づく表記</h1>
        <p className="lead">発動サポートパックをWebで販売する前に、販売条件、提供時期、キャンセル条件、事業者情報を明確にします。</p>
      </section>
      <section className="panel legal-panel">
        <p className="hint">
          以下はリリース前の叩き台です。正式公開前に、BEECHの正式名称、代表者、住所、電話番号、問い合わせ窓口、返金条件を法務確認のうえ確定します。
        </p>
        <table className="admin-table">
          <tbody>
            <tr><th>販売事業者</th><td>BEECH [正式名称を要確定]</td></tr>
            <tr><th>運営責任者</th><td>[代表者または通信販売業務責任者を要確定]</td></tr>
            <tr><th>所在地</th><td>[事業者住所を要確定]</td></tr>
            <tr><th>電話番号</th><td>[電話番号を要確定。受付時間も併記]</td></tr>
            <tr><th>問い合わせ先</th><td>[メールアドレスまたは問い合わせフォームURLを要確定]</td></tr>
            <tr><th>販売価格</th><td>各商品ページに税込価格で表示します。テスト時の発動サポートパック価格案は9,800円(税込)です。</td></tr>
            <tr><th>商品代金以外の必要料金</th><td>インターネット接続料金、通信料、振込手数料等はお客様負担です。追加費用が発生する場合は申込前に表示します。</td></tr>
            <tr><th>支払方法</th><td>クレジットカード等、決済画面に表示される方法</td></tr>
            <tr><th>支払時期</th><td>申込時に決済されます。</td></tr>
            <tr><th>提供時期</th><td>決済確認後、原則として3営業日以内に入力内容の確認を開始し、商品ページに記載した範囲でレポートまたは整理結果を提供します。</td></tr>
            <tr><th>キャンセル・返金</th><td>役務提供開始前のキャンセル可否、提供開始後の返金可否、例外条件は正式公開前に確定します。デジタル/人的レビュー商品の性質上、提供開始後の返金制限を設ける場合があります。</td></tr>
            <tr><th>申込期間・販売数量</th><td>期間や数量に制限がある場合は、商品ページに表示します。</td></tr>
            <tr><th>動作環境</th><td>最新版の主要ブラウザ、iOS/Androidの対応バージョンはリリース前に確定します。</td></tr>
            <tr><th>注意事項</th><td>本サービスは家族の状況整理を支援するものであり、法律、税務、医療、介護認定等の専門判断を断定するものではありません。</td></tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}
