"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  completeBrowserSupabaseAuthFromUrl,
  getBrowserSupabase,
  sendMagicLink
} from "@/lib/browserSupabase";
import { resetLocalNotebookData } from "@/lib/store";

type AuthState = "checking" | "unavailable" | "signed-out" | "sending" | "sent" | "ready";
type DeleteRequestStatus = "requested" | "reviewing" | "needs_followup" | "completed";

type ExistingRequest = {
  id: string;
  status: DeleteRequestStatus;
  due_at: string | null;
  created_at: string | null;
  last_status_changed_at: string | null;
};

const statusLabels: Record<DeleteRequestStatus, string> = {
  requested: "削除依頼を受け付けました",
  reviewing: "運営が内容を確認しています",
  needs_followup: "確認のご連絡が必要です",
  completed: "削除対応が完了しました"
};

function looksLikeEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

export function AccountDeleteRequest() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [existingRequest, setExistingRequest] = useState<ExistingRequest | null>(null);
  const [confirmLocalDelete, setConfirmLocalDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const client = getBrowserSupabase();
      if (!client) {
        setAuthState("unavailable");
        return;
      }

      await completeBrowserSupabaseAuthFromUrl();
      const { data } = await client.auth.getSession();
      if (cancelled) return;

      const session = data.session;
      if (!session) {
        setAuthState("signed-out");
        return;
      }

      setAccessToken(session.access_token);
      setEmail(session.user.email ?? "");
      setAuthState("ready");

      try {
        const response = await fetch("/api/account/delete-request", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const result = await response.json().catch(() => ({})) as {
          request?: ExistingRequest | null;
          message?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(result.message ?? "削除依頼の状態を確認できませんでした。");
          return;
        }
        setExistingRequest(result.request ?? null);
      } catch {
        if (!cancelled) setError("通信できませんでした。時間をおいてもう一度お試しください。");
      }
    }

    void boot();
    return () => { cancelled = true; };
  }, []);

  async function requestSignIn() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!looksLikeEmail(normalizedEmail)) {
      setError("メールアドレスを確認してください。");
      return;
    }
    setAuthState("sending");
    setError("");
    const result = await sendMagicLink(normalizedEmail, "/account/delete");
    if (result.ok) {
      setAuthState("sent");
      setMessage("確認メールを送りました。メール内のリンクを開くと、この画面に戻ります。");
    } else {
      setAuthState("signed-out");
      setError(result.error ?? "確認メールを送れませんでした。");
    }
  }

  async function submitRequest() {
    if (!accessToken || submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!looksLikeEmail(normalizedEmail)) {
      setError("連絡先メールアドレスを確認してください。");
      return;
    }
    if (!understood) {
      setError("削除される内容を確認し、確認欄にチェックしてください。");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/account/delete-request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contact_email: normalizedEmail,
          reason: reason.trim(),
          requested_from: "web"
        })
      });
      const result = await response.json().catch(() => ({})) as {
        message?: string;
        requestId?: string;
      };
      if (!response.ok || !result.requestId) {
        setError(result.message ?? "削除依頼を送信できませんでした。");
        return;
      }

      const now = new Date().toISOString();
      setExistingRequest({
        id: result.requestId,
        status: "requested",
        due_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        created_at: now,
        last_status_changed_at: now
      });
      setMessage("削除依頼を受け付けました。原則30日以内に、削除対応または確認のご連絡を行います。");
      setReason("");
      setUnderstood(false);
    } catch {
      setError("通信できませんでした。時間をおいてもう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  function deleteLocalNotebook() {
    if (!confirmLocalDelete) {
      setConfirmLocalDelete(true);
      return;
    }
    resetLocalNotebookData();
    window.location.assign("/start");
  }

  if (authState === "checking") {
    return <p className="account-delete-loading" role="status">ログイン状態を確認しています。</p>;
  }

  return (
    <div className="account-delete-grid">
      <section className="account-delete-card">
        <h2>クラウドのアカウントと家族データ</h2>
        <p>
          誤削除を避けるため、その場では消さず、本人確認済みの削除依頼として受け付けます。
          あなたのアカウント、相談履歴と、あなたに削除権限がある手帳・写真・確認リスト・AI記憶を確認し、
          原則30日以内に対応します。ほかの家族も使っている手帳では、所有権の移管などを先にお願いする場合があります。
        </p>

        {authState === "unavailable" ? (
          <p className="account-delete-warning" role="alert">
            この環境では削除依頼の受付を準備できていません。公開版からもう一度お試しください。
          </p>
        ) : null}

        {authState === "signed-out" || authState === "sending" || authState === "sent" ? (
          <div className="account-delete-form">
            <p>まず、クラウド保存に使ったメールアドレスで本人確認をしてください。パスワードは作りません。</p>
            <label htmlFor="delete-sign-in-email">
              <span>メールアドレス</span>
              <input
                autoComplete="email"
                id="delete-sign-in-email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>
            <button disabled={authState === "sending"} onClick={() => void requestSignIn()} type="button">
              {authState === "sending" ? "送信しています…" : "確認メールを送る"}
            </button>
          </div>
        ) : null}

        {authState === "ready" ? (
          <>
            {existingRequest ? (
              <div className="account-delete-status" role="status">
                <strong>{statusLabels[existingRequest.status]}</strong>
                <p>
                  受付日: {formatDate(existingRequest.created_at) ?? "確認中"}
                  {existingRequest.status !== "completed" && formatDate(existingRequest.due_at)
                    ? `／対応目安: ${formatDate(existingRequest.due_at)}`
                    : ""}
                </p>
              </div>
            ) : null}

            {existingRequest?.status !== "completed" ? (
              <div className="account-delete-form">
                <label htmlFor="delete-contact-email">
                  <span>連絡先メールアドレス</span>
                  <input
                    autoComplete="email"
                    id="delete-contact-email"
                    inputMode="email"
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    value={email}
                  />
                </label>
                <label htmlFor="delete-reason">
                  <span>理由・補足（任意）</span>
                  <textarea
                    id="delete-reason"
                    maxLength={1000}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="例：利用を終了するため。誤って保存した内容がある場合もここに書いてください。"
                    value={reason}
                  />
                </label>
                <label className="account-delete-check">
                  <input
                    checked={understood}
                    onChange={(event) => setUnderstood(event.target.checked)}
                    type="checkbox"
                  />
                  <span>自分のアカウントと削除対象になったデータは、削除完了後に元へ戻せないことを確認しました。</span>
                </label>
                <button disabled={submitting} onClick={() => void submitRequest()} type="button">
                  {submitting ? "送信しています…" : existingRequest ? "削除依頼の内容を更新する" : "削除依頼を送信する"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {message ? <p className="account-delete-message" role="status">{message}</p> : null}
        {error ? <p className="account-delete-error" role="alert">{error}</p> : null}
      </section>

      <section className="account-delete-card account-delete-local">
        <h2>この端末だけに残っている手帳</h2>
        <p>
          クラウドの削除依頼だけでは、このブラウザ内の手帳は消えません。この端末のデータだけを今すぐ消す場合は、下の操作を2回押してください。
        </p>
        <p className="account-delete-warning">クラウドに送っていない記録は、削除すると復元できません。</p>
        <button className="is-secondary" onClick={deleteLocalNotebook} type="button">
          {confirmLocalDelete ? "もう一度押して、この端末の手帳を削除" : "この端末の手帳を削除する"}
        </button>
        {confirmLocalDelete ? (
          <button className="is-link" onClick={() => setConfirmLocalDelete(false)} type="button">削除をやめる</button>
        ) : null}
      </section>

      <p className="account-delete-back"><Link href="/home">手帳へ戻る</Link></p>
    </div>
  );
}
