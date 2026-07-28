"use client";

import { useEffect, useMemo, useState } from "react";

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
      setMessage("ホーム画面に追加できました。次からはアイコンから開けます。");
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
    setMessage(choice.outcome === "accepted" ? "追加を開始しました。" : "あとで追加できます。");
  }

  if (installed) {
    return (
      <div className="pwa-install-card installed">
        <span className="pwa-install-icon">完了</span>
        <div>
          <strong>ホーム画面から開けます</strong>
          <p>次からはブラウザを探さず、親のもしもナビのアイコンを押してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pwa-install-panel">
      <div className="pwa-install-main">
        <p className="eyebrow">PWA</p>
        <h1>ホーム画面に追加して、アプリのように使えます。</h1>
        <p className="lead">
          ストア公開前でも、スマホのホーム画面に置いてすぐ開けます。家族ボード、ガイド、チェックリストを必要な時に戻れる場所にします。
        </p>
        {promptEvent ? (
          <button className="button pwa-primary" type="button" onClick={install}>
            この端末に追加する
          </button>
        ) : null}
        {message ? <p className="pwa-message">{message}</p> : null}
      </div>

      <div className="pwa-steps" aria-label="ホーム画面への追加方法">
        <div className="pwa-step-card">
          <span>1</span>
          <strong>{isIos ? "共有ボタンを押す" : "メニューを開く"}</strong>
          <p>{isIos ? "Safari下部の共有アイコンを押します。" : "Chrome右上のメニュー、または表示された追加ボタンを押します。"}</p>
        </div>
        <div className="pwa-step-card">
          <span>2</span>
          <strong>ホーム画面に追加</strong>
          <p>「ホーム画面に追加」または「アプリをインストール」を選びます。</p>
        </div>
        <div className="pwa-step-card">
          <span>3</span>
          <strong>アイコンから開く</strong>
          <p>次からは親のもしもナビのアイコンを押すだけで開けます。</p>
        </div>
      </div>
    </div>
  );
}
