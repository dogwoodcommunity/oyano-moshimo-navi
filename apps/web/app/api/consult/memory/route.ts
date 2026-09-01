import { NextResponse, type NextRequest } from "next/server";
import {
  CONSULT_MEMORY_MAX_USER_SUMMARY_LENGTH,
  CONSULT_MEMORY_NOT_READY_MESSAGE,
  ConsultMemoryAccessError,
  ConsultMemoryConflictError,
  ConsultMemoryConsentRequiredError,
  ConsultMemoryNotReadyError,
  authorizeConsultPerson,
  canEditSharedConsultMemory,
  canManageSharedConsultMemory,
  isConsultMemorySchemaMissing,
  listConsultMemory,
  normalizeSourceRecord,
  recordConsultMemoryConsent,
  refreshPersonMemory
} from "@/lib/consultMemory";

export const dynamic = "force-dynamic";

function jsonError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

function identifierFromUrl(request: NextRequest) {
  return {
    personId: request.nextUrl.searchParams.get("personId") ?? undefined,
    localCaseId: request.nextUrl.searchParams.get("localCaseId") ?? undefined,
    familyId: request.nextUrl.searchParams.get("familyId") ?? undefined
  };
}

function handleError(error: unknown) {
  if (error instanceof ConsultMemoryAccessError) {
    return jsonError(error.code, error.message, error.status);
  }
  if (error instanceof ConsultMemoryConflictError) {
    return jsonError(error.code, error.message, 409);
  }
  if (error instanceof ConsultMemoryConsentRequiredError) {
    return jsonError(error.code, error.message, error.status);
  }
  if (error instanceof ConsultMemoryNotReadyError || isConsultMemorySchemaMissing(error)) {
    return jsonError("memory_not_ready", CONSULT_MEMORY_NOT_READY_MESSAGE, 503);
  }
  console.error("[consult-memory] request failed", error);
  return jsonError("memory_failed", "この人専用AIの記憶を読み取れませんでした。時間をおいてお試しください。", 500);
}

async function readExcludedSources(
  authorized: Awaited<ReturnType<typeof authorizeConsultPerson>>,
  ids: string[]
) {
  if (ids.length === 0) return [];
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    const { data, error } = await authorized.supabase
      .from("timeline_events")
      .select("id,event_date,mood,body,title,created_at")
      .eq("person_id", authorized.personId)
      .in("id", ids.slice(offset, offset + 500));
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows.flatMap((row) => {
    const record = normalizeSourceRecord(row);
    return record ? [record] : [];
  });
}

async function auditMemoryDeletion(
  authorized: Awaited<ReturnType<typeof authorizeConsultPerson>>,
  scope: string,
  deleted: { memory: boolean; history: boolean },
  memoryResetAt: string | null,
  outcome: "success" | "partial"
) {
  const { error } = await authorized.supabase.from("audit_logs").insert({
    actor_user_id: authorized.userId,
    action: "ai_memory_deleted",
    target_type: "person",
    target_id: authorized.personId,
    metadata: {
      scope,
      outcome,
      shared_memory_deleted: deleted.memory,
      private_history_deleted: deleted.history,
      memory_reset_at: memoryResetAt
    }
  });
  if (error) console.error("[consult-memory] failed to audit deletion", error);
}

export async function GET(request: NextRequest) {
  try {
    const authorized = await authorizeConsultPerson(request, identifierFromUrl(request));
    await recordConsultMemoryConsent(
      authorized,
      request.headers.get("x-oyano-memory-consent-version") ?? "",
      "memory-api"
    );
    const historyOffsetValue = Number(request.nextUrl.searchParams.get("historyOffset") ?? "0");
    const historyOffset = Number.isFinite(historyOffsetValue) && historyOffsetValue >= 0
      ? Math.floor(historyOffsetValue)
      : 0;
    const result = await listConsultMemory(authorized, { historyOffset, historyLimit: 50 });
    const excludedSources = await readExcludedSources(authorized, result.memory.excludedEventIds);
    return NextResponse.json({
      ...result,
      canEditSharedMemory: canEditSharedConsultMemory(authorized),
      canManageSharedMemory: canManageSharedConsultMemory(authorized),
      excludedSources,
      separationNotice: "手帳の記録から作った記憶と、過去のAI提案は分けて表示しています。"
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return jsonError("invalid_request", "変更内容を読み取れませんでした。", 400);
    const authorized = await authorizeConsultPerson(request, {
      personId: typeof body.personId === "string" ? body.personId : undefined,
      localCaseId: typeof body.localCaseId === "string" ? body.localCaseId : undefined,
      familyId: typeof body.familyId === "string" ? body.familyId : undefined
    });
    await recordConsultMemoryConsent(
      authorized,
      request.headers.get("x-oyano-memory-consent-version") ?? "",
      "memory-api"
    );
    const current = await refreshPersonMemory(authorized);
    const hasExplicitMemoryVersion = typeof body.memoryVersion === "number" && Number.isInteger(body.memoryVersion);
    const requestedMemoryVersion = hasExplicitMemoryVersion
      ? body.memoryVersion as number
      : current.memoryState.memoryVersion;
    const excludeEventId = typeof body.excludeEventId === "string" ? body.excludeEventId.trim() : "";
    const includeEventId = typeof body.includeEventId === "string" ? body.includeEventId.trim() : "";
    if (excludeEventId && includeEventId) {
      return jsonError("invalid_request", "記録を外す操作と戻す操作は、一度に1つずつ行ってください。", 400);
    }
    const sourceEventId = excludeEventId
      || includeEventId
      || (typeof body.sourceEventId === "string" ? body.sourceEventId.trim() : "");
    const requestedExcluded = excludeEventId
      ? true
      : includeEventId
        ? false
        : body.excluded;
    if (sourceEventId) {
      if (typeof requestedExcluded !== "boolean") {
        return jsonError("invalid_request", "記録を記憶から外すか戻すかを選んでください。", 400);
      }
      const { data: source, error: sourceError } = await authorized.supabase
        .from("timeline_events")
        .select("id")
        .eq("id", sourceEventId)
        .eq("person_id", authorized.personId)
        .maybeSingle();
      if (sourceError) throw sourceError;
      if (!source) return jsonError("source_not_found", "元の手帳記録が見つかりませんでした。", 404);
    }
    if (body.userSummary !== undefined && typeof body.userSummary !== "string") {
      return jsonError("invalid_request", "確認・訂正した内容を読み取れませんでした。", 400);
    }
    if (typeof body.userSummary === "string" && body.userSummary.length > CONSULT_MEMORY_MAX_USER_SUMMARY_LENGTH) {
      return jsonError(
        "invalid_request",
        `確認・訂正した内容は${CONSULT_MEMORY_MAX_USER_SUMMARY_LENGTH}文字までにしてください。`,
        400
      );
    }
    const hasMemoryChange = Boolean(sourceEventId || body.userSummary !== undefined);
    if (hasMemoryChange && !canEditSharedConsultMemory(authorized)) {
      return jsonError("forbidden", "閲覧専用メンバーは家族共有のAI記憶を変更できません。", 403);
    }
    if (hasMemoryChange && !hasExplicitMemoryVersion) {
      return jsonError("invalid_request", "記憶の版を確認できませんでした。画面を読み直してから、もう一度お試しください。", 400);
    }
    if (hasMemoryChange && requestedMemoryVersion !== current.memoryState.memoryVersion) {
      throw new ConsultMemoryConflictError();
    }
    const markSavedTurnId = typeof body.markSavedTurnId === "string" ? body.markSavedTurnId.trim() : "";
    if (markSavedTurnId && hasMemoryChange) {
      return jsonError("invalid_request", "手帳への保存済み更新と記憶の変更は、一度に1つずつ行ってください。", 400);
    }
    let savedToNotebookAt: string | null = null;
    if (markSavedTurnId) {
      const { data: threads, error: threadError } = await authorized.supabase
        .from("ai_consult_threads")
        .select("id")
        .eq("person_id", authorized.personId)
        .eq("owner_user_id", authorized.userId);
      if (threadError) throw threadError;
      const threadIds = (threads ?? []).map((row) => row.id).filter(Boolean);
      if (threadIds.length === 0) return jsonError("turn_not_found", "保存した相談履歴が見つかりませんでした。", 404);
      savedToNotebookAt = new Date().toISOString();
      const { data: marked, error: markError } = await authorized.supabase
        .from("ai_consult_turns")
        .update({ saved_to_notebook_at: savedToNotebookAt })
        .eq("id", markSavedTurnId)
        .in("thread_id", threadIds)
        .select("id")
        .maybeSingle();
      if (markError) throw markError;
      if (!marked) return jsonError("turn_not_found", "保存した相談履歴が見つかりませんでした。", 404);
    }
    if (!sourceEventId && body.userSummary === undefined && !markSavedTurnId) {
      return jsonError("invalid_request", "変更する内容を指定してください。", 400);
    }
    const updated = hasMemoryChange
      ? await refreshPersonMemory(authorized, {
          expectedMemoryVersion: requestedMemoryVersion,
          ...(requestedExcluded === true ? { excludeEventId: sourceEventId } : {}),
          ...(requestedExcluded === false ? { includeEventId: sourceEventId } : {}),
          ...(typeof body.userSummary === "string" ? { userSummary: body.userSummary } : {})
        })
      : current;
    const excludedSources = await readExcludedSources(authorized, updated.memoryState.excludedEventIds);
    return NextResponse.json({
      personId: authorized.personId,
      memory: updated.memoryState,
      excludedSources,
      ...(markSavedTurnId ? { markedSavedTurnId: markSavedTurnId, savedToNotebookAt } : {})
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const requestedScope = request.nextUrl.searchParams.get("scope");
    if (!(["memory", "history", "all"] as const).includes(requestedScope as "memory" | "history" | "all")) {
      return jsonError("invalid_request", "削除範囲はmemory、history、allから選んでください。", 400);
    }
    const scope = requestedScope as "memory" | "history" | "all";
    const authorized = await authorizeConsultPerson(request, identifierFromUrl(request));
    if ((scope === "memory" || scope === "all") && !canManageSharedConsultMemory(authorized)) {
      return jsonError(
        "forbidden",
        "家族全員で共有する専用AIの記憶は、家族ボードのオーナーまたは管理者だけが削除できます。相談履歴は自分の分だけ削除できます。",
        403
      );
    }
    const deleted = { memory: false, history: false };
    let memoryResetAt: string | null = null;

    if (scope === "memory" || scope === "all") {
      // 生の手帳は消さず、reset境界以前を記憶対象外にする。次のGETでも復活せず、
      // 削除後に新しく追加した記録だけは、再びこの人専用AIが記憶する。
      memoryResetAt = new Date().toISOString();
      const current = await refreshPersonMemory(authorized);
      await refreshPersonMemory(authorized, {
        userSummary: "",
        excludedEventIds: [],
        memoryResetAt,
        expectedMemoryVersion: current.memoryState.memoryVersion
      });
      deleted.memory = true;
    }

    if (scope === "history" || scope === "all") {
      // thread削除の外部キーCASCADEでturnsも同一SQL文内に削除する。
      // allでは先にmemoryを消す。履歴削除が失敗しても再試行でき、履歴だけ先に
      // 失われて記憶が残る不可逆な半端状態を避ける。
      const { error: threadsError } = await authorized.supabase
        .from("ai_consult_threads")
        .delete()
        .eq("person_id", authorized.personId)
        .eq("owner_user_id", authorized.userId);
      if (threadsError) {
        if (isConsultMemorySchemaMissing(threadsError)) throw new ConsultMemoryNotReadyError();
        if (deleted.memory) {
          console.error("[consult-memory] history delete failed after memory reset", threadsError);
          await auditMemoryDeletion(authorized, scope, deleted, memoryResetAt, "partial");
          return NextResponse.json({
            error: "partial_delete",
            message: "AIの記憶は削除しましたが、相談履歴を削除できませんでした。もう一度『相談履歴を削除』を実行してください。",
            retryScope: "history",
            personId: authorized.personId,
            deleted,
            notebookRecordsDeleted: false,
            memoryResetAt
          }, { status: 500 });
        }
        throw threadsError;
      }
      deleted.history = true;
    }

    await auditMemoryDeletion(authorized, scope, deleted, memoryResetAt, "success");

    return NextResponse.json({
      personId: authorized.personId,
      deleted,
      notebookRecordsDeleted: false,
      memoryResetAt,
      message: deleted.memory
        ? "AIの記憶を削除しました。元の手帳記録は削除していません。これから追加する記録は新しく記憶されます。"
        : "この人とのAI相談履歴を削除しました。元の手帳記録とAIの長期記憶は残っています。"
    });
  } catch (error) {
    return handleError(error);
  }
}
