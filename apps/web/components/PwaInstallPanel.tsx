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
          <div className="title-lockup">
            <svg className="watch-bird-mark" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="28" cy="28" r="26.5" fill="#fff" stroke="#33424A" strokeWidth="3" />
              <clipPath id="entry-watch-bird-hat">
                <rect x="0" y="0" width="56" height="14" />
              </clipPath>
              <circle cx="28" cy="14" r="15" fill="#4A8FA6" clipPath="url(#entry-watch-bird-hat)" />
              <circle cx="17" cy="27" r="3" fill="#33424A" />
              <circle cx="39" cy="27" r="3" fill="#33424A" />
              <rect x="23.5" y="31" width="9" height="8" rx="2" fill="#E8A15D" />
              <rect x="23.5" y="33" width="9" height="6" rx="3" fill="#E8A15D" />
            </svg>
            <div>
              <strong>親のもしもナビ</strong>
              <small>MOSHIMO NAVI</small>
            </div>
          </div>
          <span>家 族 の た め の 備 え 手 帳</span>
        </div>
      </div>

      <section className="entry-intro-card" aria-label="親のもしもナビの始め方">
        <p className="entry-date">{todayLabel}のページ</p>
        <h1>親のことを、このアプリで整理します。</h1>
        <p>
          入院、退院後の在宅、介護、亡くなった後の手続きなど、今の状況に近いものを選ぶと確認リストを作ります。
        </p>
        <Link className="entry-main-button" href="/start">
          最初の登録を始める
          <span>親の状況を1つ選びます</span>
        </Link>
      </section>

      <section className="entry-how-card" aria-label="このあとできること">
        <h2>このあとできること</h2>
        <ol>
          <li>
            <strong>親の状況を選ぶ</strong>
            <span>当てはまるカードを1つタップします。</span>
          </li>
          <li>
            <strong>確認リストを見る</strong>
            <span>支払い、書類、家族で分けることを整理します。</span>
          </li>
          <li>
            <strong>家族ボードに保存</strong>
            <span>あとで家族と見返せる形にします。</span>
          </li>
        </ol>
      </section>

      <Link className="entry-board-link" href="/home">
        すでに登録済みの家族ボードを見る
      </Link>

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
