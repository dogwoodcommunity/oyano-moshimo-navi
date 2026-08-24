"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import styles from "../monitor.module.css";

const STOP_OPTIONS = [
  "最初の手帳登録",
  "プロフィール入力",
  "今日の記録と保存",
  "過去の記録・カレンダー",
  "確認リスト",
  "書類の所在メモ",
  "家族招待",
  "AI相談",
  "クラウド控え・メール確認",
  "迷わなかった"
];

const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;

export function MonitorReportForm() {
  const [stops, setStops] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  function toggleStop(value: string) {
    setStops((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (value === "迷わなかった") return [value];
      return [...current.filter((item) => item !== "迷わなかった"), value];
    });
  }

  function selectScreenshots(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const files = Array.from(event.target.files ?? []);
    if (files.length > 3) {
      setError("スクリーンショットは3枚だけ選んでください。");
      event.target.value = "";
      setScreenshots([]);
      return;
    }
    const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_SCREENSHOT_BYTES);
    if (invalid) {
      setError("スクリーンショットはJPEG・PNG・WebP、1枚4MB以下で選んでください。");
      event.target.value = "";
      setScreenshots([]);
      return;
    }
    setScreenshots(files);
  }

  async function uploadScreenshot(file: File) {
    const data = new FormData();
    data.append("file", file);
    const response = await fetch("/api/monitor-feedback/screenshot", { method: "POST", body: data });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.storagePath !== "string") {
      throw new Error(body.message ?? "スクリーンショットを保存できませんでした。");
    }
    return body.storagePath as string;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (screenshots.length !== 3) {
      setError("気になった画面のスクリーンショットを3枚添付してください。");
      return;
    }

    setSending(true);
    const form = new FormData(event.currentTarget);

    try {
      const screenshotPaths = await Promise.all(screenshots.map(uploadScreenshot));
      const payload = {
        monitorCode: String(form.get("monitorCode") ?? "").trim(),
        ageGroup: String(form.get("ageGroup") ?? ""),
        careRelation: String(form.get("careRelation") ?? ""),
        careSituation: String(form.get("careSituation") ?? ""),
        device: String(form.get("device") ?? ""),
        usagePeriod: String(form.get("usagePeriod") ?? ""),
        recordCount: String(form.get("recordCount") ?? ""),
        checklistTried: String(form.get("checklistTried") ?? ""),
        documentMemoTried: String(form.get("documentMemoTried") ?? ""),
        familyInviteTried: String(form.get("familyInviteTried") ?? ""),
        savedRecord: String(form.get("savedRecord") ?? ""),
        aiConsult: String(form.get("aiConsult") ?? ""),
        stoppedAt: stops,
        returnIntent: String(form.get("returnIntent") ?? ""),
        familyShare: String(form.get("familyShare") ?? ""),
        paymentIntent: String(form.get("paymentIntent") ?? ""),
        confusingPoint: String(form.get("confusingPoint") ?? "").trim(),
        usefulPoint: String(form.get("usefulPoint") ?? "").trim(),
        missingPoint: String(form.get("missingPoint") ?? "").trim(),
        screenshotPaths
      };

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
            <h1>7日間のご協力、ありがとうございました。</h1>
            <p>いただいた回答とスクリーンショットは、迷わず使える家族の手帳へ改善するためにだけ利用します。</p>
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
          <p className={styles.eyebrow}>7日間モニター 最終報告</p>
          <h1>使い続けて分かったことを教えてください。</h1>
          <p className={styles.lead}>約15問、15分ほどです。実名やご家族の病気・住所は書かず、スクショにも個人情報を写さないでください。</p>
        </section>

        <form className={styles.formCard} onSubmit={submit}>
          <div className={styles.field}>
            <label htmlFor="monitorCode">モニター番号またはニックネーム<span className={styles.required}>必須</span></label>
            <input className={styles.input} id="monitorCode" name="monitorCode" maxLength={40} required placeholder="例：モニター03" />
          </div>

          <RadioField name="ageGroup" title="あなたの年代" options={["40代未満", "40代", "50代", "60代", "70代以上"]} />
          <RadioField name="careRelation" title="介護や備えの対象になっている方との関係" options={["実の親", "義理の親", "親族・その他", "回答しない"]} />
          <RadioField name="careSituation" title="現在の状況に近いもの" options={["要介護・要支援の家族がいる", "介護が始まりそう・備えている", "過去に介護を経験した", "回答しない"]} />
          <RadioField name="device" title="主に使った端末" options={["iPhone", "Android", "パソコン", "その他"]} />
          <RadioField name="usagePeriod" title="何日間、画面を開きましたか？" options={["7日間", "4〜6日", "2〜3日", "初日だけ"]} />
          <RadioField name="recordCount" title="「今日の記録」を何回保存しましたか？" options={["3回以上", "2回", "1回", "保存できなかった"]} />
          <RadioField name="checklistTried" title="確認リストを試しましたか？" options={["試して使えた", "試したが使えなかった", "見つけられなかった"]} />
          <RadioField name="documentMemoTried" title="書類の所在メモを試しましたか？" options={["試して使えた", "試したが使えなかった", "見つけられなかった"]} />
          <RadioField name="familyInviteTried" title="家族招待を試しましたか？" options={["試して使えた", "試したが完了できなかった", "見つけられなかった"]} />
          <RadioField name="savedRecord" title="過去に保存した記録を、あとから見つけられましたか？" options={["すぐ見つけられた", "少し迷った", "見つけられなかった", "記録を保存できなかった"]} />
          <RadioField name="aiConsult" title="AI相談を見つけて使えましたか？" options={["すぐ使えた", "少し迷ったが使えた", "見つけたが使えなかった", "見つけられなかった"]} />

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

          <RadioField name="returnIntent" title="今後も変化を記録するために使いたいですか？" options={["ぜひ使いたい", "たぶん使う", "分からない", "使わないと思う"]} />
          <RadioField name="familyShare" title="この手帳を家族とも共有したいですか？" options={["共有したい", "場合によっては共有したい", "共有しなくてよい"]} />
          <RadioField name="paymentIntent" title="2人目の手帳・無制限共有・継続AI相談が使える場合、近いものを選んでください。" options={["月980円なら利用したい", "年9,800円なら利用したい", "家族と相談して決めたい", "有料では利用しない"]} />

          <TextArea name="confusingPoint" title="一番分かりにくかったところ" placeholder="押すボタンが分からなかった、保存できたか不安だった、など" />
          <TextArea name="usefulPoint" title="一番役に立ちそうだと感じたところ" />
          <TextArea name="missingPoint" title="足りない機能、または使わないと思った理由" />

          <div className={styles.field}>
            <label htmlFor="screenshots">気になった画面のスクリーンショット3枚<span className={styles.required}>必須</span></label>
            <p className={styles.help}>実名・住所・病名・メールアドレスなどが写っていないことを確認してください。JPEG・PNG・WebP、1枚4MB以下です。</p>
            <input className={styles.fileInput} id="screenshots" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={selectScreenshots} />
            <p className={styles.fileStatus}>{screenshots.length === 3 ? "3枚選択できました" : `${screenshots.length}/3枚 選択中`}</p>
            {screenshots.length > 0 && <ul className={styles.fileList}>{screenshots.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul>}
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.primary} disabled={sending} type="submit">
            {sending ? "回答と画像を送信しています…" : "7日間の検証結果を送信する"}
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

function TextArea({ name, title, placeholder }: { name: string; title: string; placeholder?: string }) {
  return (
    <div className={styles.field}>
      <label htmlFor={name}>{title}</label>
      <textarea className={styles.textarea} id={name} name={name} maxLength={1000} placeholder={placeholder} />
    </div>
  );
}
