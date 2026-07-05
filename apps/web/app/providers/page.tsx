const categories = [
  ["家財整理・遺品整理", "許認可、保険、追加費用条件、見積明細を確認"],
  ["空き家管理", "巡回頻度、緊急対応、鍵管理、報告方法を確認"],
  ["不動産相談", "売却・賃貸・管理の選択肢を比較"],
  ["解体", "近隣対応、残置物、追加工事条件を確認"],
  ["司法書士", "登記や相続手続きの相談候補"],
  ["税理士", "相続税など税務相談の候補"],
  ["弁護士", "紛争性がある場合の相談候補"],
  ["行政書士", "書類整理や行政手続きの相談候補"]
];

export default function ProvidersPage() {
  return (
    <main className="container">
      <h1 className="page-title">相談先カテゴリ</h1>
      <p className="lead">候補提示に留め、法律・税務判断の断定や成約課金は扱いません。</p>
      <section className="grid status-grid">
        {categories.map(([title, body]) => (
          <article className="panel" key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
