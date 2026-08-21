"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ParentStatus } from "@oyano/shared";
import { createCase, notebookQuota, NotebookLimitError } from "@/lib/store";

type TocItem = {
  num: string;
  key: ParentStatus;
  title: string;
  hint: string;
  icon: "note" | "chat" | "bed" | "home" | "care" | "heart" | "bell" | "paper" | "tree" | "box" | "check";
};

const urgentRoutes = [
  { href: "/crisis/hospital-night", title: "入院した・救急で運ばれた", hint: "今夜やることだけを順番に出します" },
  { href: "/crisis/critical", title: "危篤・看取りと言われた", hint: "知らせる人と行く人を決めるところから" },
  { href: "/crisis/just-died", title: "亡くなった直後", hint: "今日決めることだけに絞ります" }
];

const primaryItems: TocItem[] = [
  { num: "01", key: "preparing", title: "元気なうちに準備したい", hint: "連絡先や書類の場所をまとめる", icon: "note" },
  { num: "02", key: "cognitive_decline", title: "もの忘れが心配", hint: "相談先や家族で決めることを整理", icon: "chat" },
  { num: "03", key: "post_discharge_home", title: "退院後、家で過ごす", hint: "通院、在宅生活、訪問サービス", icon: "home" },
  { num: "04", key: "facility", title: "介護・施設のこと", hint: "介護や施設、家族の役割分担", icon: "care" }
];

const moreItems: TocItem[] = [
  { num: "05", key: "hospitalized", title: "入院中（落ち着いてから登録する）", hint: "病院で聞くこと、支払い、退院後のこと", icon: "bed" },
  { num: "06", key: "end_of_life", title: "看取り・終末期のこと", hint: "緊急連絡や希望を家族で確認", icon: "heart" },
  { num: "07", key: "after_death", title: "亡くなったあと", hint: "葬儀、親族連絡、役所手続きの初動", icon: "bell" },
  { num: "08", key: "after_funeral", title: "葬儀が終わった後", hint: "年金、保険、名義変更など", icon: "paper" },
  { num: "09", key: "inheritance", title: "相続前に整理したい", hint: "書類や専門家に相談する前の確認", icon: "tree" },
  { num: "10", key: "home_clearance", title: "実家を片付けたい", hint: "写真、鍵、書類、家の状態", icon: "box" },
  { num: "11", key: "completed", title: "整理が終わった", hint: "家族で見返せるように保管", icon: "check" }
];

export default function StartPage() {
  const router = useRouter();
  const [choosingStatus, setChoosingStatus] = useState<ParentStatus | null>(null);
  const [chooseError, setChooseError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  // 開いた時点で埋まっているなら、選ばせる前に伝える。
  // 11個の選択肢を読んで押してから断られるのは、いちばん徒労になる。
  useEffect(() => {
    const quota = notebookQuota();
    if (!quota.canCreate) {
      setChooseError(quota.message);
      setLimitReached(true);
    }
  }, []);

  useEffect(() => {
    router.prefetch("/diagnosis");
  }, [router]);

  async function choose(status: ParentStatus) {
    if (choosingStatus) return;
    setChooseError(null);
    setChoosingStatus(status);
    try {
      const record = await createCase(status);
      router.push(`/diagnosis?caseId=${record.id}&status=${status}`);
    } catch (error) {
      // 上限に当たったときは、失敗ではなく案内として見せる。
      // 押した人は何も間違えていないので、原因と次の一手だけを出す。
      setChooseError(
        error instanceof NotebookLimitError
          ? error.message
          : "登録画面を開けませんでした。もう一度、近い状況を押してください。"
      );
      setLimitReached(error instanceof NotebookLimitError);
      setChoosingStatus(null);
    }
  }

  return (
    <main className="paper-bg notebook-start-page">
      <section className="toc-header">
        <button className="toc-back" type="button" onClick={() => router.push("/home")}>
          ‹ もどる
        </button>
        <p className="toc-kicker">1人目の登録</p>
        <h1>管理する人の、今の状況を選んでください。</h1>
        <p>父母、義父母、親戚など、対象者はあとで名前を入力できます。まずは近い状況を1つ選びます。</p>
      </section>

      <section className="start-urgent" aria-label="いま起きている場合">
        <p className="start-urgent-lead">いま起きている場合は、登録より先にこちらです。</p>
        {urgentRoutes.map((item) => (
          <Link className="start-urgent-row" href={item.href} key={item.href}>
            <span className="start-urgent-badge">急なとき</span>
            <span className="start-urgent-body">
              <strong>{item.title}</strong>
              <small>{item.hint}</small>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        ))}
      </section>

      <section className="notebook-card toc-book" aria-label="親の状況を選ぶ">
        <div className="toc-chapter">
          <h2 className="chapter-tab teal">これから備える</h2>
          <div className="toc-list">
            {primaryItems.map((item) => (
              <StatusRow
                disabled={limitReached}
                choosingStatus={choosingStatus}
                item={item}
                key={item.key}
                onChoose={choose}
                tone="teal"
              />
            ))}
          </div>
        </div>

        <details className="toc-more">
          <summary>ほかの状況から選ぶ</summary>
          <div className="toc-list">
            {moreItems.map((item) => (
              <StatusRow
                disabled={limitReached}
                choosingStatus={choosingStatus}
                item={item}
                key={item.key}
                onChoose={choose}
                tone="sand"
              />
            ))}
          </div>
        </details>

        {chooseError ? (
          <div className="toc-error" role="status">
            <p>{chooseError}</p>
            {limitReached ? (
              <p className="toc-error-actions">
                <Link href="/plans#plus">Plusを見る</Link>
                <Link className="secondary" href="/home">いまの手帳へ戻る</Link>
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function StatusRow({
  choosingStatus,
  item,
  disabled,
  onChoose,
  tone
}: {
  choosingStatus: ParentStatus | null;
  disabled?: boolean;
  item: TocItem;
  onChoose: (status: ParentStatus) => void;
  tone: "teal" | "sand";
}) {
  const isChoosing = choosingStatus === item.key;
  return (
    <button
      className={`toc-row ${tone} ${isChoosing ? "is-opening" : ""}`}
      disabled={Boolean(choosingStatus) || Boolean(disabled)}
      onClick={() => onChoose(item.key)}
      type="button"
    >
      <span className={`toc-num toc-icon ${item.icon}`} aria-hidden="true">
        {isChoosing ? <span className="toc-checkmark">✓</span> : <span className="toc-symbol" />}
      </span>
      <span className="toc-main">
        <strong className="toc-title">{item.title}</strong>
        <span className="toc-hint">{item.hint}</span>
        <span className="toc-action-text">この状況で登録する</span>
      </span>
      <span className="toc-arrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}
