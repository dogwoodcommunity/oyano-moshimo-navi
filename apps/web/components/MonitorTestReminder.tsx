"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { markMonitorActivity, monitorPeriodStatus, monitorProgress, readMonitorActivity, readMonitorSession, type MonitorSession } from "@/lib/monitorSession";
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

  const activity = readMonitorActivity();
  const cloudBackupConfirmed = Boolean(activity.cloudBackupConfirmed);
  const recordedDayCount = new Set(
    (activity.dailyRecordSaved?.occurrences ?? []).map((value) => {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return "";
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }).filter(Boolean)
  ).size;
  const remainingRecordDays = Math.max(0, 3 - recordedDayCount);
  const recordTargetMet = remainingRecordDays === 0;

  function openCloudBackup(event: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById("cloud-backup");
    if (!(target instanceof HTMLDetailsElement)) return;

    event.preventDefault();
    target.open = true;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#cloud-backup`);
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

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
  return (
    <aside className={styles.notice} aria-live="polite">
      <div className={styles.copy}>
        <span className={styles.label}>7日間モニター {progress.dayNumber}日目</span>
        <h2>
          {recordTargetMet
            ? "3回以上の記録ができています。"
            : hasRecordToday
              ? `今日の記録を残しました。あと${remainingRecordDays}日分です。`
              : `あと${remainingRecordDays}日分、記録を残してください。`}
        </h2>
        <p>
          1日1回を目安に、7日間で3回以上記録します。毎日書けなくても大丈夫です。{monitorPeriodStatus(progress)}最終アンケートは{dueLabel} 0:00以降、ここに大きく表示します。
        </p>
        {!cloudBackupConfirmed && hasNotebook ? (
          <p className={styles.optionalNote}>
            クラウド保存を使うと、機種変更・端末故障・履歴削除のあとも、メール確認で手帳を戻せます。設定は任意です。使わない場合は、同じブラウザを使い、履歴を削除しないでください。
          </p>
        ) : null}
      </div>
      <div className={styles.actions}>
        <Link
          className={hasRecordToday || recordTargetMet ? styles.smallLink : styles.button}
          href={hasRecordToday || recordTargetMet ? "/monitor" : hasNotebook ? "/home#today-diary" : "/start"}
        >
          {hasRecordToday || recordTargetMet ? "テスト内容を確認" : hasNotebook ? "今日の記録を書く" : "手帳を作る"}
        </Link>
        {!cloudBackupConfirmed && hasNotebook ? (
          <a className={styles.optionalLink} href="#cloud-backup" onClick={openCloudBackup}>
            クラウド保存の説明を見る（任意）
          </a>
        ) : null}
      </div>
    </aside>
  );
}
