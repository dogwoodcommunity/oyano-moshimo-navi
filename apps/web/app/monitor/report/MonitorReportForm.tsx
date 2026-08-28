"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  markMonitorReportSubmitted,
  monitorPeriodStatus,
  monitorProgress,
  readMonitorSession
} from "@/lib/monitorSession";
import { collectMonitorUsageMetrics } from "@/lib/monitorMetrics";
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
  "クラウド保存・メール確認",
  "迷わなかった"
];

const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;

type ReportGate =
  | { status: "checking" }
  | { status: "not-started" }
  | { status: "active"; dayNumber: number; daysRemaining: number; reportDueAt: Date; periodStatus: string }
  | { status: "due" }
  | { status: "submitted" };

export function MonitorReportForm() {
  const [gate, setGate] = useState<ReportGate>({ status: "checking" });
  const [preview, setPreview] = useState(false);
  const [stops, setStops] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const previewRequested = new URLSearchParams(window.location.search).get("preview") === "1";
    if (previewRequested) {
      setPreview(true);
      setGate({ status: "due" });
      return;
    }

    const session = readMonitorSession();
    if (!session) {
      setGate({ status: "not-started" });
      return;
    }
    if (session.reportSubmittedAt) {
      setGate({ status: "submitted" });
      return;
    }
    const progress = monitorProgress(session);
    setGate(progress.isReportDue
      ? { status: "due" }
      : {
          status: "active",
          dayNumber: progress.dayNumber,
          daysRemaining: progress.daysRemaining,
          reportDueAt: progress.reportDueAt,
          periodStatus: monitorPeriodStatus(progress)
        });
  }, []);

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
      setError("スクリーンショットは最大3枚まで選べます。");
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
    if (preview) {
      setError("これは確認用画面です。実際の回答は7日間のモニター終了後に送信できます。");
      return;
    }
    if (screenshots.length < 1 || screenshots.length > 3) {
      setError("気になった画面のスクリーンショットを1〜3枚添付してください。");
      return;
    }

    setSending(true);
    const form = new FormData(event.currentTarget);

    try {
      const crowdworksName = String(form.get("crowdworksName") ?? "").trim();
      const participantResponse = await fetch("/api/monitor-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validateOnly: true, crowdworksName })
      });
      const participantBody = await participantResponse.json().catch(() => ({}));
      if (!participantResponse.ok) {
        throw new Error(participantBody.message ?? "クラウドワークスのプロフィールに表示されている名前を入力してください。");
      }

      const screenshotPaths = await Promise.all(screenshots.map(uploadScreenshot));
      const session = readMonitorSession();
      const payload = {
        crowdworksName,
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
        firstStoppedAt: String(form.get("firstStoppedAt") ?? ""),
        stoppedAt: stops,
        returnIntent: String(form.get("returnIntent") ?? ""),
        familyShare: String(form.get("familyShare") ?? ""),
        willingnessToPay: String(form.get("willingnessToPay") ?? ""),
        priceReaction: String(form.get("priceReaction") ?? ""),
        confusingPoint: String(form.get("confusingPoint") ?? "").trim(),
        usefulPoint: String(form.get("usefulPoint") ?? "").trim(),
        missingPoint: String(form.get("missingPoint") ?? "").trim(),
        screenshotPaths,
        monitorSessionId: session?.sessionId ?? null,
        usageMetrics: session ? collectMonitorUsageMetrics(session) : null
      };

      const response = await fetch("/api/monitor-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "回答を送信できませんでした。");
      markMonitorReportSubmitted();
      setCompleted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "回答を送信できませんでした。");
    } finally {
      setSending(false);
    }
  }

  if (completed || gate.status === "submitted") {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}>
          <section className={styles.completeCard}>
            <p className={styles.eyebrow}>送信完了</p>
            <h1>7日間のご協力、ありがとうございました。</h1>
            <p>いただいた回答とスクリーンショットは、迷わず使える家族の手帳へ改善するためにだけ利用します。</p>
            <div className={styles.actions} style={{ marginTop: 24 }}>
              <Link className={styles.secondary} href="/home">家族の手帳へ戻る</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (gate.status === "checking") {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}>
          <section className={styles.completeCard}>
            <p className={styles.eyebrow}>確認中</p>
            <h1>7日間の進み具合を確認しています。</h1>
          </section>
        </div>
      </main>
    );
  }

  if (gate.status === "not-started") {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}>
          <section className={styles.completeCard}>
            <p className={styles.eyebrow}>モニターテスト</p>
            <h1>この端末では、テスト開始を確認できませんでした。</h1>
            <p>最終報告は、同じスマホで7日間のテストを始めた方だけ回答できます。</p>
            <div className={styles.actions} style={{ marginTop: 24 }}>
              <Link className={styles.primary} href="/monitor">テストの説明を見る</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (gate.status === "active") {
    const dueLabel = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short"
    }).format(gate.reportDueAt);
    return (
      <main className={styles.page}>
        <div className={styles.wrap}>
          <section className={styles.completeCard}>
            <p className={styles.eyebrow}>7日間モニター {gate.dayNumber}日目</p>
            <h1>最終報告は、7日間を終えた翌日に表示されます。</h1>
            <p>回答開始は{dueLabel} 0:00です。{gate.periodStatus}1日1回を目安に、7日間で3回以上「今日の記録」を残してください。</p>
            <div className={styles.actions} style={{ marginTop: 24 }}>
              <Link className={styles.primary} href="/home#today-diary">今日の記録を書く</Link>
              <Link className={styles.secondary} href="/home">手帳へ戻る</Link>
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
          <p className={styles.lead}>15〜20分ほどです。使えなかった報告も同じ価値があり、最終回答の提出で報酬をお支払いします。</p>
        </section>

        <p className={styles.notice} role="note">
          回答・スクリーンショットは本サービスの改善目的のみに使用し、6か月後に削除します。希望があればクラウドワークスのメッセージからいつでも削除を依頼できます。回答に実名・住所・病名は書かず、スクリーンショットにも個人情報を写さないでください。
        </p>

        {preview ? (
          <p className={styles.notice} role="note">
            これは回答項目を確認するためのプレビューです。入力内容と画像は送信できません。実際の回答フォームは7日間のモニター終了後に開きます。
          </p>
        ) : null}

        <form className={styles.formCard} onSubmit={submit}>
          <div className={styles.field}>
            <label htmlFor="crowdworksName">あなたのクラウドワークス表示名<span className={styles.required}>必須</span></label>
            <p className={styles.help}>ご自身のプロフィール画面に表示されている名前を、そのまま入力してください。事前にお伝えするモニター番号はありません。</p>
            <input className={styles.input} id="crowdworksName" name="crowdworksName" maxLength={40} required placeholder="例：やまだ123" autoComplete="username" />
          </div>

          <RadioField name="ageGroup" title="あなたの年代" options={["40代未満", "40代", "50代", "60代", "70代以上"]} />
          <RadioField name="careRelation" title="介護や備えの対象になっている方との関係" options={["実の親", "義理の親", "親族・その他", "回答しない"]} />
          <RadioField name="careSituation" title="現在の状況に近いもの" options={["要介護・要支援の家族がいる", "介護が始まりそう・備えている", "過去に介護を経験した", "回答しない"]} />
          <RadioField name="device" title="主に使った端末" options={["iPhone", "Android", "パソコン", "その他"]} />
          <RadioField name="usagePeriod" title="何日間、画面を開きましたか？" options={["7日間", "4〜6日", "2〜3日", "初日だけ"]} />
          <RadioField name="recordCount" title="7日間で「今日の記録」を何日保存しましたか？" options={["7日すべて", "5〜6日", "3〜4日", "2日", "1日", "保存できなかった"]} />
          <RadioField name="checklistTried" title="確認リストを試しましたか？" options={["試して使えた", "試したが使えなかった", "見つけられなかった", "使う必要がなかった"]} />
          <RadioField name="documentMemoTried" title="書類の所在メモを試しましたか？" options={["試して使えた", "試したが使えなかった", "見つけられなかった", "使う必要がなかった"]} />
          <RadioField name="familyInviteTried" title="家族招待の画面を開いて、手順を確認できましたか？" options={["手順を確認できた", "開いたが手順が分からなかった", "見つけられなかった", "使う必要がなかった"]} />
          <RadioField name="savedRecord" title="過去に保存した記録を、あとから見つけられましたか？" options={["すぐ見つけられた", "少し迷った", "見つけられなかった", "記録を保存できなかった"]} />
          <RadioField name="aiConsult" title="AI相談を見つけて使えましたか？" options={["すぐ使えた", "少し迷ったが使えた", "見つけたが使えなかった", "見つけられなかった", "使う必要がなかった"]} />

          <RadioField name="firstStoppedAt" title="一番最初に迷った場所はどこですか？" options={STOP_OPTIONS} />

          <fieldset className={styles.field}>
            <legend>ほかにも止まった、または迷った場所はありますか？<span className={styles.required}>複数選択可</span></legend>
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
          <RadioField name="willingnessToPay" title="この7日間の体験に、あなたなら月いくらまで払えますか？" options={["0円（無料なら使う）", "300円まで", "500円まで", "980円まで", "980円以上"]} />
          <RadioField name="priceReaction" title="実際の価格は月980円（年9,800円）です。どうしますか？" options={["月980円を払って使う", "年払いなら検討する", "家族と相談する", "無料の範囲だけ使う", "使わない"]} />

          <TextArea name="confusingPoint" title="一番分かりにくかったところ" placeholder="押すボタンが分からなかった、保存できたか不安だった、など" />
          <TextArea name="usefulPoint" title="一番役に立ちそうだと感じたところ" />
          <TextArea name="missingPoint" title="足りない機能、または使わないと思った理由" />

          <div className={styles.field}>
            <label htmlFor="screenshots">気になった画面のスクリーンショット<span className={styles.required}>1枚必須・最大3枚</span></label>
            <p className={styles.help}>実名・住所・病名・メールアドレスなどが写っていないことを確認してください。JPEG・PNG・WebP、1枚4MB以下です。</p>
            <input className={styles.fileInput} id="screenshots" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={selectScreenshots} />
            <p className={styles.fileStatus}>{screenshots.length >= 1 ? `${screenshots.length}枚選択できました（最大3枚）` : "0枚 選択中"}</p>
            {screenshots.length > 0 && <ul className={styles.fileList}>{screenshots.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}</ul>}
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.primary} disabled={sending || preview} type="submit">
            {preview ? "プレビューでは送信できません" : sending ? "回答と画像を送信しています…" : "7日間の検証結果を送信する"}
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
