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

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-opus-5";

/** 1回ごとに外部APIの費用が出るため、利用者ごとと、サービス全体の両方に1日の上限を置く。 */
const PER_CLIENT_DAILY_LIMIT = Number(process.env.CONSULT_CLIENT_DAILY_LIMIT ?? 5);
const SERVICE_DAILY_LIMIT = Number(process.env.CONSULT_DAILY_LIMIT ?? 200);
const ONE_DAY_SECONDS = 86_400;

function badRequest(message: string) {
  return NextResponse.json({ error: "invalid_request", message }, { status: 400 });
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
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      // 断定を避ける構成で十分な質を出しつつ、Vercelの実行時間内に収める。
      output_config: { effort: "medium" },
      system: CONSULT_SYSTEM_PROMPT,
      tools: [CONSULT_TOOL],
      messages: [{ role: "user", content: buildConsultPrompt({ ...payload, question }) }]
    });

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
