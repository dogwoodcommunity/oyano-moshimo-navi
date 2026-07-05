"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { getLocalCase } from "@/lib/store";

export default function SharePage() {
  const params = useParams<{ caseId: string }>();
  const record = getLocalCase(params.caseId);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/result/${params.caseId}?share=family`;
  }, [params.caseId]);

  return (
    <main className="container">
      <h1 className="page-title">家族共有・アプリ招待</h1>
      <p className="lead">診断結果と、アプリ引き継ぎ用のcase情報を家族に共有します。</p>
      <section className="panel">
        <label className="label" htmlFor="share">共有リンク</label>
        <input className="input" id="share" readOnly value={shareUrl} />
        <div className="actions">
          <button className="button" onClick={() => navigator.clipboard.writeText(shareUrl)}>コピー</button>
          <a className="secondary" href={`mailto:?subject=親のもしもナビ診断結果&body=${encodeURIComponent(shareUrl)}`}>メールで共有</a>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>アプリ引き継ぎ情報</h2>
        <p className="hint">caseId: {params.caseId}</p>
        <p className="hint">handoffToken: {record?.handoffToken ?? "result画面で生成"}</p>
      </section>
    </main>
  );
}
