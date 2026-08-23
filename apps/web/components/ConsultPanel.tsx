"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CONSULT_MAX_ENTRIES,
  CONSULT_MAX_QUESTION_LENGTH,
  CONSULT_SENT_FIELDS,
  CONSULT_WITHHELD_FIELDS,
  consultAnswerToHistoryTurn,
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
type ConversationTurn = {
  id: string;
  question: string;
  answer: ConsultAnswer;
  disclaimer: string;
  saved: boolean;
  saveSyncPhase: SaveSyncPhase;
  saveSyncMessage: string;
};
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
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasSubstance, setHasSubstance] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
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
      : turns.length > 0
        ? "続けて相談する"
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

  function updateTurn(id: string, patch: Partial<ConversationTurn>) {
    setTurns((current) => current.map((turn) => turn.id === id ? { ...turn, ...patch } : turn));
  }

  function selectCase(caseId: string) {
    if (phase === "loading") return;
    setActiveCaseId(caseId);
    setTurns([]);
    setQuestion("");
    setErrorMessage("");
    setOpenedFromRecord(false);
    setPhase("idle");
  }

  async function submit() {
    if (!activeCase || question.trim().length < 4) return;

    const submittedQuestion = question.trim();
    setPhase("loading");
    setErrorMessage("");

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
      setAuthChecked(true);

      const response = await fetch("/api/consult", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          question: submittedQuestion,
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
          tasks,
          history: turns.map((turn) => consultAnswerToHistoryTurn(turn.question, turn.answer))
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

      const turnId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${turns.length}`;
      setTurns((current) => [
        ...current,
        {
          id: turnId,
          question: submittedQuestion,
          answer: data.answer as ConsultAnswer,
          disclaimer: data.disclaimer ?? "",
          saved: false,
          saveSyncPhase: "idle",
          saveSyncMessage: ""
        }
      ]);
      setQuestion("");
      setOpenedFromRecord(false);
      const accessResponse = await fetch("/api/consult", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      });
      const access = await accessResponse.json().catch(() => null) as ConsultAccess | null;
      if (accessResponse.ok && access) setConsultAccess(access);
      trackFunnel("consult_asked");
      setPhase("done");
      window.setTimeout(() => {
        document.getElementById(`consult-turn-${turnId}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 80);
    } catch {
      setErrorMessage("通信できませんでした。電波のよい場所でもう一度お試しください。");
      setPhase("error");
    }
  }

  async function saveToNotebook(turn: ConversationTurn) {
    if (!activeCase) return;

    addDiaryEntry({
      caseId: activeCase.id,
      date: todayInputValue(),
      mood: "stable",
      body: consultAnswerToDiaryBody(turn.question, turn.answer),
      attachments: []
    });
    updateTurn(turn.id, {
      saved: true,
      saveSyncPhase: "saving",
      saveSyncMessage: "クラウド控えにも保存しています。"
    });

    try {
      const client = getBrowserSupabase();
      if (!client) {
        updateTurn(turn.id, {
          saveSyncPhase: "local-only",
          saveSyncMessage: "この端末の手帳に残しました。クラウド控えは家族ボードでメール確認後に保存されます。"
        });
        return;
      }

      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        updateTurn(turn.id, {
          saveSyncPhase: "local-only",
          saveSyncMessage: "この端末の手帳に残しました。クラウド控えは家族ボードでメール確認後に保存されます。"
        });
        return;
      }

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
        updateTurn(turn.id, {
          saveSyncPhase: "error",
          saveSyncMessage: "この端末の手帳には残しました。クラウド控えは家族ボードで確認してください。"
        });
        return;
      }

      updateTurn(turn.id, {
        saveSyncPhase: "saved",
        saveSyncMessage: "クラウド控えにも保存しました。"
      });
    } catch {
      updateTurn(turn.id, {
        saveSyncPhase: "error",
        saveSyncMessage: "この端末の手帳には残しました。通信できる場所で家族ボードを開くと控え保存できます。"
      });
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
                disabled={phase === "loading"}
                key={caseRecord.id}
                onClick={() => selectCase(caseRecord.id)}
                type="button"
              >
                <strong>{consultNotebookLabel(caseRecord, index, cases)}</strong>
                <small>{consultNotebookMeta(caseRecord)}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <section className="consult-chat" aria-label="AI相談チャット">
        <header className="consult-chat-head">
          <div className="consult-chat-title">
            <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
            <div>
              <p>AI相談チャット</p>
              <h2>{consultNotebookBaseName(activeCase)}の手帳を読んで答えます</h2>
            </div>
          </div>
          <p className="consult-plan-status">
            {!authChecked
              ? "利用条件を確認中"
              : consultAccess?.plan === "plus"
                ? "Family Plus・同じ会話を続けられます"
                : consultAccess?.trialAvailable
                  ? "最初の1回答は無料です"
                  : "無料回答は利用済みです"}
          </p>
        </header>

        {openedFromRecord && turns.length === 0 ? (
          <div className="consult-ready-card" role="status">
            <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
            <div>
              <span>記録から相談</span>
              <strong>質問文は入っています。そのまま送れます。</strong>
              <p>保存した記録とプロフィールも一緒に読みます。</p>
            </div>
          </div>
        ) : null}

        {turns.length === 0 ? (
          <div className="consult-chat-intro">
            <h2>聞きたいことを1つ書いてください</h2>
            <p>一度答えた後も、この画面で会話の続きを聞けます。</p>
            <div className="consult-suggestions">
              {suggestedQuestions.map((item) => (
                <button key={item} onClick={() => setQuestion(item)} type="button">{item}</button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.length > 0 ? (
          <div className="consult-thread" aria-live="polite">
            {turns.map((turn) => (
              <article className="consult-turn" id={`consult-turn-${turn.id}`} key={turn.id}>
                <div className="consult-message consult-message-user">
                  <span>あなた</span>
                  <div className="consult-bubble"><p>{turn.question}</p></div>
                </div>
                <div className="consult-message consult-message-assistant">
                  <div className="consult-assistant-head">
                    <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
                    <strong>AI相談</strong>
                  </div>
                  <div className="consult-answer-block">
                    <h3>いまの状況</h3>
                    <p>{turn.answer.situation}</p>
                  </div>

                  {turn.answer.nextChecks.length > 0 ? (
                    <div className="consult-answer-block">
                      <h3>次に確認するとよいこと</h3>
                      <ol className="consult-checks">
                        {turn.answer.nextChecks.map((check, index) => (
                          <li key={`${check.title}-${index}`}>
                            <strong>{check.title}</strong>
                            <small>{check.why}</small>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}

                  {turn.answer.askQuestions.length > 0 ? (
                    <div className="consult-answer-block">
                      <h3>窓口で聞くこと</h3>
                      <ul className="consult-list">
                        {turn.answer.askQuestions.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {turn.answer.providerCategories.length > 0 ? (
                    <div className="consult-answer-block">
                      <h3>相談先の候補</h3>
                      <div className="consult-chips">
                        {turn.answer.providerCategories.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
                      </div>
                    </div>
                  ) : null}

                  {turn.answer.watchOuts.length > 0 ? (
                    <div className="consult-answer-block">
                      <h3>気をつけること</h3>
                      <ul className="consult-list">
                        {turn.answer.watchOuts.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {turn.answer.recordSuggestion ? (
                    <div className="consult-answer-block">
                      <h3>次に手帳へ残すこと</h3>
                      <p>{turn.answer.recordSuggestion}</p>
                    </div>
                  ) : null}

                  <div className="consult-save">
                    <button
                      disabled={turn.saved || turn.saveSyncPhase === "saving"}
                      onClick={() => saveToNotebook(turn)}
                      type="button"
                    >
                      {turn.saveSyncPhase === "saving" ? "手帳に残しています…" : turn.saved ? "手帳に保存済み" : "この回答を手帳に残す"}
                    </button>
                    {turn.saved ? (
                      <p role="status">
                        今日の記録として手帳に残しました。
                        {turn.saveSyncMessage ? <span>{turn.saveSyncMessage}</span> : null}
                        <Link href="/home#diary-history">手帳で見る</Link>
                      </p>
                    ) : null}
                  </div>
                  {turn.disclaimer ? <p className="consult-disclaimer">{turn.disclaimer}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {phase === "loading" ? (
          <div className="consult-message consult-message-assistant consult-message-loading" role="status">
            <div className="consult-assistant-head">
              <img src="/brand/watch-bird-mark.svg" alt="" aria-hidden="true" />
              <strong>AI相談</strong>
            </div>
            <p>手帳とこれまでの会話を読んでいます。30秒ほどかかることがあります。</p>
          </div>
        ) : null}

        <div className="consult-composer">
          <h2>{turns.length > 0 ? "続けて聞きたいことを書いてください" : "相談内容を書く"}</h2>
          {needsPlus ? (
            <div className="consult-followup-gate">
              <strong>無料のおためし回答はここまでです。</strong>
              <p>Family Plusなら、上の会話を引き継いだまま続けて質問できます。</p>
              <Link className="consult-submit consult-submit-link" href="/plans#plus">
                Plusでこの相談を続ける
              </Link>
            </div>
          ) : (
            <>
              <textarea
                maxLength={CONSULT_MAX_QUESTION_LENGTH}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={turns.length > 0
                  ? "例: さっき教えてもらった中で、まず病院には何と聞けばいいですか。"
                  : "例: 退院の話が出ています。何から確認すればいいですか。"}
                rows={4}
                value={question}
              />
              <p className="consult-count">{question.length} / {CONSULT_MAX_QUESTION_LENGTH}</p>
              {turns.length === 0 ? (
                <label className="consult-consent">
                  <input checked={consent} onChange={(event) => toggleConsent(event.target.checked)} type="checkbox" />
                  <span>手帳の内容をAI相談に送ることに同意します。</span>
                </label>
              ) : null}
              <button className="consult-submit" disabled={submitDisabled} onClick={submit} type="button">
                {consultButtonLabel}
              </button>
            </>
          )}
          {!hasSubstance ? (
            <p className="consult-hint">
              先に手帳へ記録を1件書くか、プロフィールを2つ以上埋めてください。
              <Link href="/home#today-diary">今日の記録を書く</Link>
            </p>
          ) : null}
          {!consent && turns.length === 0 && !needsPlus ? <p className="consult-hint">同意すると相談ボタンを押せます。</p> : null}
          {phase === "error" ? <p className="consult-error" role="status">{errorMessage}</p> : null}
        </div>
      </section>

      <details className="consult-disclosure">
        <summary>AIに送る情報を確認する</summary>
        <div className="consult-disclosure-body">
          <p>相談のたびに必要な内容だけを外部の生成AI（Anthropic Claude）へ送ります。送った内容は学習には使われません。</p>
          <div className="consult-disclosure-grid">
            <div>
              <strong>送るもの</strong>
              <ul>{CONSULT_SENT_FIELDS.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div className="is-withheld">
              <strong>送らないもの</strong>
              <ul>{CONSULT_WITHHELD_FIELDS.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
