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
          <span>家 族 で 進 め る 親 の 管 理 帳</span>
        </div>
      </div>

      <section className="entry-intro-card" aria-label="親のもしもナビの始め方">
        <p className="entry-date">{todayLabel}の家族ボード</p>
        <h1>親の状況を、1人ずつ管理します。</h1>
        <p>
          入院、退院後の在宅、介護、亡くなった後の手続き、実家の片付け。親ごとに状況を登録して、今やることを家族で確認できます。
        </p>
        <Link className="entry-main-button" href="/start">
          1人目を登録する
          <span>親の状況を選んで、確認リストを作ります</span>
        </Link>
      </section>

      <section className="entry-how-card" aria-label="このあとできること">
        <h2>このアプリで続けてできること</h2>
        <ol>
          <li>
            <strong>1人目の状況を登録</strong>
            <span>まずは1人だけ。あとから2人目、3人目を追加できます。</span>
          </li>
          <li>
            <strong>今やることを表示</strong>
            <span>期限のある手続き、担当未定、家族に聞くことを分けます。</span>
          </li>
          <li>
            <strong>進捗を更新</strong>
            <span>完了、進行中、変化ありを見ながら次の確認へ進みます。</span>
          </li>
        </ol>
      </section>

      <Link className="entry-board-link" href="/home">
        登録済みの家族ボードを見る
      </Link>

      <section className="entry-plus-card" aria-label="有料プランの案内">
        <p className="pill">Family Plus</p>
        <h2>親が2人以上いる家族、履歴を残したい家族へ。</h2>
        <p>無料では1人目の整理と基本の確認から始められます。複数の親、家族会議用PDF、写真容量、履歴保存が必要になったらPlusを提案します。</p>
        <Link className="secondary" href="/plans">有料プランを見る</Link>
      </section>

      <div className="pwa-note">
        {promptEvent ? (
          <>
            <span>よく使う場合は、ホーム画面に置くとすぐ開けます。</span>
            <button type="button" onClick={install}>
              ホーム画面に置く
            </button>
          </>
        ) : (
          <p>よく使う場合は、ホーム画面に置くとすぐ開けます。</p>
        )}
        {message ? <strong>{message}</strong> : null}
      </div>
    </div>
  );
}
