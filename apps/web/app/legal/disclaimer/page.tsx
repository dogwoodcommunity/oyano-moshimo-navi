export default function DisclaimerPage() {
  return (
    <main className="container">
      <h1 className="page-title">免責事項</h1>
      <section className="panel">
        <p>
          親のもしもナビで表示される診断結果、期限タスク、相談先カテゴリ、家じまいに関する整理内容は、一般的な情報整理を目的としたものです。
        </p>
        <ul className="list">
          <li>法律、税務、登記、相続、医療、介護の判断を断定しません。</li>
          <li>専門的判断が必要な場合は、弁護士、税理士、司法書士、行政書士、医師、介護専門職等へ相談してください。</li>
          <li>金融機関の暗証番号、パスワード、マイナンバー画像は保存しないでください。</li>
          <li>相談先候補や業者候補を提示する場合でも、契約条件、許認可、保険、追加費用、見積明細を必ず確認してください。</li>
        </ul>
      </section>
    </main>
  );
}
