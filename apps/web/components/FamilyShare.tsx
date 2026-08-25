"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  completeBrowserSupabaseAuthFromUrl,
  getBrowserSupabase,
  sendMagicLink
} from "@/lib/browserSupabase";

type FamilySummary = {
  plan: "free" | "plus";
  isOwner: boolean;
  limit: number | null;
  remaining: number | null;
  members: Array<{
    isYou: boolean;
    isOwner: boolean;
    role: string;
    relationship: string | null;
    joinedAt: string | null;
  }>;
  pendingInvites: Array<{
    invitedEmail: string | null;
    relationship: string | null;
    role: string;
    createdAt: string | null;
  }>;
};

type CreatedInvite = {
  invitedEmail: string;
  relationship: string | null;
  url: string;
  expiresInDays: number;
};

type AuthState = "checking" | "signed-out" | "sending" | "sent" | "signed-in" | "unavailable";

export function FamilyShare() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [signInEmail, setSignInEmail] = useState("");
  const [summary, setSummary] = useState<FamilySummary | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRelationship, setInviteRelationship] = useState("");
  const [invite, setInvite] = useState<CreatedInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const loadSummary = useCallback(async (token: string) => {
    const response = await fetch("/api/family", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string };
      setMessage(data.message ?? "家族の情報を読み込めませんでした。");
      return;
    }
    setSummary(await response.json() as FamilySummary);
  }, []);

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

      const token = data.session?.access_token ?? null;
      setAccessToken(token);
      setAuthState(token ? "signed-in" : "signed-out");
      if (token) await loadSummary(token);
    }

    void boot();
    return () => { cancelled = true; };
  }, [loadSummary]);

  async function requestSignIn() {
    if (!signInEmail.trim()) return;
    setAuthState("sending");
    setMessage("");
    const result = await sendMagicLink(signInEmail.trim(), "/family");
    if (result.ok) {
      setAuthState("sent");
    } else {
      setAuthState("signed-out");
      setMessage(result.error ?? "確認メールを送れませんでした。");
    }
  }

  async function createInvite() {
    if (!accessToken) return;
    setBusy(true);
    setMessage("");
    setInvite(null);
    setCopied(false);

    try {
      const response = await fetch("/api/family/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ email: inviteEmail.trim(), relationship: inviteRelationship.trim() })
      });
      const data = await response.json() as CreatedInvite & { message?: string };

      if (!response.ok) {
        setMessage(data.message ?? "招待を作れませんでした。");
        return;
      }

      setInvite(data);
      setInviteEmail("");
      setInviteRelationship("");
      await loadSummary(accessToken);
    } catch {
      setMessage("通信できませんでした。電波のよい場所でお試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteUrl() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
    } catch {
      setCopied(false);
      setMessage("自動コピーができませんでした。リンクを長押しして選択してください。");
    }
  }

  if (authState === "unavailable") {
    return (
      <section className="family-card">
        <h2>家族共有はまだ使えません</h2>
        <p>この環境ではクラウドの設定が入っていないため、家族共有を開けません。手帳の記録は端末内でこれまで通り使えます。</p>
      </section>
    );
  }

  if (authState === "checking") {
    return <p className="family-loading">読み込み中です</p>;
  }

  if (authState !== "signed-in") {
    return (
      <section className="family-card">
        <h2>まず、本人確認をします</h2>
        <p>
          家族共有はクラウドの控えを使います。メールアドレスを入れると確認メールが届きます。
          パスワードは作りません。
        </p>
        <div className="family-field">
          <label htmlFor="family-signin-email">メールアドレス</label>
          <input
            autoComplete="email"
            id="family-signin-email"
            inputMode="email"
            onChange={(event) => setSignInEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={signInEmail}
          />
        </div>
        <button
          className="family-primary"
          disabled={authState === "sending" || !signInEmail.trim()}
          onClick={requestSignIn}
          type="button"
        >
          {authState === "sending" ? "送信しています…" : "確認メールを送る"}
        </button>
        {authState === "sent" ? (
          <p className="family-note" role="status">確認メールを送りました。メール内のリンクを開くと、この画面に戻ります。</p>
        ) : null}
        {message ? <p className="family-error" role="status">{message}</p> : null}
      </section>
    );
  }

  const remaining = summary?.remaining;
  const isFull = summary?.plan === "free" && typeof remaining === "number" && remaining <= 0;
  const isSharedMember = Boolean(summary && !summary.isOwner);

  return (
    <div className="family-share">
      <section className="family-card">
        <h2>いま一緒に見ている人</h2>
        {summary ? (
          <>
            <p className="family-quota">
              {summary.plan === "plus"
                ? "Plusのため、人数の制限はありません。"
                : `無料で一緒に見られるのは、あなたのほかに${summary.limit}人までです。残り${remaining}人分。`}
            </p>
            <ul className="family-members">
              {summary.members.map((member, index) => (
                <li key={`${member.role}-${index}`}>
                  <strong>
                    {member.isYou ? "あなた" : member.relationship || "家族"}
                    {member.isOwner ? "（手帳を作った人）" : ""}
                  </strong>
                  <small>参加済み</small>
                </li>
              ))}
              {summary.pendingInvites.map((pending, index) => (
                <li className="is-pending" key={`pending-${index}`}>
                  <strong>{pending.relationship || pending.invitedEmail || "招待中の家族"}</strong>
                  <small>招待中（7日で切れます）</small>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="family-note">読み込み中です</p>
        )}
      </section>

      {isSharedMember ? (
        <section className="family-card">
          <h2>共有された手帳に参加中です</h2>
          <p>
            この手帳は、手帳を作った家族が招待とプランを管理しています。
            あなたは同じ手帳の記録、確認リスト、写真を一緒に更新できます。
          </p>
          <p className="family-note">
            招待された家族が、同じ手帳で別に支払う必要はありません。自分で別の家族手帳を作る時だけ、別途プランを考えます。
          </p>
          <Link className="family-primary" href="/home?cloud=1">共有された手帳を開く</Link>
        </section>
      ) : (
        <section className="family-card">
          <h2>家族を招待する</h2>
          <p>
            招待した人には、クラウドに保存した同じ手帳が見えるようになります。
            課金は家族手帳ごとです。招待された家族に、別の課金ボタンは出しません。
          </p>
          <p className="family-note">
            まだクラウドに保存していない場合は、先に <Link href="/home">手帳上部の「手帳データの保存先」</Link> から保存してください。招待した家族には、保存した内容が見えます。
          </p>
          <div className="family-field">
            <label htmlFor="family-invite-email">招待する人のメールアドレス</label>
            <input
              id="family-invite-email"
              inputMode="email"
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="sister@example.com"
              type="email"
              value={inviteEmail}
            />
          </div>
          <div className="family-field">
            <label htmlFor="family-invite-relationship">その人の呼び方（任意）</label>
            <input
              id="family-invite-relationship"
              maxLength={20}
              onChange={(event) => setInviteRelationship(event.target.value)}
              placeholder="例: 妹"
              type="text"
              value={inviteRelationship}
            />
          </div>
          <button
            className="family-primary"
            disabled={busy || isFull || !inviteEmail.trim()}
            onClick={createInvite}
            type="button"
          >
            {busy ? "作っています…" : "招待リンクを作る"}
          </button>
          {isFull ? (
            <p className="family-note">
              無料の枠が埋まっています。さらに家族を招待する場合は、手帳を作った人の <Link href="/plans">Family Plus</Link> で広げられます。
            </p>
          ) : null}
          {message ? <p className="family-error" role="status">{message}</p> : null}

          {invite ? (
            <div className="family-invite-result" role="status">
              <strong>{invite.invitedEmail} 宛の招待ができました</strong>
              <p>このリンクを本人に送ってください。{invite.expiresInDays}日で切れます。招待したアドレスでログインした人だけが参加できます。</p>
              <code>{invite.url}</code>
              <button onClick={copyInviteUrl} type="button">
                {copied ? "コピーしました" : "リンクをコピーする"}
              </button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
