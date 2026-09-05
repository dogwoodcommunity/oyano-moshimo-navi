import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { reconciledDiaryId } from "@/lib/notebookReconciliation";
import { getServerSupabase } from "@/lib/serverSupabase";

type JsonRecord = Record<string, unknown>;
type UnboundDiary = {
  id: string;
  caseId: string;
  date: string;
  mood: "stable" | "changed" | "urgent";
  body: string;
  attachments: [];
  createdAt: string;
  updatedAt?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const editorRoles = new Set(["owner", "admin", "member"]);
const requestFields = new Set(["familyId", "personId", "targetCaseId", "sourceCaseId", "samePersonConfirmed", "diaryEntries"]);
const diaryFields = new Set(["id", "caseId", "date", "mood", "body", "attachments", "createdAt", "updatedAt"]);

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord : null;
}

function errorResponse(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

function localId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && value.trim() === value;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  return Boolean(match && validDate(match[1]) && Number.isFinite(Date.parse(value)));
}

function unboundDiary(value: unknown, sourceCaseId: string): value is UnboundDiary {
  const entry = record(value);
  return Boolean(entry
    && Object.keys(entry).every((key) => diaryFields.has(key))
    && localId(entry.id) && entry.caseId === sourceCaseId
    && validDate(entry.date)
    && (entry.mood === "stable" || entry.mood === "changed" || entry.mood === "urgent")
    && typeof entry.body === "string" && entry.body.trim().length > 0 && entry.body.length <= 10_000
    && Array.isArray(entry.attachments) && entry.attachments.length === 0
    && validIso(entry.createdAt)
    && (!("updatedAt" in entry) || validIso(entry.updatedAt)));
}

function rpcFailure(error: unknown) {
  const source = record(error);
  // Only classify internal errors. Never return provider messages, IDs or SQL details.
  const message = typeof source?.message === "string" ? source.message : "";
  if (/deleted|conflict|request_id_reused|new_diary_has_cloud_identity/i.test(message)) {
    return errorResponse("reconcile_conflict", "削除済みまたは別の更新があるため、記録はまとめていません。クラウドの内容を確認してください。", 409);
  }
  if (/family_access_denied|membership|viewer/i.test(message)) {
    return errorResponse("family_access_denied", "この家族へ記録を追加する権限を確認できませんでした。", 403);
  }
  if (/person_not_found/i.test(message)) {
    return errorResponse("target_changed", "保存先の手帳が変わったため、記録はまとめていません。もう一度確認してください。", 409);
  }
  if (/actor_verification_required/i.test(message)) {
    return errorResponse("email_confirmation_required", "メールの本人確認をやり直してください。記録は追加していません。", 403);
  }
  return errorResponse("reconcile_failed", "クラウドへの追加を確認できませんでした。端末の記録と控えを残したまま、もう一度確認してください。", 500);
}

export async function POST(request: Request) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) return errorResponse("not_configured", "クラウド保存の環境設定がありません。", 501);
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return errorResponse("unauthorized", "ログイン確認が必要です。", 401);
    const { data: authenticated, error: authError } = await supabase.auth.getUser(token);
    const user = authenticated?.user;
    if (authError || !user) return errorResponse("unauthorized", "ログインを確認できませんでした。", 401);
    if (!user.email?.trim() || !user.email_confirmed_at) {
      return errorResponse("email_confirmation_required", "先にこのアカウントのメール確認を完了してください。", 403);
    }

    const body = record(await request.json().catch(() => null));
    if (!body || !Object.keys(body).every((key) => requestFields.has(key)) || body.samePersonConfirmed !== true) {
      return errorResponse("confirmation_required", "端末とクラウドが同じ人の手帳であることを確認してください。", 400);
    }
    const { familyId, personId, targetCaseId, sourceCaseId } = body;
    if (typeof familyId !== "string" || !uuidPattern.test(familyId)
      || typeof personId !== "string" || !uuidPattern.test(personId)
      || !localId(targetCaseId) || !localId(sourceCaseId) || targetCaseId === sourceCaseId) {
      return errorResponse("invalid_identity", "まとめる元の手帳と保存先を確認できませんでした。", 400);
    }
    const entries = body.diaryEntries;
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 100
      || !entries.every((entry): entry is UnboundDiary => unboundDiary(entry, sourceCaseId))
      || new Set(entries.map((entry) => entry.id)).size !== entries.length) {
      return errorResponse("invalid_diary", "端末だけにある文字の記録を1〜100件選んでください。写真付き・保存先確認済み・内容が不正な記録は追加できません。", 400);
    }

    const { data: membership, error: membershipError } = await supabase
      .from("family_members").select("role")
      .eq("family_id", familyId).eq("user_id", user.id).maybeSingle();
    if (membershipError) return errorResponse("membership_check_failed", "家族の編集権限を確認できませんでした。", 503);
    const role = record(membership)?.role;
    if (typeof role !== "string" || !editorRoles.has(role)) {
      return errorResponse("family_access_denied", "この家族へ記録を追加する権限がありません。", 403);
    }
    const { data: person, error: personError } = await supabase
      .from("people").select("id,family_id,profile")
      .eq("id", personId).eq("family_id", familyId).maybeSingle();
    if (personError) return errorResponse("person_check_failed", "保存先の対象者を確認できませんでした。", 503);
    const personRow = record(person);
    if (!personRow || personRow.id !== personId || personRow.family_id !== familyId
      || record(personRow.profile)?.localCaseId !== targetCaseId) {
      return errorResponse("target_changed", "保存先の手帳を確認できませんでした。クラウドの内容を読み直してください。", 409);
    }

    const normalizedEntries = await Promise.all(entries.map(async (entry) => ({
      localCaseId: targetCaseId,
      localDiaryId: await reconciledDiaryId(sourceCaseId, entry.id),
      cloudRevision: null,
      cloudHash: null,
      date: entry.date,
      title: entry.mood === "urgent" ? "急ぎの記録" : entry.mood === "changed" ? "変化の記録" : "日々の記録",
      body: entry.body,
      mood: entry.mood,
      attachments: [],
      metadata: { source: "pwa-notebook" },
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt ?? entry.createdAt
    })));
    if (normalizedEntries.some((entry) => !/^reconciled_[0-9a-f]{64}$/.test(entry.localDiaryId))
      || new Set(normalizedEntries.map((entry) => entry.localDiaryId)).size !== entries.length) {
      return errorResponse("invalid_recovery_identity", "追加する記録を安全に識別できませんでした。", 500);
    }

    // Bind the exact person UUID inside the same transaction that appends.
    // The wrapper preserves v2's locks/CAS/tombstones and always uses cases=[].
    const { data, error } = await supabase.rpc("reconcile_notebook_diaries_v1", {
      p_actor_user_id: user.id,
      p_actor_email: user.email,
      p_family_id: familyId,
      p_person_id: personId,
      p_target_case_id: targetCaseId,
      p_diary_entries: normalizedEntries,
      p_request_id: randomUUID()
    });
    if (error) return rpcFailure(error);
    const result = record(data);
    const revisions = result?.diaryRevisions;
    const expectedIds = new Set(normalizedEntries.map((entry) => entry.localDiaryId));
    if (result?.ok !== true || result.familyId !== familyId || result.personId !== personId || result.targetCaseId !== targetCaseId
      || result.syncedPeople !== 0 || result.syncedTasks !== 0 || result.syncedEntries !== entries.length
      || !Array.isArray(result.caseRevisions) || result.caseRevisions.length !== 0
      || !Array.isArray(result.taskRevisions) || result.taskRevisions.length !== 0
      || !Array.isArray(revisions) || revisions.length !== entries.length
      || !revisions.every((value) => {
        const revision = record(value);
        if (!revision || revision.localCaseId !== targetCaseId
          || typeof revision.localDiaryId !== "string" || !expectedIds.delete(revision.localDiaryId)
          || typeof revision.cloudRevision !== "number" || !Number.isInteger(revision.cloudRevision) || revision.cloudRevision < 1
          || typeof revision.cloudHash !== "string" || !/^[0-9a-f]{64}$/i.test(revision.cloudHash)) return false;
        return true;
      }) || expectedIds.size !== 0) {
      return errorResponse("reconcile_unconfirmed", "追加結果を確認できませんでした。端末の記録と控えはそのまま残し、クラウドの内容を確認してください。", 502);
    }
    return NextResponse.json({ ok: true, familyId, personId, targetCaseId, syncedEntries: entries.length });
  } catch {
    return errorResponse("reconcile_unconfirmed", "通信結果を確認できませんでした。端末の記録と控えはそのまま残してください。", 503);
  }
}
