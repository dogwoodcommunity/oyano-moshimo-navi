"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CONSULT_MAX_ENTRIES,
  CONSULT_MAX_QUESTION_LENGTH,
  CONSULT_SENT_FIELDS,
  CONSULT_WITHHELD_FIELDS,
  consultAnswerToDiaryBody,
  hasNotebookSubstance,
  statusLabel,
  type ConsultAnswer
} from "@oyano/shared";
import { getBrowserSupabase } from "@/lib/browserSupabase";
import { trackFunnel } from "@/lib/funnel";
import {
  addDiaryEntry,
  listDiaryEntries,
  listLocalCases,
  type CaseRecord
} from "@/lib/store";

const CONSENT_STORAGE_KEY = "oyano_consult_consent_v01";

const suggestedQuestions = [
  "いまの記録から、見落としていることはありますか",
  "退院後の生活をどう決めればいいですか",
  "介護保険の申請はどう進めればいいですか",
  "家族でどう役割を分ければいいですか",
  "次の受診で何を聞けばいいですか"
];

type Phase = "idle" | "loading" | "done" | "error";
type SaveSyncPhase = "idle" | "saving" | "saved" | "local-only" | "error";
type ConsultAccess = {
  signedIn: boolean;
  plan: "free" | "plus";
  trialAvailable: boolean;
  trialUsedAt: string | null;
  canConsult: boolean;
};

function readConsent(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage?.getItem(CONSENT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeConsent(value: boolean) {
  try {
    if (value) {
      window.localStorage?.setItem(CONSENT_STORAGE_KEY, "1");
    } else {
      window.localStorage?.removeItem(CONSENT_STORAGE_KEY);
    }
  } catch {
    // Private browsing rejects writes. The current session still holds the state.
  }
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function birthDateToAgeBand(birthDate?: string) {
  if (!birthDate) return undefined;
  const year = Number(birthDate.slice(0, 4));
  if (!Number.isFinite(year) || year < 1900) return undefined;
  const age = new Date().getFullYear() - year;
  if (age < 0 || age > 130) return undefined;
  return `${Math.floor(age / 10) * 10}代`;
}

function allDiaryEntriesForSync(cases: CaseRecord[]) {
  return cases.flatMap((caseRecord) => listDiaryEntries(caseRecord.id));
}

function consultNotebookBaseName(caseRecord: CaseRecord) {
  const profile = caseRecord.personProfile;
  const candidates = [
    profile?.displayName,
    profile?.fullName,
    caseRecord.answers.targetName,
    profile?.relationship ? `${profile.relationship}の手帳` : undefined
  ];
  const name = candidates.find((item) => item?.trim())?.trim();
  return name || "名前未入力";
}

function consultNotebookLabel(caseRecord: CaseRecord, index: number, allCases: CaseRecord[]) {
  const baseName = consultNotebookBaseName(caseRecord);
  const sameNameCount = allCases.filter((item) => consultNotebookBaseName(item) === baseName).length;
  const shouldPrefix = sameNameCount > 1 || baseName === "名前未入力" || baseName === "この手帳";
  return shouldPrefix ? `${index + 1}人目：${baseName}` : baseName;
}

function consultNotebookMeta(caseRecord: CaseRecord) {
  const createdAt = new Date(caseRecord.createdAt);
  const createdLabel = Number.isNaN(createdAt.getTime())
    ? "作成日未設定"
    : `${createdAt.getMonth() + 1}/${createdAt.getDate()}作成`;
  return `${statusLabel(caseRecord.selectedStatus)}・${createdLabel}`;
}

export function ConsultPanel() {
  const [loaded, setLoaded] = useState(false);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | undefined>();
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState<ConsultAnswer | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveSyncPhase, setSaveSyncPhase] = useState<SaveSyncPhase>("idle");
  const [saveSyncMessage, setSaveSyncMessage] = useState("");
  const [hasSubstance, setHasSubstance] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState("");
  const [consultAccess, setConsultAccess] = useState<ConsultAccess | null>(null);
  const [openedFromRecord, setOpenedFromRecord] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const localCases = listLocalCases();
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const requestedCaseId = params?.get("caseId") ?? undefined;
    const requestedQuestion = params?.get("q")?.trim() ?? "";
    const initialCase = requestedCaseId && localCases.some((item) => item.id === requestedCaseId)
      ? requestedCaseId
      : localCases[0]?.id;

    setCases(localCases);
    setActiveCaseId(initialCase);
    if (requestedQuestion) {
      setQuestion(requestedQuestion.slice(0, CONSULT_MAX_QUESTION_LENGTH));
      setOpenedFromRecord(true);
    }
    setConsent(readConsent());
    setLoaded(true);

    const client = getBrowserSupabase();
    void (async () => {
      try {
        const data = client ? (await client.auth.getSession()).data : null;
        if (cancelled) return;
        const token = data?.session?.access_token;
        setSignedInEmail(data?.session?.user.email ?? "");
        const response = await fetch("/api/consult", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        const access = await response.json().catch(() => null) as ConsultAccess | null;
        if (!cancelled && response.ok && access) setConsultAccess(access);
      } catch {
        // 利用条件の確認に失敗しても、送信時にAPI側で再判定できる。
        if (!cancelled) setConsultAccess(null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const activeCase = useMemo(
    () => cases.find((item) => item.id === activeCaseId),
    [cases, activeCaseId]
  );
  const needsPlus = Boolean(authChecked && consultAccess && !consultAccess.canConsult);
  const submitDisabled = !authChecked
    || !consent
    || !hasSubstance
    || question.trim().length < 4
    || phase === "loading";
  const consultButtonLabel = phase === "loading"
    ? "整理しています…"
    : !authChecked
      ? "利用条件を確認しています…"
      : consultAccess?.trialAvailable
        ? "初回無料でAI相談する"
        : "AI相談をはじめる";

  useEffect(() => {
    if (!activeCase) return;
    setHasSubstance(hasNotebookSubstance({
      question: "",
      person: activeCase.personProfile,
      entries: listDiaryEntries(activeCase.id).map((entry) => ({ body: entry.body }))
    }));
  }, [activeCase]);

  function toggleConsent(next: boolean) {
    setConsent(next);
    writeConsent(next);
  }

  async function submit() {
    if (!activeCase || question.trim().length < 4) return;

    setPhase("loading");
    setErrorMessage("");
    setAnswer(null);
    setSaved(false);
    setSaveSyncPhase("idle");
    setSaveSyncMessage("");

    const entries = listDiaryEntries(activeCase.id).slice(0, CONSULT_MAX_ENTRIES).map((entry) => ({
      date: entry.date,
      mood: entry.mood,
      body: entry.body
    }));
    const tasks = (activeCase.result?.tasks ?? []).slice(0, 12).map((task) => ({
      title: task.title,
      dueDate: task.dueDate
    }));

    try {
      const client = getBrowserSupabase();
      const sessionData = client ? (await client.auth.getSession()).data : null;
      const accessToken = sessionData?.session?.access_token;
      setSignedInEmail(sessionData?.session?.user.email ?? "");
      setAuthChecked(true);

      const response = await fetch("/api/consult", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          question: question.trim(),
          person: {
            relationship: activeCase.personProfile?.relationship,
            careStatus: activeCase.personProfile?.careStatus,
            birthDate: birthDateToAgeBand(activeCase.personProfile?.birthDate),
            hospitalOrFacility: activeCase.personProfile?.hospitalOrFacility,
            medicationNote: activeCase.personProfile?.medicationNote,
            familyStructureNote: activeCase.personProfile?.familyStructureNote,
            carePreference: activeCase.personProfile?.carePreference
          },
          entries,
          tasks
        })
      });

      const data = await response.json() as {
        answer?: ConsultAnswer;
        disclaimer?: string;
        error?: string;
        message?: string;
      };

      if (!response.ok || !data.answer) {
        setErrorMessage(data.message ?? "うまく整理できませんでした。もう一度お試しください。");
        setPhase("error");
        return;
      }

      setAnswer(data.answer);
      setDisclaimer(data.disclaimer ?? "");
      const accessResponse = await fetch("/api/consult", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      });
      const access = await accessResponse.json().catch(() => null) as ConsultAccess | null;
      if (accessResponse.ok && access) setConsultAccess(access);
      trackFunnel("consult_asked");
      setPhase("done");
      window.setTimeout(() => {
        document.querySelector(".consult-answer")?.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 80);
    } catch {
      setErrorMessage("通信できませんでした。電波のよい場所でもう一度お試しください。");
      setPhase("error");
    }
  }

  async function saveToNotebook() {
    if (!activeCase || !answer) return;

    addDiaryEntry({
      caseId: activeCase.id,
      date: todayInputValue(),
      mood: "stable",
      body: consultAnswerToDiaryBody(question, answer),
      attachments: []
    });
    setSaved(true);
    setSaveSyncPhase("saving");
    setSaveSyncMessage("クラウド控えにも保存しています。");

    try {
      const client = getBrowserSupabase();
      if (!client) {
        setSaveSyncPhase("local-only");
        setSaveSyncMessage("この端末の手帳に残しました。クラウド控えは家族ボードでメール確認後に保存されます。");
        return;
      }

      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setSignedInEmail("");
        setSaveSyncPhase("local-only");
        setSaveSyncMessage("この端末の手帳に残しました。クラウド控えは家族ボードでメール確認後に保存されます。");
        return;
      }

      setSignedInEmail(sessionData.session?.user.email ?? "");

      const nextCases = listLocalCases();
      const response = await fetch("/api/notebook/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cases: nextCases,
          diaryEntries: allDiaryEntriesForSync(nextCases)
        })
      });

      if (!response.ok) {
        setSaveSyncPhase("error");
        setSaveSyncMessage("この端末の手帳には残しました。クラウド控えは家族ボードで確認してください。");
        return;
      }

      setSaveSyncPhase("saved");
      setSaveSyncMessage("クラウド控えにも保存しました。");
    } catch {
      setSaveSyncPhase("error");
      setSaveSyncMessage("この端末の手帳には残しました。通信できる場所で家族ボードを開くと控え保存できます。");
    }
  }

  if (!loaded) {
    return <p className="consult-loading">読み込み中です</p>;
  }

  if (!activeCase) {
    return (
      <section className="consult-empty">
        <h2>先に1人分の手帳を作ってください</h2>
        <p>相談は、その人のプロフィールと記録を前提に整理します。手帳がないと、一般論しか返せません。</p>
        <Link className="button" href="/start">手帳を作る</Link>
      </section>
    );
  }

  return (
    <div className="consult-panel">
      {cases.length > 1 ? (
        <div className="consult-case-picker" aria-label="相談する手帳">
          <div className="consult-step-head">
            <span>1</span>
            <div>
              <strong>相談する手帳を選ぶ</strong>
              <small>複数ある時は、まず誰の相談かを選びます。</small>
            </div>
          </div>
          <div className="consult-case-tabs" role="group">
            {cases.map((caseRecord, index) => (
              <button
                className={caseRecord.id === activeCaseId ? "is-active" : ""}
                key={caseRecord.id}
                onClick={() => setActiveCaseId(caseRecord.id)}
                type="button"
              >
                <strong>{consultNotebookLabel(caseRecord, index, cases)}</strong>
                <small>{consultNotebookMeta(caseRecord)}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <section className="consult-form" aria-label="相談する">
        {openedFromRecord ? (
          <div className="consult-ready-card" role="status">
            <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
            <div>
              <span>記録から相談</span>
              <strong>質問文は入っています。下の緑のボタンで相談できます。</strong>
              <p>記録した内容と手帳のプロフィールを前提に、次に確認することを整理します。</p>
            </div>
          </div>
        ) : null}
        <h2>この人のことで、AIに聞きたいことを書いてください</h2>
        <div className="consult-suggestions">
          {suggestedQuestions.map((item) => (
            <button key={item} onClick={() => setQuestion(item)} type="button">{item}</button>
          ))}
        </div>
        <textarea
          maxLength={CONSULT_MAX_QUESTION_LENGTH}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="例: 退院の話が出ていますが、家に戻れるのか判断がつきません。何から確認すればいいですか。"
          rows={5}
          value={question}
        />
        <p className="consult-count">{question.length} / {CONSULT_MAX_QUESTION_LENGTH}</p>
        <label className="consult-consent">
          <input checked={consent} onChange={(event) => toggleConsent(event.target.checked)} type="checkbox" />
          <span>手帳の内容をAI相談に送ることに同意します。</span>
        </label>
        <p className="consult-plus-note">
          {!authChecked
            ? "利用条件を確認しています。"
            : !consultAccess
                ? "利用条件を確認できませんでした。下のボタンを押すと再確認します。"
            : consultAccess.plan === "plus"
              ? "Family Plusで利用中です。1日5回まで、この手帳を読んだ相談ができます。"
              : consultAccess.trialAvailable
                ? "初回1回は無料です。メール確認なしで、そのままAIに相談できます。2回目以降はFamily Plus（月980円・年9,800円）です。"
                : "おためし相談は使用済みです。続けて相談する場合はFamily Plus（月980円・年9,800円）で使えます。"}
        </p>
        {needsPlus ? (
          <Link className="consult-submit consult-submit-link" href="/plans#plus">
            Plusを見る（AI相談を続ける）
          </Link>
        ) : (
          <button
            className="consult-submit"
            disabled={submitDisabled}
            onClick={submit}
            type="button"
          >
            {consultButtonLabel}
          </button>
        )}
        <p className="consult-hint consult-direct-hint">
          保存したプロフィールと最近の記録は、すぐこの相談に反映されます。メール確認はAI相談の前提ではありません。
        </p>
        {!hasSubstance ? (
          <p className="consult-hint">
            先に手帳へ記録を1件書くか、プロフィールを2つ以上埋めてください。記録がないと、一般論しか返せません。
            <Link href="/home#today-diary">今日の記録を書く</Link>
          </p>
        ) : null}
        {!consent ? <p className="consult-hint">送る内容に同意すると押せます。</p> : null}
        {phase === "loading" ? <p className="consult-hint">記録を読んでいます。30秒ほどかかることがあります。</p> : null}
        {phase === "error" ? <p className="consult-error" role="status">{errorMessage}</p> : null}
      </section>

      <section className="consult-plus-gate" aria-label="長期相談の利用条件">
        <div>
          <p className="consult-gate-kicker">Plusでできること</p>
          <h2>AI相談チャットは「手帳を読んで答える」機能です。</h2>
          <p>
            プロフィールと最近の記録を前提に、次に確認すること、窓口で聞くこと、家族へ共有することを整理します。
            {signedInEmail ? ` 現在は ${signedInEmail} でクラウド控えも利用中です。` : " メール確認なしでも、まず1回その場で相談できます。"}
          </p>
          {consultAccess ? <ConsultAccessNote access={consultAccess} /> : null}
        </div>
        <div className="consult-gate-actions">
          <Link className="secondary" href="/plans#plus">Plusを見る</Link>
        </div>
      </section>

      <section className="consult-disclosure" aria-label="送る情報">
        <h2>送る情報と、送らない情報</h2>
        <p>相談のたびに、下の内容だけを外部の生成AI（Anthropic Claude）へ送ります。送った内容は学習には使われません。</p>
        <div className="consult-disclosure-grid">
          <div>
            <strong>送るもの</strong>
            <ul>
              {CONSULT_SENT_FIELDS.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="is-withheld">
            <strong>送らないもの</strong>
            <ul>
              {CONSULT_WITHHELD_FIELDS.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {answer ? (
        <section className="consult-answer" aria-label="AI相談の回答">
          <div className="consult-answer-block">
            <h2>いまの状況</h2>
            <p>{answer.situation}</p>
          </div>

          {answer.nextChecks.length > 0 ? (
            <div className="consult-answer-block">
              <h2>次に確認するとよいこと</h2>
              <ol className="consult-checks">
                {answer.nextChecks.map((check) => (
                  <li key={check.title}>
                    <strong>{check.title}</strong>
                    <small>{check.why}</small>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {answer.askQuestions.length > 0 ? (
            <div className="consult-answer-block">
              <h2>窓口で聞くこと</h2>
              <ul className="consult-list">
                {answer.askQuestions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}

          {answer.providerCategories.length > 0 ? (
            <div className="consult-answer-block">
              <h2>相談先の候補</h2>
              <div className="consult-chips">
                {answer.providerCategories.map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
          ) : null}

          {answer.watchOuts.length > 0 ? (
            <div className="consult-answer-block">
              <h2>気をつけること</h2>
              <ul className="consult-list">
                {answer.watchOuts.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}

          {answer.recordSuggestion ? (
            <div className="consult-answer-block">
              <h2>次に手帳へ残すこと</h2>
              <p>{answer.recordSuggestion}</p>
            </div>
          ) : null}

          <div className="consult-save">
            <button disabled={saved || saveSyncPhase === "saving"} onClick={saveToNotebook} type="button">
              {saveSyncPhase === "saving" ? "手帳に残しています…" : "このAI相談を手帳に残す"}
            </button>
            {saved ? (
              <p role="status">
                AI相談の回答を、今日の記録として手帳に残しました。
                {saveSyncMessage ? <span>{saveSyncMessage}</span> : null}
                <Link href="/home#diary-history">手帳で見る</Link>
              </p>
            ) : null}
          </div>

          {disclaimer ? <p className="consult-disclaimer">{disclaimer}</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function ConsultAccessNote({ access }: { access: ConsultAccess }) {
  if (access.plan === "plus") {
    return <p className="consult-access-note">Family Plusで利用中です。1日5回まで相談できます。</p>;
  }
  if (access.trialAvailable) {
    return <p className="consult-access-note">初回は、AI相談を1回だけ無料でためせます。メール確認は不要で、回答できた時だけ消費します。</p>;
  }
  return <p className="consult-access-note">おためし相談は使いました。続きはPlusで使えます。手帳と記録は無料のまま残ります。</p>;
}
