import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import {
  hasNotebookSubstance,
  normalizeConsultAnswer,
  CONSULT_DISCLAIMER,
  CONSULT_MAX_QUESTION_LENGTH,
  type ConsultRequest
} from "@oyano/shared";
import { buildConsultPrompt, CONSULT_SYSTEM_PROMPT, CONSULT_TOOL } from "@/lib/consult";
import { checkPublicRateLimit, checkServiceRateLimit } from "@/lib/publicRateLimit";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-opus-5";

/** 1回ごとに外部APIの費用が出るため、利用者ごとと、サービス全体の両方に1日の上限を置く。 */
const PER_CLIENT_DAILY_LIMIT = Number(process.env.CONSULT_CLIENT_DAILY_LIMIT ?? 5);
const SERVICE_DAILY_LIMIT = Number(process.env.CONSULT_DAILY_LIMIT ?? 200);
const ONE_DAY_SECONDS = 86_400;

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

async function authorizePlusConsult(request: NextRequest) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return {
      response: jsonError(
        "consult_unavailable",
        "長期相談の本人確認を準備中です。手帳への記録はこれまで通り使えます。",
        503
      )
    };
  }

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return {
      response: jsonError(
        "login_required",
        "長期相談は、保存された手帳を前提に使うPlus機能です。先に家族ボードでメール確認をしてください。",
        401
      )
    };
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
    return {
      response: jsonError(
        "consult_unavailable",
        "長期相談の利用状況を確認できませんでした。時間をおいてお試しください。",
        503
      )
    };
  }

  const familyIds = (memberships ?? [])
    .map((membership) => typeof membership.family_id === "string" ? membership.family_id : "")
    .filter(Boolean);

  if (familyIds.length === 0) {
    return {
      response: jsonError(
        "notebook_cloud_required",
        "長期相談は、消えない手帳を前提に使います。先に家族ボードでクラウド控えを作ってください。",
        403
      )
    };
  }

  const { data: families, error: familyError } = await supabase
    .from("families")
    .select("plan")
    .in("id", familyIds);

  if (familyError) {
    return {
      response: jsonError(
        "consult_unavailable",
        "長期相談の利用状況を確認できませんでした。時間をおいてお試しください。",
        503
      )
    };
  }

  const hasPlus = (families ?? []).some((family) => family.plan === "plus");
  if (!hasPlus) {
    return {
      response: jsonError(
        "plus_required",
        "長期相談はPlusで使えます。1人目の手帳と基本の記録は無料のまま使えます。",
        402
      )
    };
  }

  return { userId: user.id };
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
  if (question.length < 4) {
    return badRequest("相談したいことを、もう少しだけ書いてください。");
  }
  if (question.length > CONSULT_MAX_QUESTION_LENGTH) {
    return badRequest(`相談内容は${CONSULT_MAX_QUESTION_LENGTH}文字までにしてください。`);
  }
  // historyは自由入力の塊なので、形が崩れたまま通すと組み立て時に落ちたり、
  // 巨大な配列でプロンプト（＝API費用）が膨らむ。枠を消費する前にここで弾く。
  if (payload.history !== undefined) {
    const validHistory = Array.isArray(payload.history)
      && payload.history.every((turn) => Boolean(turn) && typeof turn === "object" && typeof (turn as { question?: unknown }).question === "string");
    if (!validHistory) {
      return badRequest("相談の続きの情報を読み取れませんでした。");
    }
  }

  const authorized = await authorizePlusConsult(request);
  if ("response" in authorized) return authorized.response;

  if (!hasNotebookSubstance(payload)) {
    return NextResponse.json(
      {
        error: "notebook_required",
        message: "先に手帳へ記録を1件書くか、プロフィールを2つ以上埋めてください。記録がないと、一般論しか返せません。"
      },
      { status: 422 }
    );
  }

  // ここまでの検証を通ったものだけが枠を消費する。
  // 入力の不備で弾かれたリクエストで1日の枠を使い切ると、一度も相談できないまま終わる。
  const limited = await checkPublicRateLimit(request, {
    keyPrefix: "consult",
    limit: PER_CLIENT_DAILY_LIMIT,
    windowSeconds: ONE_DAY_SECONDS
  });
  if (limited) return limited;

  const service = await checkServiceRateLimit({
    keyPrefix: "consult",
    limit: SERVICE_DAILY_LIMIT,
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

  const client = new Anthropic({ apiKey, timeout: 55_000, maxRetries: 1 });

  try {
    const params = {
      model: MODEL,
      max_tokens: 5000,
      // 本番で29〜49秒かかり、48秒台では空で返った。60秒の実行上限に近すぎる。
      // 出力の形はシステムプロンプトとstrict schemaで固定してあるので、
      // 推論の深さを下げても崩れにくいと判断してlowにする。
      // 実測では low でも medium と質は変わらず、時間も変わらなかった。
      output_config: { effort: "low" as const },
      system: CONSULT_SYSTEM_PROMPT,
      tools: [CONSULT_TOOL],
      messages: [{ role: "user" as const, content: buildConsultPrompt({ ...payload, question }) }]
    };

    // 高速版が使えない環境では黙って通常版へ落とす。速さのために機能ごと止めない。
    const response = FAST_MODE
      ? await client.beta.messages.create({
          ...params,
          betas: ["fast-mode-2026-02-01"],
          speed: "fast"
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
      return NextResponse.json(
        {
          error: "consult_failed",
          message: "うまく整理できませんでした。相談内容を少し変えて、もう一度試してください。"
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer, disclaimer: CONSULT_DISCLAIMER, model: MODEL });
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
