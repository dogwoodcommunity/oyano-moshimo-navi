"use client";

import Link from "next/link";
import { useEffect } from "react";
import { grantMonitorProgressConsent, scheduleMonitorProgressSync } from "@/lib/monitorSession";
import styles from "./monitor.module.css";

export function MonitorStart() {
  useEffect(() => {
    scheduleMonitorProgressSync();
  }, []);

  function restart() {
    const approved = window.confirm(
      "このブラウザに残っている親のもしもナビのテストデータを消して、最初からやり直します。よろしいですか？"
    );
    if (approved) window.location.href = "/start?reset=1&monitor=1";
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>7日間モニターテストのお願い</p>
          <h1>暮らしの中で7日間、家族の手帳を試してください。</h1>
          <p className={styles.lead}>
            うまく使えたところだけでなく、迷った画面や「もう使わない」と感じた理由も大切な検証結果です。使えなかった報告でも報酬は同じです。ダミーの内容で、率直に試してください。
          </p>
          <div className={styles.summary} aria-label="モニターテストの概要">
            <div>
              <span>利用期間</span>
              <strong>7日間</strong>
            </div>
            <div>
              <span>最終回答</span>
              <strong>15〜20分</strong>
            </div>
            <div>
              <span>報酬</span>
              <strong>2,000円</strong>
              <small>最終回答の提出でお支払い</small>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h2>お願いすること</h2>
          <ol className={styles.steps}>
            <li>
              <span>1</span>
              <div className={styles.stepBody}>
                <strong>初日</strong>
                <p>手帳を1冊作る。クラウド保存は任意です。使うと、機種変更・端末故障・履歴削除のあとも手帳を戻せます</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div className={styles.stepBody}>
                <strong>7日間</strong>
                <p>1日1回を目安に、「今日の記録」を3回以上書く</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div className={styles.stepBody}>
                <strong>期間中</strong>
                <p>過去の記録を見返し、確認リスト・書類の所在メモ・AI相談を各1回試す。家族招待は画面を開いて手順を確認する（送信は任意）</p>
              </div>
            </li>
            <li>
              <span>4</span>
              <div className={styles.stepBody}>
                <strong>7日間の終了後</strong>
                <p>手帳の先頭に出る案内から回答し、気になった画面のスクショを1〜3枚添付する</p>
              </div>
            </li>
          </ol>
        </section>

        <p className={styles.notice}>
          7日間は開始時と同じスマホ・同じブラウザを使い、プライベートブラウズを使ったり履歴やサイトデータを削除したりしないでください。市区町村はテスト用の架空の内容で構いません。実名、病名、番地以下の詳細住所、電話番号、暗証番号、マイナンバーなどの個人情報は入力しないでください。呼び名は「お母さん」「テスト母」、記録は架空の内容で大丈夫です。添付するスクショにも個人情報を写さないでください。
          <span className={styles.trackingNote}>
            途中で困っている方を把握するため、開始日・最終利用・記録した日数・各機能を試したかだけを、名前を含まない端末識別番号とともに運営へ送ります。呼び名、地域、記録本文、写真、相談内容は途中経過として送りません。最終回答を送ると、途中経過と入力したクラウドワークス名が紐づきます。途中経過も回答と同じく、モニター終了後6か月を目安に削除します。
          </span>
        </p>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/start?monitor=1" onClick={() => grantMonitorProgressConsent()}>
            内容に同意して7日間のテストを始める
          </Link>
          <button className={styles.dangerLink} type="button" onClick={restart}>
            以前のテストデータを消して最初からやり直す
          </button>
        </div>
      </div>
    </main>
  );
}
