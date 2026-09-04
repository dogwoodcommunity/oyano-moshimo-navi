"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  completeBrowserSupabaseAuthFromUrl,
  getBrowserSupabase,
  sendMagicLink
} from "@/lib/browserSupabase";
import { trackFunnel } from "@/lib/funnel";
import {
  familyInvitePermission,
  type FamilyInviteRole
} from "@/lib/familyInvitePermissions";
import { markMonitorActivity } from "@/lib/monitorSession";
import { clearNotebookCloudBinding, readNotebookCloudBinding } from "@/lib/store";

type FamilySummary = {
  familyId: string;
  plan: "free" | "plus";
  isOwner: boolean;
  currentUserRole: string;
  canManage: boolean;
  canLeave: boolean;
  leaveBlockedReason: "owner_transfer_required" | "notebook_photos" | null;
  limit: number | null;
  remaining: number | null;
  members: Array<{
    memberId: string;
    isYou: boolean;
    isOwner: boolean;
    canRemove: boolean;
    removeBlockedReason: "notebook_photos" | null;
    role: string;
    relationship: string | null;
    joinedAt: string | null;
  }>;
  pendingInvites: Array<{
    inviteId: string;
    invitedEmail: string | null;
    relationship: string | null;
    role: string;
    createdAt: string | null;
  }>;
};

type CreatedInvite = {
  invitedEmail: string;
  relationship: string | null;
  role: FamilyInviteRole;
  url: string;
  expiresInDays: number;
};

type AuthState = "checking" | "signed-out" | "sending" | "sent" | "signed-in" | "unavailable";
type FamilyManagementAction = "transfer-ownership" | "remove-member" | "leave-family" | "cancel-invite";

export function FamilyShare() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [signInEmail, setSignInEmail] = useState("");
  const [summary, setSummary] = useState<FamilySummary | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRelationship, setInviteRelationship] = useState("");
  const [inviteRole, setInviteRole] = useState<FamilyInviteRole | "">("");
  const [invite, setInvite] = useState<CreatedInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [managementBusy, setManagementBusy] = useState<string | null>(null);
  const [managementMessage, setManagementMessage] = useState("");
  const [leftFamily, setLeftFamily] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const loadSummary = useCallback(async (token: string, familyId?: string | null) => {
    const params = new URLSearchParams();
    if (familyId) params.set("familyId", familyId);
    const endpoint = params.size > 0 ? `/api/family?${params.toString()}` : "/api/family";
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { message?: string };
      setMessage(data.message ?? "家族の情報を読み込めませんでした。");
      return;
    }
    setSummary(await response.json() as FamilySummary);
  }, []);

  useEffect(() => {
    let cancelled = false;
    markMonitorActivity("familyInviteOpened");

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
      if (token) {
        const binding = readNotebookCloudBinding();
        const familyId = binding && binding.authUserId === data.session?.user.id ? binding.familyId : null;
        await loadSummary(token, familyId);
      }
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
        body: JSON.stringify({
          email: inviteEmail.trim(),
          relationship: inviteRelationship.trim(),
          role: inviteRole,
          familyId: summary?.familyId
        })
      });
      const data = await response.json() as CreatedInvite & { message?: string };

      if (!response.ok) {
        setMessage(data.message ?? "招待を作れませんでした。");
        return;
      }

      setInvite(data);
      trackFunnel("family_invite_created");
      setInviteEmail("");
      setInviteRelationship("");
      setInviteRole("");
      await loadSummary(accessToken, summary?.familyId);
    } catch {
      setMessage("通信できませんでした。電波のよい場所でお試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteUrl() {
    if (!invite) return;
    try {
      const permission = familyInvitePermission(invite.role);
      await navigator.clipboard.writeText(
        `親のもしもナビの家族招待です。\n権限：${permission.label}\n${permission.shortDescription}\n招待リンク：${invite.url}`
      );
      setCopied(true);
    } catch {
      setCopied(false);
      setMessage("自動コピーができませんでした。リンクを長押しして選択してください。");
    }
  }

  async function shareInviteUrl() {
    if (!invite) return;
    setMessage("");
    if (typeof navigator.share !== "function") {
      await copyInviteUrl();
      return;
    }
    try {
      const permission = familyInvitePermission(invite.role);
      await navigator.share({
        title: "親のもしもナビの家族招待",
        text: `同じ手帳への招待です。\n権限：${permission.label}\n${permission.shortDescription}`,
        url: invite.url
      });
      trackFunnel("family_invite_shared");
      setMessage("共有画面を開きました。相手へ送信できたか確認してください。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("共有画面を開けませんでした。リンクをコピーして送ってください。");
    }
  }

  async function manageFamily(
    action: FamilyManagementAction,
    options: { memberId?: string; inviteId?: string; successMessage: string }
  ) {
    if (!accessToken || !summary) return;
    const operationKey = `${action}:${options.memberId ?? options.inviteId ?? summary.familyId}`;
    setManagementBusy(operationKey);
    setManagementMessage("");

    try {
      const response = await fetch("/api/family/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          action,
          familyId: summary.familyId,
          ...(options.memberId ? { memberId: options.memberId } : {}),
          ...(options.inviteId ? { inviteId: options.inviteId } : {})
        })
      });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) {
        setManagementMessage(data.message ?? "家族の操作を完了できませんでした。");
        return;
      }

      if (action === "leave-family") {
        clearNotebookCloudBinding();
        setSummary(null);
        setLeftFamily(true);
        setManagementMessage(options.successMessage);
        return;
      }

      await loadSummary(accessToken, summary.familyId);
      setManagementMessage(options.successMessage);
    } catch {
      setManagementMessage("通信できませんでした。電波のよい場所でお試しください。");
    } finally {
      setManagementBusy(null);
    }
  }

  function transferOwnership(member: FamilySummary["members"][number]) {
    const name = member.relationship || "この家族";
    if (!window.confirm(`${name}へ手帳の所有権を移しますか？\n移した後、あなたは管理者になります。`)) return;
    void manageFamily("transfer-ownership", {
      memberId: member.memberId,
      successMessage: `${name}へ手帳の所有権を移しました。`
    });
  }

  function removeMember(member: FamilySummary["members"][number]) {
    const name = member.relationship || "この家族";
    if (!window.confirm(`${name}をこの家族手帳から外しますか？\nもう一度参加するには、新しい招待が必要です。`)) return;
    void manageFamily("remove-member", {
      memberId: member.memberId,
      successMessage: `${name}を家族手帳から外しました。`
    });
  }

  function cancelInvite(pending: FamilySummary["pendingInvites"][number]) {
    const name = pending.relationship || pending.invitedEmail || "この招待";
    if (!window.confirm(`${name}への招待を取り消しますか？\n取り消したリンクでは参加できなくなります。`)) return;
    void manageFamily("cancel-invite", {
      inviteId: pending.inviteId,
      successMessage: `${name}への招待を取り消しました。`
    });
  }

  function leaveCurrentFamily() {
    if (!window.confirm("この家族手帳から抜けますか？\nこの手帳のクラウド記録は見られなくなります。")) return;
    void manageFamily("leave-family", { successMessage: "家族手帳から抜けました。" });
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

  if (leftFamily) {
    return (
      <section className="family-card">
        <h2>家族手帳から抜けました</h2>
        <p>{managementMessage}この端末の家族手帳の選択も解除しました。</p>
        <Link className="family-primary" href="/home?cloud=1">手帳の選択画面へ戻る</Link>
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
              {summary.members.map((member) => (
                <li key={member.memberId}>
                  <div className="family-member-label">
                    <strong>
                      {member.isYou ? "あなた" : member.relationship || "家族"}
                      {member.isOwner ? "（所有者）" : ""}
                    </strong>
                    <small>参加済み・{member.role === "admin" ? "管理者" : member.role === "viewer" ? "閲覧のみ" : member.role === "owner" ? "所有者" : "メンバー"}</small>
                  </div>
                  {!member.isYou && (
                    summary.isOwner || member.canRemove || (summary.canManage && member.removeBlockedReason)
                  ) ? (
                    <div className="family-member-actions">
                      {summary.isOwner ? (
                        <button
                          disabled={managementBusy !== null}
                          onClick={() => transferOwnership(member)}
                          type="button"
                        >
                          所有権を移す
                        </button>
                      ) : null}
                      {member.canRemove ? (
                        <button
                          className="is-danger"
                          disabled={managementBusy !== null}
                          onClick={() => removeMember(member)}
                          type="button"
                        >
                          家族から外す
                        </button>
                      ) : null}
                      {summary.canManage && member.removeBlockedReason === "notebook_photos" ? (
                        <small>
                          「過去の記録」で「写真」を選び、この人の写真が付いた記録を削除すると外せます。{" "}
                          <Link href="/home?cloud=1#diary-history">過去の記録を開く</Link>
                        </small>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
              {summary.pendingInvites.map((pending) => (
                <li className="is-pending" key={pending.inviteId}>
                  <div className="family-member-label">
                    <strong>{pending.relationship || pending.invitedEmail || "招待中の家族"}</strong>
                    <small>
                      招待中・{pending.role === "viewer"
                        ? "見るだけ"
                        : pending.role === "member"
                          ? "記録・確認リスト・写真を編集"
                          : "管理者"}（7日で切れます）
                    </small>
                  </div>
                  {summary.canManage ? (
                    <div className="family-member-actions">
                      <button
                        className="is-danger"
                        disabled={managementBusy !== null}
                        onClick={() => cancelInvite(pending)}
                        type="button"
                      >
                        招待を取り消す
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {summary.canLeave ? (
              <button
                className="family-leave-button"
                disabled={managementBusy !== null}
                onClick={leaveCurrentFamily}
                type="button"
              >
                この家族手帳から抜ける
              </button>
            ) : null}
            {!summary.isOwner && summary.leaveBlockedReason === "notebook_photos" ? (
              <p className="family-note">
                あなたが追加した写真が手帳に残っています。「過去の記録」で「写真」を選び、
                写真が付いた記録を削除すると、この家族手帳から抜けられます。{" "}
                <Link href="/home?cloud=1#diary-history">過去の記録を開く</Link>
              </p>
            ) : null}
            {managementMessage ? <p className="family-note" role="status">{managementMessage}</p> : null}
          </>
        ) : (
          <p className="family-note">読み込み中です</p>
        )}
      </section>

      {isSharedMember ? (
        <section className="family-card">
          <h2>共有された手帳に参加中です</h2>
          <p>
            この手帳のプランは、手帳を作った家族が管理しています。
            {summary?.currentUserRole === "viewer"
              ? "あなたの権限は「見るだけ」です。親の基本情報、日々の記録、確認リスト、写真を見られますが、追加・変更・削除やAI相談はできません。"
              : summary?.currentUserRole === "admin"
                ? "あなたの権限は「管理者」です。手帳の内容を更新し、家族の招待や管理もできます。"
                : "あなたの権限は「記録・確認リスト・写真を編集」です。親の基本情報、日々の記録、確認リスト、写真を見られます。日々の記録、確認リスト、写真は一緒に追加・変更・削除できます。親の基本情報と家族管理は変更できません。"}
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
          <div className="family-invite-result" aria-labelledby="family-invite-role-title">
            <strong id="family-invite-role-title">この人の権限を選ぶ（必須）</strong>
            <p>招待したあとに変える場合は、一度招待を取り消して作り直します。</p>
            {(["viewer", "member"] as const).map((role) => {
              const permission = familyInvitePermission(role);
              const selected = inviteRole === role;
              return (
                <button
                  aria-pressed={selected}
                  className={selected ? "family-share-send" : undefined}
                  key={role}
                  onClick={() => setInviteRole(role)}
                  type="button"
                >
                  {selected ? "選択中：" : "選ぶ："}{permission.label}<br />
                  <small>{permission.shortDescription}</small>
                </button>
              );
            })}
          </div>
          <button
            className="family-primary"
            disabled={busy || !summary || isFull || !inviteEmail.trim() || !inviteRole}
            onClick={createInvite}
            type="button"
          >
            {busy ? "作っています…" : "招待リンクを作る"}
          </button>
          {isFull ? (
            <p className="family-note">
              無料で一緒に見られる人数の上限です。参加中・招待中の家族を確認してから、必要な人へ送り直してください。
            </p>
          ) : null}
          {message ? <p className="family-error" role="status">{message}</p> : null}

          {invite ? (
            <div className="family-invite-result" role="status">
              <strong>招待リンクを作りました。まだ相手には届いていません。</strong>
              <p>
                権限は「{familyInvitePermission(invite.role).label}」です。
                {familyInvitePermission(invite.role).fullDescription}
              </p>
              <p>{invite.invitedEmail} の方へ、下のボタンから送ってください。リンクは{invite.expiresInDays}日で切れ、招待したアドレスでログインした人だけが参加できます。</p>
              <code>{invite.url}</code>
              <button className="family-share-send" onClick={() => void shareInviteUrl()} type="button">
                LINEやメールで送る
              </button>
              <button className="family-share-copy" onClick={copyInviteUrl} type="button">
                {copied ? "コピーしました" : "案内文とリンクをコピーする"}
              </button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
