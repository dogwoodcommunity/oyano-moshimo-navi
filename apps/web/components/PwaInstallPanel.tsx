"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export function PwaInstallPanel() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");
  const isIos = useMemo(() => isIosDevice(), []);

  useEffect(() => {
    setInstalled(isStandalone());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstalled(true);
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

  if (installed) {
    return (
      <div className="pwa-install-card installed">
        <span className="pwa-install-icon">完了</span>
        <div>
          <strong>親のもしもナビを開けます</strong>
          <p>家族ボード、対象者登録、確認リストへ進めます。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pwa-install-panel">
      <div className="pwa-install-main">
        <p className="eyebrow">親のもしもナビ</p>
        <h1>家族で確認することを、ここにまとめます。</h1>
        <p className="lead">
          入院、退院後の在宅、介護、亡くなった後の手続き。親の状態に合わせて、やること・期限・担当を家族で見られるようにします。
        </p>
        <div className="app-entry-actions" aria-label="最初に進む場所">
          <Link className="button pwa-primary" href="/home">
            家族ボードを開く
            <span>対象者とタスクを見る</span>
          </Link>
          <Link className="secondary pwa-secondary-action" href="/start">
            状況から整理する
          </Link>
        </div>
        {message ? <p className="pwa-message">{message}</p> : null}
      </div>

      <div className="app-board-preview" aria-label="家族ボードの見本">
        <div className="preview-person">
          <span className="person-avatar">親</span>
          <div>
            <strong>母のこと</strong>
            <p>退院後、家で過ごす</p>
          </div>
        </div>
        <div className="preview-task urgent">
          <span>期限 7/31</span>
          <strong>退院後の通院日を確認</strong>
          <p>担当未定</p>
        </div>
        <div className="preview-task">
          <span>写真</span>
          <strong>保険証と診断書の場所</strong>
          <p>家族で共有</p>
        </div>
      </div>

      <div className="pwa-helper">
        <strong>よく使う場合だけ、ホーム画面に置けます。</strong>
        <p>
          {isIos ? "iPhoneは共有ボタンから「ホーム画面に追加」を選びます。" : "Androidはメニュー、または表示された追加ボタンからホーム画面に置けます。"}
        </p>
        {promptEvent ? (
          <button className="secondary compact" type="button" onClick={install}>
            ホーム画面に置く
          </button>
        ) : null}
        <div className="pwa-mini-steps" aria-label="追加方法">
          <span>1. {isIos ? "共有" : "メニュー"}</span>
          <span>2. ホーム画面に追加</span>
          <span>3. アイコンから開く</span>
        </div>
      </div>
    </div>
  );
}
