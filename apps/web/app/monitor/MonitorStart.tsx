"use client";

import Link from "next/link";
import styles from "./monitor.module.css";

export function MonitorStart() {
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
          <p className={styles.eyebrow}>モニターテストのお願い</p>
          <h1>初めて使うつもりで、手帳を1冊作ってください。</h1>
          <p className={styles.lead}>
            説明を読まずに迷った場所も、大切な検証結果です。分からない時は無理に進めず、最後の報告フォームにそのまま書いてください。
          </p>
          <span className={styles.time}>所要時間 10〜15分</span>
        </section>

        <section className={styles.card}>
          <h2>お願いすること</h2>
          <ol className={styles.steps}>
            <li><span>1</span>気になる人を1人登録して、手帳を作る</li>
            <li><span>2</span>「今日の記録」を1件書いて保存する</li>
            <li><span>3</span>保存した記録を見つけて、AI相談を開く</li>
            <li><span>4</span>最後に結果報告フォームへ回答する</li>
          </ol>
        </section>

        <p className={styles.notice}>
          実名、病名、住所、電話番号、暗証番号、マイナンバーは入力しないでください。呼び名は「お母さん」「テスト母」などで大丈夫です。写真も無理に添付する必要はありません。
        </p>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/start?monitor=1">
            テストを始める
          </Link>
          <Link className={styles.secondary} href="/monitor/report">
            結果を報告する
          </Link>
          <button className={styles.dangerLink} type="button" onClick={restart}>
            以前のテストデータを消して最初からやり直す
          </button>
        </div>
      </div>
    </main>
  );
}
