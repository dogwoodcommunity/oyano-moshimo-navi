"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import styles from "../monitor.module.css";

const STOP_OPTIONS = [
  "最初の手帳登録",
  "プロフィール入力",
  "今日の記録と保存",
  "過去の記録・カレンダー",
  "AI相談",
  "クラウド控え・メール確認",
  "家族共有",
  "迷わなかった"
];

const COMPLETION_OPTIONS = [
  "手助けなしで完了できた",
  "少し迷ったが完了できた",
  "手助けが必要だった",
  "途中で完了できなかった"
];

export function MonitorReportForm() {
  const [stops, setStops] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  function toggleStop(value: string) {
    setStops((current) => {
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }
      if (value === "迷わなかった") {
        return [value];
      }
      return [...current.filter((item) => item !== "迷わなかった"), value];
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSending(true);
    const form = new FormData(event.currentTarget);

    const payload = {
      monitorCode: String(form.get("monitorCode") ?? "").trim(),
      ageGroup: String(form.get("ageGroup") ?? ""),
      device: String(form.get("device") ?? ""),
      completion: String(form.get("completion") ?? ""),
      stoppedAt: stops,
      savedRecord: String(form.get("savedRecord") ?? ""),
      aiConsult: String(form.get("aiConsult") ?? ""),
      returnIntent: String(form.get("returnIntent") ?? ""),
      familyShare: String(form.get("familyShare") ?? ""),
      paymentIntent: String(form.get("paymentIntent") ?? ""),
      confusingPoint: String(form.get("confusingPoint") ?? "").trim(),
      usefulPoint: String(form.get("usefulPoint") ?? "").trim()
    };

    try {
      const response = await fetch("/api/monitor-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "回答を送信できませんでした。");
      setCompleted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "回答を送信できませんでした。");
    } finally {
      setSending(false);
    }
  }

  if (completed) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}>
          <section className={styles.completeCard}>
            <p className={styles.eyebrow}>送信完了</p>
            <h1>ご協力ありがとうございました。</h1>
            <p>いただいた内容は、迷わず使える手帳へ改善するためにだけ利用します。</p>
            <div className={styles.actions} style={{ marginTop: 24 }}>
              <Link className={styles.secondary} href="/monitor">モニター案内へ戻る</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>モニターテスト結果</p>
          <h1>迷ったところを、そのまま教えてください。</h1>
          <p className={styles.lead}>実名やご家族の病気・住所は書かないでください。所要時間は約5分です。</p>
        </section>

        <form className={styles.formCard} onSubmit={submit}>
          <div className={styles.field}>
            <label htmlFor="monitorCode">モニター番号またはニックネーム<span className={styles.required}>必須</span></label>
            <input className={styles.input} id="monitorCode" name="monitorCode" maxLength={40} required placeholder="例：モニター03" />
          </div>

          <RadioField name="ageGroup" title="あなたの年代" options={["40代未満", "40代", "50代", "60代", "70代以上"]} />
          <RadioField name="device" title="使った端末" options={["iPhone", "Android", "パソコン", "その他"]} />
          <RadioField name="completion" title="手帳作成と記録保存まで進めましたか？" options={COMPLETION_OPTIONS} />

          <fieldset className={styles.field}>
            <legend>どこで止まった、または迷いましたか？<span className={styles.required}>複数選択可</span></legend>
            <div className={styles.options}>
              {STOP_OPTIONS.map((option) => (
                <label className={styles.option} key={option}>
                  <input type="checkbox" checked={stops.includes(option)} onChange={() => toggleStop(option)} />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>

          <RadioField name="savedRecord" title="保存した記録を、あとから見つけられましたか？" options={["すぐ見つけられた", "少し迷った", "見つけられなかった", "記録を保存できなかった"]} />
          <RadioField name="aiConsult" title="AI相談を見つけて使えましたか？" options={["すぐ使えた", "少し迷ったが使えた", "見つけたが使えなかった", "見つけられなかった"]} />
          <RadioField name="returnIntent" title="7日後にも、変化を記録するために戻りたいですか？" options={["ぜひ戻りたい", "たぶん戻る", "分からない", "戻らないと思う"]} />
          <RadioField name="familyShare" title="この手帳を家族とも共有したいですか？" options={["共有したい", "場合によっては共有したい", "共有しなくてよい"]} />
          <RadioField name="paymentIntent" title="2人目の手帳・家族共有・継続AI相談が使える場合、近いものを選んでください。" options={["月980円なら利用したい", "年9,800円なら利用したい", "家族と相談して決めたい", "有料では利用しない"]} />

          <div className={styles.field}>
            <label htmlFor="confusingPoint">一番分かりにくかったところ</label>
            <textarea className={styles.textarea} id="confusingPoint" name="confusingPoint" maxLength={1000} placeholder="押すボタンが分からなかった、保存できたか不安だった、など" />
          </div>
          <div className={styles.field}>
            <label htmlFor="usefulPoint">一番役に立ちそうなところ、または足りないもの</label>
            <textarea className={styles.textarea} id="usefulPoint" name="usefulPoint" maxLength={1000} />
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.primary} disabled={sending} type="submit">
            {sending ? "送信しています…" : "検証結果を送信する"}
          </button>
        </form>
      </div>
    </main>
  );
}

function RadioField({ name, title, options }: { name: string; title: string; options: string[] }) {
  return (
    <fieldset className={styles.field}>
      <legend>{title}<span className={styles.required}>必須</span></legend>
      <div className={styles.options}>
        {options.map((option) => (
          <label className={styles.option} key={option}>
            <input type="radio" name={name} value={option} required />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
