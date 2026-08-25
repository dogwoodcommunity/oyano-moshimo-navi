"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { markMonitorActivity, monitorProgress, readMonitorActivity, readMonitorSession, type MonitorSession } from "@/lib/monitorSession";
import styles from "./MonitorTestReminder.module.css";

export function MonitorTestReminder({ hasNotebook, hasRecordToday }: { hasNotebook: boolean; hasRecordToday: boolean }) {
  const [session, setSession] = useState<MonitorSession | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const currentSession = readMonitorSession();
    setSession(currentSession);
    if (currentSession) markMonitorActivity("appOpened");
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const progress = useMemo(() => (session ? monitorProgress(session, now) : null), [session, now]);
  if (!session || session.reportSubmittedAt || !progress) return null;

  const cloudBackupConfirmed = Boolean(readMonitorActivity().cloudBackupConfirmed);

  if (progress.isReportDue) {
    return (
      <aside className={`${styles.notice} ${styles.due}`} aria-live="polite">
        <div className={styles.copy}>
          <span className={styles.label}>7日間モニター 完了</span>
          <h2>お疲れさまでした。最後に回答をお願いします。</h2>
          <p>15〜20分です。気になった画面のスクリーンショットを1〜3枚ご用意ください。</p>
        </div>
        <Link className={styles.button} href="/monitor/report">
          最終アンケートに回答する
        </Link>
      </aside>
    );
  }

  const dueLabel = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(progress.reportDueAt);
  if (!cloudBackupConfirmed) {
    return (
      <aside className={styles.notice} aria-live="polite">
        <div className={styles.copy}>
          <span className={styles.label}>7日間モニター {progress.dayNumber}日目</span>
          <h2>初日の必須課題：クラウドの控えを作ってください。</h2>
          <p>メール確認まで完了すると、履歴削除や端末故障でも手帳を戻せます。テスト中は同じブラウザを使い、履歴を削除しないでください。</p>
        </div>
        <Link className={styles.button} href="/home?cloud=1#cloud-backup">
          クラウドの控えを作る
        </Link>
      </aside>
    );
  }

  return (
    <aside className={styles.notice} aria-live="polite">
      <div className={styles.copy}>
        <span className={styles.label}>7日間モニター {progress.dayNumber}日目</span>
        <h2>{hasRecordToday ? "今日の記録は完了です。" : "今日の記録を1回保存してください。"}</h2>
        <p>
          7日間、毎日1回ずつ記録します。あと{progress.daysRemaining}日です。最終アンケートは{dueLabel}以降、ここに大きく表示します。
        </p>
      </div>
      <Link
        className={hasRecordToday ? styles.smallLink : styles.button}
        href={hasRecordToday ? "/monitor" : hasNotebook ? "/home#today-diary" : "/start"}
      >
        {hasRecordToday ? "テスト内容を確認" : hasNotebook ? "今日の記録を書く" : "手帳を作る"}
      </Link>
    </aside>
  );
}
