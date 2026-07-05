export default function TokushohoPage() {
  return (
    <main className="container">
      <h1 className="page-title">特定商取引法に基づく表記</h1>
      <section className="panel">
        <table className="admin-table">
          <tbody>
            <tr><th>販売事業者</th><td>本番公開前に確定</td></tr>
            <tr><th>代表者</th><td>本番公開前に確定</td></tr>
            <tr><th>所在地</th><td>本番公開前に確定</td></tr>
            <tr><th>問い合わせ先</th><td>本番公開前に確定</td></tr>
            <tr><th>販売価格</th><td>各商品ページに表示</td></tr>
            <tr><th>支払方法</th><td>Stripe等の決済サービス</td></tr>
            <tr><th>提供時期</th><td>決済完了後、商品内容に応じて提供</td></tr>
            <tr><th>キャンセル・返金</th><td>商品性質に応じて本番公開前に確定</td></tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}
