"use client";

import { useSearchParams } from "next/navigation";
import { requestSupportPack } from "@/lib/store";

export function SupportPackClient() {
  const params = useSearchParams();
  const caseId = params.get("caseId");

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <h2>Stripe Checkout開始</h2>
      <p className="hint">MVPではCheckoutセッション作成APIの接続点として扱います。</p>
      <button className="button" disabled={!caseId} onClick={() => caseId && requestSupportPack(caseId)}>
        {caseId ? "Checkout準備レコードを作成" : "結果画面からcase付きで開始"}
      </button>
    </section>
  );
}
