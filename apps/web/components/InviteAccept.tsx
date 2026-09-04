"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  completeBrowserSupabaseAuthFromUrl,
  getBrowserSupabase,
  sendMagicLink
} from "@/lib/browserSupabase";
import {
  familyInvitePermission,
  parseFamilyInviteRole,
  parseFamilyMemberRole,
  type FamilyMemberRole,
  type FamilyInviteRole
} from "@/lib/familyInvitePermissions";

type Phase =
  | "checking"
  | "unavailable"
  | "invalid-invite"
  | "signed-out"
  | "sending"
  | "sent"
  | "ready"
  | "joining"
  | "joined"
  | "error";

function InvitePermissionNotice({ role }: { role: FamilyInviteRole }) {
  const permission = familyInvitePermission(role);
  return (
    <div className="family-invite-result">
      <strong>この招待の権限：{permission.label}</strong>
      <p>{permission.fullDescription}</p>
    </div>
  );
}

function PersistedRoleNotice({ role }: { role: FamilyMemberRole }) {
  if (role === "viewer" || role === "member") {
    return <InvitePermissionNotice role={role} />;
  }

  return (
    <div className="family-invite-result">
      <strong>現在の権限：{role === "owner" ? "手帳を作った人" : "家族管理者"}</strong>
      <p>{role === "owner"
        ? "すでに持っている手帳を作った人の権限は変わりません。"
        : "すでに持っている家族管理者の権限は変わりません。"}</p>
    </div>
  );
}

export function InviteAccept({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<FamilyInviteRole | null>(null);
  const [joinedRole, setJoinedRole] = useState<FamilyMemberRole | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      let role: FamilyInviteRole | null = null;
      try {
        const previewResponse = await fetch(
          `/api/family/invite/preview?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const preview = await previewResponse.json().catch(() => ({})) as { role?: unknown; message?: string };
        role = parseFamilyInviteRole(preview.role);
        if (!previewResponse.ok || !role) {
          if (cancelled) return;
          setMessage(preview.message ?? "招待の内容を確認できませんでした。時間をおいてお試しください。");
          setPhase(previewResponse.status === 404 ? "invalid-invite" : "unavailable");
          return;
        }
      } catch {
        if (cancelled) return;
        setMessage("通信できませんでした。電波のよい場所で読み直してください。");
        setPhase("unavailable");
        return;
      }

      if (cancelled) return;
      setInviteRole(role);

      const client = getBrowserSupabase();
      if (!client) {
        setMessage("この環境ではクラウドの設定が入っていないため、招待を受け取れません。");
        setPhase("unavailable");
        return;
      }

      await completeBrowserSupabaseAuthFromUrl();
      const { data } = await client.auth.getSession();
      if (cancelled) return;

      const sessionToken = data.session?.access_token ?? null;
      setAccessToken(sessionToken);
      setSignedInEmail(data.session?.user?.email ?? null);
      setPhase(sessionToken ? "ready" : "signed-out");
    }

    void boot();
    return () => { cancelled = true; };
  }, []);

  async function requestSignIn() {
    if (!email.trim()) return;
    setPhase("sending");
    setMessage("");
    const result = await sendMagicLink(email.trim(), `/invite/${encodeURIComponent(token)}`);
    if (result.ok) {
      setPhase("sent");
    } else {
      setPhase("signed-out");
      setMessage(result.error ?? "確認メールを送れませんでした。");
    }
  }

  async function join() {
    if (!accessToken || !inviteRole) return;
    setPhase("joining");
    setMessage("");

    try {
      const response = await fetch("/api/family/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ token })
      });
      const data = await response.json() as { message?: string; role?: unknown };

      if (!response.ok) {
        setMessage(data.message ?? "参加できませんでした。");
        setPhase("error");
        return;
      }

      const persistedRole = parseFamilyMemberRole(data.role);
      if (!persistedRole) {
        setMessage("参加後の権限を確認できませんでした。画面を読み直してください。");
        setPhase("error");
        return;
      }

      setJoinedRole(persistedRole);
      setPhase("joined");
    } catch {
      setMessage("通信できませんでした。電波のよい場所でお試しください。");
      setPhase("error");
    }
  }

  if (phase === "unavailable") {
    return (
      <section className="invite-card">
        <h2>いまは受け取れません</h2>
        <p>{message || "招待の内容を確認できませんでした。時間をおいてお試しください。"}</p>
      </section>
    );
  }

  if (phase === "invalid-invite") {
    return (
      <section className="invite-card">
        <h2>この招待は使えません</h2>
        <p>{message}</p>
      </section>
    );
  }

  if (phase === "checking") {
    return <p className="family-loading">読み込み中です</p>;
  }

  if (phase === "joined") {
    return (
      <section className="invite-card is-done">
        <h2>参加しました</h2>
        {joinedRole ? <PersistedRoleNotice role={joinedRole} /> : null}
        <p>上に表示された権限で同じ手帳を使えるようになりました。追加課金は不要です。手帳を開いて、クラウドの控えを読み込んでください。</p>
        <Link className="family-primary" href="/home?cloud=1">手帳を開く</Link>
      </section>
    );
  }

  if (phase === "signed-out" || phase === "sending" || phase === "sent") {
    return (
      <section className="invite-card">
        <h2>招待されたメールアドレスで確認します</h2>
        {inviteRole ? <InvitePermissionNotice role={inviteRole} /> : null}
        <p>
          招待メールが届いたアドレスを入れてください。確認メールのリンクを開くと、この画面に戻って参加できます。
          パスワードは作りません。追加課金はありません。
        </p>
        <div className="family-field">
          <label htmlFor="invite-email">メールアドレス</label>
          <input
            autoComplete="email"
            id="invite-email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </div>
        <button
          className="family-primary"
          disabled={phase === "sending" || !email.trim()}
          onClick={requestSignIn}
          type="button"
        >
          {phase === "sending" ? "送信しています…" : "確認メールを送る"}
        </button>
        {phase === "sent" ? (
          <p className="family-note" role="status">確認メールを送りました。メール内のリンクを開いてください。</p>
        ) : null}
        {message ? <p className="family-error" role="status">{message}</p> : null}
      </section>
    );
  }

  return (
    <section className="invite-card">
      <h2>この招待を受け取りますか</h2>
      {inviteRole ? <InvitePermissionNotice role={inviteRole} /> : null}
      <p>
        {signedInEmail ? `${signedInEmail} として確認済みです。` : "確認済みです。"}
        参加すると、上に表示された権限でクラウドに保存された同じ手帳を使えるようになります。手帳を作った人の家族プランに参加するだけなので、別の支払いは不要です。
      </p>
      <button className="family-primary" disabled={phase === "joining"} onClick={join} type="button">
        {phase === "joining" ? "参加しています…" : "この手帳に参加する"}
      </button>
      {message ? <p className="family-error" role="status">{message}</p> : null}
      <p className="family-note">
        招待されたアドレスと違う場合は参加できません。その時は、招待した家族に送り直してもらってください。
      </p>
    </section>
  );
}
