"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { getLocalCase } from "@/lib/store";

export default function SharePage() {
  const params = useParams<{ caseId: string }>();
  const record = getLocalCase(params.caseId);
  const appScheme = process.env.NEXT_PUBLIC_APP_SCHEME ?? "oyanomoshimo";
  const appUrl = record?.handoffToken
    ? `${appScheme}://handoff?${new URLSearchParams({ caseId: params.caseId, token: record.handoffToken }).toString()}`
    : "";
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/result/${params.caseId}?share=family`;
  }, [params.caseId]);

  return (
    <main className="container">
      <h1 className="page-title">家族に共有する</h1>
      <p className="lead">まずはWebの結果リンクを共有できます。家族で継続して管理したい時だけ、アプリに保存します。</p>
      <section className="panel">
        <label className="label" htmlFor="share">共有リンク</label>
        <input className="input" id="share" readOnly value={shareUrl} />
        <div className="actions">
          <button className="button" onClick={() => navigator.clipboard.writeText(shareUrl)}>コピー</button>
          <a className="secondary" href={`mailto:?subject=親のもしもナビ整理結果&body=${encodeURIComponent(shareUrl)}`}>メールで共有</a>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>アプリに保存する場合</h2>
        <p className="hint">期限通知、写真管理、家族ボードを使いたい時は、このリンクからアプリに保存します。</p>
        {appUrl ? (
          <>
            <label className="label" htmlFor="app-share">アプリ保存リンク</label>
            <input className="input" id="app-share" readOnly value={appUrl} />
            <div className="actions">
              <button className="secondary" onClick={() => navigator.clipboard.writeText(appUrl)}>アプリ保存リンクをコピー</button>
              <a className="secondary" href={appUrl}>アプリに保存する</a>
            </div>
          </>
        ) : (
          <p className="hint">このブラウザではアプリ保存リンクを確認できません。結果画面からもう一度開いてください。</p>
        )}
      </section>
    </main>
  );
}
