"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ParentStatus } from "@oyano/shared";
import { PREFECTURES } from "@/lib/prefectures";
import { isMonitorCampaignSubmissionOpen } from "@/lib/monitorCampaign";
import { readMonitorSession, startMonitorSession } from "@/lib/monitorSession";
import { createCase, notebookQuota, NotebookLimitError, resetLocalNotebookData, type PersonProfile } from "@/lib/store";

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

const allStatusItems = [...primaryItems, ...moreItems];

type RequiredProfileField = "displayName" | "relationship" | "parentPrefecture" | "parentCity";

const requiredProfileLabels: Record<RequiredProfileField, string> = {
  displayName: "呼び名",
  relationship: "関係",
  parentPrefecture: "都道府県",
  parentCity: "市区町村"
};

function missingRequiredProfileFields(profile: Partial<PersonProfile>): RequiredProfileField[] {
  return (Object.keys(requiredProfileLabels) as RequiredProfileField[])
    .filter((field) => !profile[field]?.trim());
}

function statusTitle(status: ParentStatus) {
  return allStatusItems.find((item) => item.key === status)?.title ?? "現在の状況";
}

function compactProfile(profile: Partial<PersonProfile>, status: ParentStatus): Partial<PersonProfile> {
  const displayName = profile.displayName?.trim();
  const fullName = profile.fullName?.trim();
  const relationship = profile.relationship?.trim();
  const birthDate = profile.birthDate?.trim();
  const parentPrefecture = profile.parentPrefecture?.trim();
  const parentCity = profile.parentCity?.trim();
  const userPrefecture = profile.userPrefecture?.trim();
  const careStatus = profile.careStatus?.trim();

  return {
    displayName: displayName || fullName || undefined,
    fullName: fullName || undefined,
    relationship: relationship || undefined,
    birthDate: birthDate || undefined,
    parentPrefecture: parentPrefecture || undefined,
    parentCity: parentCity || undefined,
    userPrefecture: userPrefecture || undefined,
    careStatus: careStatus || statusTitle(status)
  };
}

export default function StartPage() {
  const router = useRouter();
  const [choosingStatus, setChoosingStatus] = useState<ParentStatus | null>(null);
  const [chooseError, setChooseError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [profileValidationAttempted, setProfileValidationAttempted] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<PersonProfile>>({
    displayName: "",
    fullName: "",
    relationship: "",
    birthDate: "",
    parentPrefecture: "",
    parentCity: ""
  });
  const displayNameInputRef = useRef<HTMLInputElement>(null);
  const relationshipInputRef = useRef<HTMLInputElement>(null);
  const parentPrefectureInputRef = useRef<HTMLSelectElement>(null);
  const parentCityInputRef = useRef<HTMLInputElement>(null);
  const chooseErrorRef = useRef<HTMLDivElement>(null);

  // 開いた時点で埋まっているなら、選ばせる前に伝える。
  // 11個の選択肢を読んで押してから断られるのは、いちばん徒労になる。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isReset = params.get("reset") === "1";
    const isMonitor = params.get("monitor") === "1";
    if (isMonitor && !isMonitorCampaignSubmissionOpen()) {
      router.replace("/monitor");
      return;
    }
    const monitorStartedAtForLocalTest = process.env.NODE_ENV === "development"
      ? params.get("monitorStartedAt")
      : null;
    const localTestNow = monitorStartedAtForLocalTest && Number.isFinite(Date.parse(monitorStartedAtForLocalTest))
      ? new Date(monitorStartedAtForLocalTest)
      : undefined;
    const existingMonitorSession = readMonitorSession();
    if (params.get("fresh") === "1" || isReset) {
      resetLocalNotebookData();
      params.delete("fresh");
      params.delete("reset");
    }
    if (isMonitor) {
      startMonitorSession({ restart: isReset || Boolean(localTestNow), now: localTestNow });
      params.delete("monitor");
    }
    params.delete("monitorStartedAt");
    const nextQuery = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);

    const quota = notebookQuota();
    if (!isReset && existingMonitorSession && quota.count > 0) {
      router.replace("/home");
      return;
    }
    if (!quota.canCreate) {
      setChooseError(quota.message);
      setLimitReached(true);
    } else {
      setChooseError(null);
      setLimitReached(false);
    }
  }, [router]);

  useEffect(() => {
    router.prefetch("/home");
  }, [router]);

  function updateProfileDraft(field: keyof PersonProfile, value: string) {
    setProfileDraft((current) => ({ ...current, [field]: value }));
  }

  function focusRequiredField(field: RequiredProfileField) {
    const target = field === "displayName"
      ? displayNameInputRef.current
      : field === "relationship"
        ? relationshipInputRef.current
        : field === "parentPrefecture"
          ? parentPrefectureInputRef.current
          : parentCityInputRef.current;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }

  function focusChooseError() {
    window.requestAnimationFrame(() => {
      chooseErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      chooseErrorRef.current?.focus({ preventScroll: true });
    });
  }

  async function choose(status: ParentStatus) {
    if (choosingStatus) return;
    if (readMonitorSession() && notebookQuota().count > 0) {
      router.push("/home");
      return;
    }

    const missingFields = missingRequiredProfileFields(profileDraft);
    if (missingFields.length > 0) {
      setChooseError(null);
      setProfileValidationAttempted(true);
      window.requestAnimationFrame(() => focusRequiredField(missingFields[0]));
      return;
    }

    if (limitReached) {
      setProfileValidationAttempted(false);
      setChooseError(notebookQuota().message);
      focusChooseError();
      return;
    }

    setChooseError(null);
    setProfileValidationAttempted(false);
    setChoosingStatus(status);
    try {
      const record = await createCase(status, compactProfile(profileDraft, status));
      router.push(`/home?created=${record.id}`);
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
      focusChooseError();
    }
  }

  const personLabel = profileDraft.displayName?.trim() || profileDraft.fullName?.trim() || "この人";
  const missingRequiredFields = profileValidationAttempted
    ? missingRequiredProfileFields(profileDraft)
    : [];
  const missingRequiredFieldSet = new Set(missingRequiredFields);

  return (
    <main className="paper-bg notebook-start-page">
      <section className="toc-header">
        <div className="toc-start-brand" aria-label="親のもしもナビ">
          <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
          <span>
            <strong>親のもしもナビ</strong>
            <small>はじめての手帳登録</small>
          </span>
        </div>
        <p className="toc-kicker">無料・カード登録不要</p>
        <h1>まず、管理する人の情報を入れます。</h1>
        <p>父母、義父母、祖父母、親戚など、誰でも大丈夫です。名前や関係を入れてから、今の状況を1つ選ぶと、その人専用の手帳ができます。</p>
        <div className="toc-first-step" aria-label="最初にすること">
          <span>今日やること</span>
          <strong>1. 誰の手帳か入力 → 2. 近い状況を選ぶ → 3. 家族ボードで管理</strong>
        </div>
      </section>

      <section className="start-urgent" aria-label="いま起きている場合">
        <p className="start-urgent-lead">いま急いでいる場合は、情報入力より先にこちらです。</p>
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

      <section className="notebook-card start-profile-card" aria-label="管理する人の基本情報">
        <div className="start-section-heading">
          <span>1. 誰の手帳ですか</span>
          <h2>最初は4つだけ入れれば大丈夫です。</h2>
          <p>呼び名、関係、親御さんの都道府県と市区町村を入れてください。番地や詳細住所は入力しません。</p>
        </div>
        {missingRequiredFields.length > 0 ? (
          <div className="start-profile-error-summary" id="start-profile-error-summary" role="alert">
            <strong>入力されていない必須項目があります。</strong>
            <p>{missingRequiredFields.map((field) => requiredProfileLabels[field]).join("、")} を入力してください。</p>
          </div>
        ) : null}
        <div className="start-profile-grid">
          <label className={missingRequiredFieldSet.has("displayName") ? "is-error" : undefined}>
            <span>呼び名（必須）</span>
            <input
              aria-describedby={missingRequiredFieldSet.has("displayName") ? "display-name-error" : undefined}
              aria-invalid={missingRequiredFieldSet.has("displayName")}
              autoComplete="off"
              inputMode="text"
              required
              onChange={(event) => updateProfileDraft("displayName", event.target.value)}
              placeholder="例：お母さん、義父さん"
              ref={displayNameInputRef}
              value={profileDraft.displayName ?? ""}
            />
            {missingRequiredFieldSet.has("displayName") ? <small className="start-field-error" id="display-name-error">呼び名を入力してください。</small> : null}
          </label>
          <label className={missingRequiredFieldSet.has("relationship") ? "is-error" : undefined}>
            <span>関係（必須）</span>
            <input
              aria-describedby={missingRequiredFieldSet.has("relationship") ? "relationship-error" : undefined}
              aria-invalid={missingRequiredFieldSet.has("relationship")}
              autoComplete="off"
              inputMode="text"
              required
              onChange={(event) => updateProfileDraft("relationship", event.target.value)}
              placeholder="例：母、父、義母、叔父"
              ref={relationshipInputRef}
              value={profileDraft.relationship ?? ""}
            />
            {missingRequiredFieldSet.has("relationship") ? <small className="start-field-error" id="relationship-error">関係を入力してください。</small> : null}
          </label>
          <label className={missingRequiredFieldSet.has("parentPrefecture") ? "is-error" : undefined}>
            <span>親御さんの都道府県（必須）</span>
            <select
              aria-describedby={missingRequiredFieldSet.has("parentPrefecture") ? "parent-prefecture-error" : undefined}
              aria-invalid={missingRequiredFieldSet.has("parentPrefecture")}
              onChange={(event) => updateProfileDraft("parentPrefecture", event.target.value)}
              ref={parentPrefectureInputRef}
              required
              value={profileDraft.parentPrefecture ?? ""}
            >
              <option value="">選択してください</option>
              {PREFECTURES.map((prefecture) => <option key={prefecture} value={prefecture}>{prefecture}</option>)}
            </select>
            {missingRequiredFieldSet.has("parentPrefecture") ? <small className="start-field-error" id="parent-prefecture-error">都道府県を選んでください。</small> : null}
          </label>
          <label className={missingRequiredFieldSet.has("parentCity") ? "is-error" : undefined}>
            <span>市区町村（必須・番地不要）</span>
            <input
              aria-describedby={missingRequiredFieldSet.has("parentCity") ? "parent-city-error" : undefined}
              aria-invalid={missingRequiredFieldSet.has("parentCity")}
              autoComplete="address-level2"
              inputMode="text"
              maxLength={80}
              onChange={(event) => updateProfileDraft("parentCity", event.target.value)}
              placeholder="例：神戸市、西宮市"
              ref={parentCityInputRef}
              required
              value={profileDraft.parentCity ?? ""}
            />
            {missingRequiredFieldSet.has("parentCity") ? <small className="start-field-error" id="parent-city-error">市区町村を入力してください。</small> : null}
          </label>
          <label>
            <span>フルネーム</span>
            <input
              autoComplete="name"
              inputMode="text"
              onChange={(event) => updateProfileDraft("fullName", event.target.value)}
              placeholder="例：山田 花子"
              value={profileDraft.fullName ?? ""}
            />
          </label>
          <label>
            <span>生年月日（任意）</span>
            <input
              onChange={(event) => updateProfileDraft("birthDate", event.target.value)}
              type="date"
              value={profileDraft.birthDate ?? ""}
            />
          </label>
        </div>
        <p className="start-profile-note">入力した内容は、登録後のプロフィール欄でそのまま編集できます。</p>
      </section>

      <section className="notebook-card toc-book" aria-label="親の状況を選ぶ">
        <div className="start-section-heading">
          <span>2. いまの状況を選ぶ</span>
          <h2>{personLabel}に一番近いカードを1つ押してください。</h2>
          <p>押すと、この人の手帳と確認リストを作って家族ボードに戻ります。</p>
        </div>
        {chooseError ? (
          <div className="toc-error" ref={chooseErrorRef} role="alert" tabIndex={-1}>
            <p>{chooseError}</p>
            {limitReached ? (
              <p className="toc-error-actions">
                <Link href="/plans#plus">Plusを見る</Link>
                <Link className="secondary" href="/home">いまの手帳へ戻る</Link>
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="toc-chapter">
          <h2 className="chapter-tab teal">これから備える</h2>
          <div className="toc-list">
            {primaryItems.map((item) => (
              <StatusRow
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
                choosingStatus={choosingStatus}
                item={item}
                key={item.key}
                onChoose={choose}
                tone="sand"
              />
            ))}
          </div>
        </details>
      </section>
    </main>
  );
}

function StatusRow({
  choosingStatus,
  item,
  onChoose,
  tone
}: {
  choosingStatus: ParentStatus | null;
  item: TocItem;
  onChoose: (status: ParentStatus) => void;
  tone: "teal" | "sand";
}) {
  const isChoosing = choosingStatus === item.key;
  return (
    <button
      className={`toc-row ${tone} ${isChoosing ? "is-opening" : ""}`}
      disabled={Boolean(choosingStatus)}
      aria-label={`${item.title}でこの人の手帳を作る`}
      onClick={() => onChoose(item.key)}
      type="button"
    >
      <span className={`toc-num toc-icon ${item.icon}`} aria-hidden="true">
        {isChoosing ? <span className="toc-checkmark">✓</span> : <span className="toc-symbol" />}
      </span>
      <span className="toc-main">
        <strong className="toc-title">{item.title}</strong>
        <span className="toc-hint">{item.hint}</span>
        <span className="toc-action-text">この人の手帳を作る</span>
      </span>
      <span className="toc-arrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}
