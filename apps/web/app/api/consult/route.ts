import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasNotebookSubstance,
  normalizeConsultAnswer,
  CONSULT_DISCLAIMER,
  CONSULT_MAX_HISTORY,
  CONSULT_MAX_QUESTION_LENGTH,
  type ConsultRequest
} from "@oyano/shared";
import { buildConsultPrompt, CONSULT_SYSTEM_PROMPT, CONSULT_TOOL } from "@/lib/consult";
import {
  CONSULT_INPUT_USD_PER_MILLION_TOKENS,
  CONSULT_MAX_OUTPUT_TOKENS,
  CONSULT_OUTPUT_USD_PER_MILLION_TOKENS,
  CONSULT_PER_CLIENT_DAILY_LIMIT,
  CONSULT_PER_FAMILY_MONTHLY_LIMIT,
  CONSULT_SERVICE_DAILY_LIMIT,
  currentJstDayStart,
  currentJstMonthStart,
  wasUsedOnCurrentJstDay
} from "@/lib/consultLimits";
import { checkPublicRateLimit, checkServiceRateLimit } from "@/lib/publicRateLimit";
import { getServerSupabase } from "@/lib/serverSupabase";
import {
  CONSULT_MEMORY_NOT_READY_MESSAGE,
  ConsultMemoryAccessError,
  ConsultMemoryConflictError,
  ConsultMemoryConsentRequiredError,
  ConsultMemoryNotReadyError,
  assertConsultMemorySnapshot,
  authorizeConsultPerson,
  isConsultMemorySchemaMissing,
  loadDurableConsultContext,
  persistConsultTurn,
  recordConsultMemoryConsent,
  type AuthorizedConsultPerson,
  type DurableConsultContext
} from "@/lib/consultMemory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const ONE_DAY_SECONDS = 86_400;
// Cookie名は既存端末の利用日時を移行するため旧名を維持する。
const DEVICE_DAILY_FREE_COOKIE = "oyano_consult_trial_used_v01";

type ConsultAccessState = {
  userId?: string;
  familyId?: string;
  plan: "free" | "plus";
  dailyFreeUsedAt: string | null;
  dailyFreeAvailable: boolean;
  canConsult: boolean;
  mode: "plus" | "daily-free" | "device-daily-free" | "daily-locked";
  dailyFreeFamilyId?: string;
};

type ConsultAccessResult = ConsultAccessState | { response: NextResponse };

async function recordConsultUsage(params: {
  access: ConsultAccessState;
  inputTokens: number;
  outputTokens: number;
  fastMode: boolean;
  historyTurns: number;
  outcome: "success" | "refusal" | "invalid_response";
}) {
  const speedMultiplier = params.fastMode ? 2 : 1;
  const estimatedCostUsd = speedMultiplier * (
    params.inputTokens * CONSULT_INPUT_USD_PER_MILLION_TOKENS
    + params.outputTokens * CONSULT_OUTPUT_USD_PER_MILLION_TOKENS
  ) / 1_000_000;
  const metadata = {
    model: MODEL,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    max_output_tokens: CONSULT_MAX_OUTPUT_TOKENS,
    history_turns: params.historyTurns,
    fast_mode: params.fastMode,
    estimated_cost_usd: Number(estimatedCostUsd.toFixed(6)),
    plan: params.access.plan,
    mode: params.access.mode,
    outcome: params.outcome
  };

  console.info("[consult] usage", metadata);

  const supabase = getServerSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: params.access.userId ?? null,
    action: "ai_consult_usage",
    target_type: params.access.familyId ? "family" : "device_trial",
    target_id: params.access.familyId ?? null,
    metadata
  });
  if (error) {
    // 原価ログの失敗で、利用者への回答まで失敗させない。
    console.error("[consult] failed to record usage", error);
  }
}

async function readMonthlySuccessfulConsultCount(access: ConsultAccessState) {
  if (access.plan !== "plus" || !access.familyId) return { count: 0 };

  const supabase = getServerSupabase();
  if (!supabase) return { error: "not_configured" as const };

  const { data, error } = await supabase
    .from("audit_logs")
    .select("metadata")
    .eq("action", "ai_consult_usage")
    .eq("target_type", "family")
    .eq("target_id", access.familyId)
    .gte("created_at", currentJstMonthStart());

  if (error) {
    console.error("[consult] failed to read monthly usage", error);
    return { error: "query_failed" as const };
  }

  const count = (data ?? []).filter((row) => {
    const metadata = row.metadata && typeof row.metadata === "object"
      ? row.metadata as Record<string, unknown>
      : {};
    return metadata.outcome === undefined || metadata.outcome === "success";
  }).length;

  return { count };
}

/**
 * 時間を食っているのは推論ではなく出力の生成（日本語で約1,800文字）。
 * effortを下げても29秒台のままだったため、出力速度そのものを上げる設定を用意する。
 *
 * 同じモデル・同じ品質のまま最大2.5倍速になる代わりに、料金が2倍になる。
 * 料金が変わるので既定では使わない。CONSULT_FAST_MODE=1 で有効になる。
 */
const FAST_MODE = process.env.CONSULT_FAST_MODE === "1";

function badRequest(message: string) {
  return NextResponse.json({ error: "invalid_request", message }, { status: 400 });
}

function jsonError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

function isAccessError(result: ConsultAccessResult): result is { response: NextResponse } {
  return "response" in result;
}

function readDeviceDailyFreeAccess(request: NextRequest, userId?: string): ConsultAccessState {
  const dailyFreeUsedAt = request.cookies.get(DEVICE_DAILY_FREE_COOKIE)?.value ?? null;
  const dailyFreeAvailable = !wasUsedOnCurrentJstDay(dailyFreeUsedAt);
  return {
    userId,
    plan: "free",
    dailyFreeUsedAt,
    dailyFreeAvailable,
    canConsult: dailyFreeAvailable,
    mode: dailyFreeAvailable ? "device-daily-free" : "daily-locked"
  };
}

async function readConsultAccess(request: NextRequest, requiredFamilyId?: string): Promise<ConsultAccessResult> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    if (requiredFamilyId) {
      return { response: jsonError("login_required", "この人専用AIを使うには、家族ボードでメール確認をしてください。", 401) };
    }
    return readDeviceDailyFreeAccess(request);
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    if (requiredFamilyId) {
      return { response: jsonError("memory_not_ready", CONSULT_MEMORY_NOT_READY_MESSAGE, 503) };
    }
    // クラウドの利用状況を確認できない時も、端末の1日1回相談まで止めない。
    return readDeviceDailyFreeAccess(request);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) {
    return {
      response: jsonError(
        "login_required",
        "ログインが確認できませんでした。家族ボードでメール確認をやり直してください。",
        401
      )
    };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id);

  if (membershipError) {
    if (requiredFamilyId) {
      console.error("[consult] failed to verify required family membership", membershipError);
      return { response: jsonError("consult_unavailable", "家族の利用状況を確認できませんでした。時間をおいてお試しください。", 503) };
    }
    // 家族プランの確認障害でも、端末側の1日1回判定へ安全に戻す。
    console.error("[consult] failed to read family memberships", membershipError);
    return readDeviceDailyFreeAccess(request, user.id);
  }

  let familyIds = (memberships ?? [])
    .map((membership) => typeof membership.family_id === "string" ? membership.family_id : "")
    .filter(Boolean);

  if (requiredFamilyId) {
    if (!familyIds.includes(requiredFamilyId)) {
      return { response: jsonError("forbidden", "この手帳を見る家族権限がありません。", 403) };
    }
    // 別家族のPlus契約や無料枠を、この対象者の相談へ流用しない。
    familyIds = [requiredFamilyId];
  }

  if (familyIds.length === 0) {
    return readDeviceDailyFreeAccess(request, user.id);
  }

  const { data: families, error: familyError } = await supabase
    .from("families")
    .select("id, plan")
    .in("id", familyIds);

  if (familyError) {
    if (requiredFamilyId) {
      console.error("[consult] failed to read required family plan", familyError);
      return { response: jsonError("consult_unavailable", "この手帳の利用状況を確認できませんでした。", 503) };
    }
    console.error("[consult] failed to read family plans", familyError);
    return readDeviceDailyFreeAccess(request, user.id);
  }

  const baseFamilyRows = (families ?? [])
    .map((family) => ({
      id: typeof family.id === "string" ? family.id : "",
      plan: family.plan === "plus" ? "plus" as const : "free" as const
    }))
    .filter((family) => family.id);
  const plusFamilyWithoutTrial = baseFamilyRows.find((family) => family.plan === "plus");

  const { data: trialRows, error: trialError } = await supabase
    .from("families")
    .select("id, consult_trial_used_at")
    .in("id", familyIds);

  if (trialError) {
    // 古いDBで利用日時列が未適用でも、Plus判定と端末の1日1回相談は使える。
    console.error("[consult] failed to read family trial status", trialError);
    if (plusFamilyWithoutTrial) {
      return {
        userId: user.id,
        familyId: plusFamilyWithoutTrial.id,
        plan: "plus",
        dailyFreeUsedAt: null,
        dailyFreeAvailable: false,
        canConsult: true,
        mode: "plus"
      };
    }
    if (requiredFamilyId) {
      return { response: jsonError("consult_unavailable", "今日の相談回数を確認できませんでした。時間をおいてお試しください。", 503) };
    }
    return readDeviceDailyFreeAccess(request, user.id);
  }

  const dailyFreeUsedAtByFamily = new Map((trialRows ?? []).map((family) => [
    typeof family.id === "string" ? family.id : "",
    typeof family.consult_trial_used_at === "string" ? family.consult_trial_used_at : null
  ]));
  const familyRows = baseFamilyRows.map((family) => ({
    ...family,
    dailyFreeUsedAt: dailyFreeUsedAtByFamily.get(family.id) ?? null
  }));
  const plusFamily = familyRows.find((family) => family.plan === "plus");
  const deviceDailyFreeUsedAt = request.cookies.get(DEVICE_DAILY_FREE_COOKIE)?.value ?? null;
  const deviceUsedToday = wasUsedOnCurrentJstDay(deviceDailyFreeUsedAt);
  const dailyFreeFamily = deviceUsedToday
    ? undefined
    : familyRows.find((family) => !wasUsedOnCurrentJstDay(family.dailyFreeUsedAt));
  const primaryFamily = plusFamily ?? dailyFreeFamily ?? familyRows[0];

  if (!primaryFamily) {
    if (requiredFamilyId) {
      return { response: jsonError("consult_unavailable", "この手帳の利用状況を確認できませんでした。", 503) };
    }
    return readDeviceDailyFreeAccess(request, user.id);
  }

  if (plusFamily) {
    return {
      userId: user.id,
      familyId: plusFamily.id,
      plan: "plus",
      dailyFreeUsedAt: plusFamily.dailyFreeUsedAt,
      dailyFreeAvailable: false,
      canConsult: true,
      mode: "plus"
    };
  }

  const dailyFreeAvailable = Boolean(dailyFreeFamily);
  return {
    userId: user.id,
    familyId: primaryFamily.id,
    plan: "free",
    dailyFreeUsedAt: deviceUsedToday ? deviceDailyFreeUsedAt : primaryFamily.dailyFreeUsedAt,
    dailyFreeAvailable,
    canConsult: dailyFreeAvailable,
    mode: dailyFreeAvailable ? "daily-free" : "daily-locked",
    dailyFreeFamilyId: dailyFreeFamily?.id
  };
}

async function authorizeConsult(request: NextRequest, requiredFamilyId?: string): Promise<ConsultAccessResult> {
  const access = await readConsultAccess(request, requiredFamilyId);
  if (isAccessError(access)) return access;

  if (!access.canConsult) {
    return {
      response: jsonError(
        "daily_free_limit",
        "今日の無料AI相談は利用済みです。明日また1回使えます。今すぐ続けたい場合はFamily Plusで使えます。手帳と記録はこのまま無料です。",
        429
      )
    };
  }

  return access;
}

export async function GET(request: NextRequest) {
  const access = await readConsultAccess(request);
  if (isAccessError(access)) return access.response;

  return NextResponse.json({
    signedIn: Boolean(access.userId),
    plan: access.plan,
    dailyFreeAvailable: access.dailyFreeAvailable,
    dailyFreeUsedAt: access.dailyFreeUsedAt,
    canConsult: access.canConsult,
    // 旧アプリとの互換用。意味は「本日の無料枠」に変更済み。
    trialAvailable: access.dailyFreeAvailable,
    trialUsedAt: access.dailyFreeUsedAt
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "consult_unavailable",
        message: "いまは相談を受け付けられません。手帳への記録はこれまで通り使えます。"
      },
      { status: 503 }
    );
  }

  let payload: ConsultRequest;
  try {
    payload = await request.json() as ConsultRequest;
  } catch {
    return badRequest("リクエストを読み取れませんでした。");
  }

  const question = typeof payload?.question === "string" ? payload.question.trim() : "";
  const durableRequested = Boolean(
    typeof payload?.personId === "string" && payload.personId.trim()
    || typeof payload?.localCaseId === "string" && payload.localCaseId.trim()
  );
  if (question.length < 4) {
    return badRequest("相談したいことを、もう少しだけ書いてください。");
  }
  if (question.length > CONSULT_MAX_QUESTION_LENGTH) {
    return badRequest(`相談内容は${CONSULT_MAX_QUESTION_LENGTH}文字までにしてください。`);
  }
  // historyは自由入力の塊なので、形が崩れたまま通すと組み立て時に落ちたり、
  // 巨大な配列でプロンプト（＝API費用）が膨らむ。枠を消費する前にここで弾く。
  if (!durableRequested && payload.history !== undefined) {
    const validHistory = Array.isArray(payload.history)
      && payload.history.every((turn) => Boolean(turn) && typeof turn === "object" && typeof (turn as { question?: unknown }).question === "string");
    if (!validHistory) {
      return badRequest("相談の続きの情報を読み取れませんでした。");
    }
  }

  let durableAuthorization: AuthorizedConsultPerson | null = null;
  let durableContext: DurableConsultContext | null = null;
  if (durableRequested) {
    try {
      durableAuthorization = await authorizeConsultPerson(request, {
        personId: payload.personId,
        localCaseId: payload.localCaseId,
        familyId: payload.familyId
      });
      await recordConsultMemoryConsent(
        durableAuthorization,
        payload.memoryConsentVersion ?? "",
        "consult-api"
      );
      durableContext = await loadDurableConsultContext(durableAuthorization, question);
    } catch (error) {
      if (error instanceof ConsultMemoryAccessError) {
        return jsonError(error.code, error.message, error.status);
      }
      if (error instanceof ConsultMemoryConsentRequiredError) {
        return jsonError(error.code, error.message, error.status);
      }
      if (error instanceof ConsultMemoryNotReadyError || isConsultMemorySchemaMissing(error)) {
        return jsonError("memory_not_ready", CONSULT_MEMORY_NOT_READY_MESSAGE, 503);
      }
      console.error("[consult] failed to load durable memory", error);
      return jsonError("memory_failed", "この人専用AIの記憶を読み取れませんでした。時間をおいてお試しください。", 503);
    }
  }

  const authorized = await authorizeConsult(request, durableAuthorization?.familyId);
  if (isAccessError(authorized)) return authorized.response;

  const effectivePayload: ConsultRequest = durableContext
    ? {
        question,
        personId: durableContext.personId,
        person: durableContext.person,
        // プロフィール、記録、確認リスト、過去相談はすべてクラウド正本から取得する。
        tasks: durableContext.tasks,
        memory: durableContext.memory,
        entries: durableContext.memory.latestRecords?.map((record) => ({
          date: record.date,
          mood: record.mood,
          body: record.body
        }))
      }
    : {
        ...payload,
        question,
        // 長期記憶はサーバーだけが組み立てる。legacy requestに偽のmemoryを
        // 混ぜても「手帳の事実」として扱わない。
        memory: undefined,
        personId: undefined,
        localCaseId: undefined,
        memoryConsentVersion: undefined
      };

  if (!hasNotebookSubstance(effectivePayload)) {
    return NextResponse.json(
      {
        error: "notebook_required",
        message: "先に手帳へ記録を1件書くか、プロフィールを2つ以上埋めてください。記録がないと、一般論しか返せません。"
      },
      { status: 422 }
    );
  }

  const monthlyUsage = await readMonthlySuccessfulConsultCount(authorized);
  if ("error" in monthlyUsage) {
    return jsonError(
      "consult_unavailable",
      "今月の相談回数を確認できませんでした。時間をおいてお試しください。",
      503
    );
  }
  if (monthlyUsage.count >= CONSULT_PER_FAMILY_MONTHLY_LIMIT) {
    return jsonError(
      "consult_monthly_limit",
      `今月のAI相談は${CONSULT_PER_FAMILY_MONTHLY_LIMIT}回まで使いました。来月1日に再開します。手帳と記録はそのまま使えます。`,
      429
    );
  }

  // ここまでの検証を通ったものだけが枠を消費する。
  // 入力の不備で弾かれたリクエストで1日の枠を使い切ると、一度も相談できないまま終わる。
  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "consult",
    limit: CONSULT_PER_CLIENT_DAILY_LIMIT,
    windowSeconds: ONE_DAY_SECONDS
  });
  if (limited) return limited;

  const service = await checkServiceRateLimit({
    keyPrefix: "consult",
    limit: CONSULT_SERVICE_DAILY_LIMIT,
    windowSeconds: ONE_DAY_SECONDS
  });
  if (!service.allowed) {
    return NextResponse.json(
      {
        error: "consult_capacity_reached",
        message: "今日の相談の受付上限に達しました。明日また試してください。手帳への記録はこれまで通り使えます。"
      },
      { status: 503, headers: { "Retry-After": String(Math.max(1, service.retryAfter)) } }
    );
  }

  // 記憶を読んだ後に家族から外れた／別端末で同意を取り消した／
  // 記憶を訂正・除外・削除した場合も、外部AIへ送る直前に止める。
  if (durableAuthorization && durableContext) {
    try {
      durableAuthorization = await authorizeConsultPerson(request, { personId: durableContext.personId });
      await recordConsultMemoryConsent(
        durableAuthorization,
        payload.memoryConsentVersion ?? "",
        "consult-api"
      );
      await assertConsultMemorySnapshot(durableAuthorization, {
        memoryVersion: durableContext.memoryState.memoryVersion,
        memoryResetAt: durableContext.memoryState.memoryResetAt
      });
    } catch (error) {
      if (error instanceof ConsultMemoryAccessError) {
        return jsonError(error.code, error.message, error.status);
      }
      if (error instanceof ConsultMemoryConsentRequiredError) {
        return jsonError(error.code, error.message, error.status);
      }
      if (error instanceof ConsultMemoryConflictError) {
        return jsonError(
          error.code,
          "相談を送る前にAIの記憶が変更または削除されました。最新の状態を読み直して、もう一度お試しください。",
          409
        );
      }
      console.error("[consult] failed to recheck durable access", error);
      return jsonError("consent_failed", "長期記憶の同意状態を確認できませんでした。時間をおいてお試しください。", 503);
    }
  }

  const client = new Anthropic({ apiKey, timeout: 55_000, maxRetries: 1 });

  try {
    const params = {
      model: MODEL,
      max_tokens: CONSULT_MAX_OUTPUT_TOKENS,
      // 本番で29〜49秒かかり、48秒台では空で返った。60秒の実行上限に近すぎる。
      // 出力の形はシステムプロンプトとstrict schemaで固定してあるので、
      // 推論の深さを下げても崩れにくいと判断してlowにする。
      // 実測では low でも medium と質は変わらず、時間も変わらなかった。
      output_config: { effort: "low" as const },
      system: CONSULT_SYSTEM_PROMPT,
      tools: [CONSULT_TOOL],
      messages: [{ role: "user" as const, content: buildConsultPrompt(effectivePayload) }]
    };

    // 高速版が使えない環境では黙って通常版へ落とす。速さのために機能ごと止めない。
    let usedFastMode = false;
    const response = FAST_MODE
      ? await client.beta.messages.create({
          ...params,
          betas: ["fast-mode-2026-02-01"],
          speed: "fast"
        }).then((message) => {
          usedFastMode = true;
          return message;
        }).catch((error: unknown) => {
          // 使えない場合（BadRequest）だけでなく、高速枠が混んでいる場合（RateLimit）も落とす。
          // 高速枠は通常枠と別に数えられるため、ここで諦めると通常なら通る相談まで失敗する。
          if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.RateLimitError) {
            console.warn("[consult] fast mode unavailable or busy, falling back to standard speed");
            return client.messages.create(params);
          }
          throw error;
        })
      : await client.messages.create(params);

    if (response.stop_reason === "refusal") {
      await recordConsultUsage({
        access: authorized,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        fastMode: usedFastMode,
        historyTurns: durableContext?.historyTurns
          ?? (Array.isArray(payload.history) ? Math.min(payload.history.length, CONSULT_MAX_HISTORY) : 0),
        outcome: "refusal"
      });
      return NextResponse.json(
        {
          error: "consult_declined",
          message: "この内容には答えられませんでした。医療や法律の判断が必要な場合は、主治医や専門家へ直接ご相談ください。"
        },
        { status: 422 }
      );
    }

    const toolUse = response.content.find(
      (block): block is Extract<typeof block, { type: "tool_use" }> =>
        block.type === "tool_use" && block.name === CONSULT_TOOL.name
    );
    const answer = normalizeConsultAnswer(toolUse?.input);

    if (!answer) {
      await recordConsultUsage({
        access: authorized,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        fastMode: usedFastMode,
        historyTurns: durableContext?.historyTurns
          ?? (Array.isArray(payload.history) ? Math.min(payload.history.length, CONSULT_MAX_HISTORY) : 0),
        outcome: "invalid_response"
      });
      return NextResponse.json(
        {
          error: "consult_failed",
          message: "うまく整理できませんでした。相談内容を少し変えて、もう一度試してください。"
        },
        { status: 502 }
      );
    }

    let persistedTurn: { id: string; createdAt: string | null } | null = null;
    if (durableAuthorization && durableContext) {
      try {
        // AI処理中に権限・同意が変わった場合、回答や相談文を永続化しない。
        durableAuthorization = await authorizeConsultPerson(request, { personId: durableContext.personId });
        await recordConsultMemoryConsent(
          durableAuthorization,
          payload.memoryConsentVersion ?? "",
          "consult-api"
        );
        await assertConsultMemorySnapshot(durableAuthorization, {
          memoryVersion: durableContext.memoryState.memoryVersion,
          memoryResetAt: durableContext.memoryState.memoryResetAt
        });
        persistedTurn = await persistConsultTurn({
          authorized: durableAuthorization,
          threadId: durableContext.threadId,
          question,
          answer,
          sourceEventIds: durableContext.sourceEventIds,
          memoryVersion: durableContext.memoryState.memoryVersion
        });
      } catch (error) {
        if (error instanceof ConsultMemoryAccessError) {
          return jsonError(error.code, error.message, error.status);
        }
        if (error instanceof ConsultMemoryConsentRequiredError) {
          return jsonError(error.code, error.message, error.status);
        }
        if (error instanceof ConsultMemoryConflictError) {
          return jsonError(error.code, "相談中にAIの記憶が変更または削除されました。最新の状態を読み直して、もう一度お試しください。", 409);
        }
        if (error instanceof ConsultMemoryNotReadyError || isConsultMemorySchemaMissing(error)) {
          return jsonError("memory_not_ready", CONSULT_MEMORY_NOT_READY_MESSAGE, 503);
        }
        console.error("[consult] failed to persist durable turn", error);
        return jsonError(
          "memory_failed",
          "回答を長期記憶へ保存できなかったため、今回は表示しませんでした。時間をおいてもう一度お試しください。",
          503
        );
      }
    }

    await recordConsultUsage({
      access: authorized,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      fastMode: usedFastMode,
      historyTurns: durableContext?.historyTurns
        ?? (Array.isArray(payload.history) ? Math.min(payload.history.length, CONSULT_MAX_HISTORY) : 0),
      outcome: "success"
    });

    if (authorized.dailyFreeFamilyId) {
      const supabase = getServerSupabase();
      const usedAt = new Date().toISOString();
      let updateQuery = supabase!.from("families")
        .update({ consult_trial_used_at: usedAt, updated_at: usedAt })
        .eq("id", authorized.dailyFreeFamilyId);
      updateQuery = authorized.dailyFreeUsedAt
        ? updateQuery.lt("consult_trial_used_at", currentJstDayStart())
        : updateQuery.is("consult_trial_used_at", null);
      const { error: trialError } = await updateQuery;
      if (trialError) {
        console.error("[consult] failed to mark daily free consult", trialError);
      }
    }

    const result = NextResponse.json({
      answer,
      disclaimer: CONSULT_DISCLAIMER,
      model: MODEL,
      consult: {
        mode: authorized.mode,
        dailyFreeConsumed: authorized.mode !== "plus",
        trialConsumed: authorized.mode !== "plus",
        durableMemory: Boolean(durableContext)
      },
      ...(durableContext ? {
        memory: {
          personId: durableContext.personId,
          memoryVersion: durableContext.memoryState.memoryVersion,
          recordCount: durableContext.memoryState.recordCount,
          sourceEventIds: durableContext.sourceEventIds,
          persistedTurnId: persistedTurn?.id ?? null,
          persistedAt: persistedTurn?.createdAt ?? null
        },
        history: {
          threadId: durableContext.threadId,
          turnCount: durableContext.historyTurns + (persistedTurn ? 1 : 0),
          latestTurn: persistedTurn ? {
            id: persistedTurn.id,
            savedToNotebookAt: null,
            createdAt: persistedTurn.createdAt
          } : null
        }
      } : {})
    });
    if (authorized.mode !== "plus") {
      result.cookies.set(DEVICE_DAILY_FREE_COOKIE, new Date().toISOString(), {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/"
      });
    }
    return result;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "consult_busy", message: "いま混み合っています。少し待ってからもう一度お試しください。" },
        { status: 429 }
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "consult_unavailable", message: "いまは相談を受け付けられません。" },
        { status: 503 }
      );
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return NextResponse.json(
        { error: "consult_timeout", message: "時間内に返せませんでした。相談内容を短くして、もう一度お試しください。" },
        { status: 504 }
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: "consult_failed", message: "相談の処理に失敗しました。時間をおいてお試しください。" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "consult_failed", message: "相談の処理に失敗しました。時間をおいてお試しください。" },
      { status: 500 }
    );
  }
}
