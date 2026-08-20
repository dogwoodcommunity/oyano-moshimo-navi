"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaInstallPanel() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [message, setMessage] = useState("");
  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      weekday: "short"
    }).format(new Date());
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setPromptEvent(null);
      setMessage("次からはホーム画面のアイコンから開けます。");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    setMessage(choice.outcome === "accepted" ? "追加を開始しました。" : "この画面からそのまま使えます。");
  }

  return (
    <div className="paper-bg entry-screen">
      <div className="title-card">
        <span className="tape" aria-hidden="true" />
        <div className="card">
          <strong>親のもしもナビ</strong>
          <span>家 族 の た め の 備 え 手 帳</span>
        </div>
      </div>

      <section className="notebook-card today-page-card" aria-label="今日の家族ボード">
        <header className="today-page-head">
          <strong>{todayLabel}のページ</strong>
          <span>家族ボード</span>
        </header>

        <div className="polaroid-row" aria-label="対象者">
          <figure className="polaroid">
            <span className="portrait-placeholder mother" aria-hidden="true" />
            <figcaption>母</figcaption>
          </figure>
          <figure className="polaroid">
            <span className="portrait-placeholder father" aria-hidden="true" />
            <figcaption>父</figcaption>
          </figure>
        </div>

        <ul className="notebook-task-list">
          <li>
            <span className="checkbox" aria-hidden="true" />
            <div>
              <strong>退院後の通院日を確認</strong>
              <p>
                <span className="chip chip-urgent">期限 7/31</span>
                <span className="chip chip-sand">担当が決まっていません</span>
              </p>
            </div>
          </li>
          <li>
            <span className="checkbox" aria-hidden="true" />
            <div>
              <strong>保険証と診断書の場所</strong>
              <small>写真で家族に共有ずみ</small>
            </div>
          </li>
        </ul>
      </section>

      <div className="entry-actions-notebook" aria-label="最初に進む場所">
        <Link className="stamp-primary" href="/home">
          今日の家族ボードをひらく <span aria-hidden="true">›</span>
        </Link>
        <Link className="stamp-secondary" href="/start">
          ＋ 親の状況を書きたす
        </Link>
      </div>

      <div className="pwa-note">
        {promptEvent ? (
          <>
            <span>よく使う場合は、あとでホーム画面に置けます。</span>
            <button type="button" onClick={install}>
              ホーム画面に置く
            </button>
          </>
        ) : (
          <p>よく使う場合は、あとでホーム画面に置けます。</p>
        )}
        {message ? <strong>{message}</strong> : null}
      </div>
    </div>
  );
}
