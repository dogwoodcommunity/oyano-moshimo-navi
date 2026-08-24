import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import {
  CONSULT_COST_USD_JPY_RATE,
  CONSULT_PER_CLIENT_DAILY_LIMIT,
  CONSULT_PER_FAMILY_MONTHLY_LIMIT,
  CONSULT_SERVICE_DAILY_LIMIT,
  currentJstDayStart,
  currentJstMonthStart
} from "@/lib/consultLimits";
import { getServerSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

type UsageLogRow = {
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type FamilyUsage = {
  key: string;
  label: string;
  plan: "free" | "plus";
  apiCalls: number;
  successfulAnswers: number;
  todaySuccessfulAnswers: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function outcome(metadata: Record<string, unknown>) {
  return typeof metadata.outcome === "string" ? metadata.outcome : "success";
}

function rounded(value: number, digits = 6) {
  return Number(value.toFixed(digits));
}

function familyLabel(row: UsageLogRow) {
  if (row.target_type !== "family" || !row.target_id) return "端末おためし";
  return `家族 ${row.target_id.slice(0, 8)}`;
}

export async function GET(request: Request) {
  const auth = await verifyAdminRequest(request);
  if (!auth.ok) return auth.response;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const monthStart = currentJstMonthStart();
  const dayStart = currentJstDayStart();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("target_type, target_id, metadata, created_at")
    .eq("action", "ai_consult_usage")
    .gte("created_at", monthStart)
    .order("created_at", { ascending: false })
    .limit(10_000);

  if (error) {
    return NextResponse.json(
      { error: "ai_usage_unavailable", message: error.message },
      { status: 503 }
    );
  }

  const rows = (data ?? []) as UsageLogRow[];
  const grouped = new Map<string, FamilyUsage>();
  let todayApiCalls = 0;
  let successfulAnswers = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedCostUsd = 0;

  rows.forEach((row) => {
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const isToday = row.created_at >= dayStart;
    const isSuccess = outcome(metadata) === "success";
    const rowInputTokens = numeric(metadata.input_tokens);
    const rowOutputTokens = numeric(metadata.output_tokens);
    const rowCost = numeric(metadata.estimated_cost_usd);
    const key = row.target_type === "family" && row.target_id ? row.target_id : "device-trial";
    const existing = grouped.get(key) ?? {
      key,
      label: familyLabel(row),
      plan: metadata.plan === "plus" ? "plus" : "free",
      apiCalls: 0,
      successfulAnswers: 0,
      todaySuccessfulAnswers: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0
    };

    existing.apiCalls += 1;
    existing.successfulAnswers += isSuccess ? 1 : 0;
    existing.todaySuccessfulAnswers += isSuccess && isToday ? 1 : 0;
    existing.inputTokens += rowInputTokens;
    existing.outputTokens += rowOutputTokens;
    existing.estimatedCostUsd += rowCost;
    if (metadata.plan === "plus") existing.plan = "plus";
    grouped.set(key, existing);

    todayApiCalls += isToday ? 1 : 0;
    successfulAnswers += isSuccess ? 1 : 0;
    inputTokens += rowInputTokens;
    outputTokens += rowOutputTokens;
    estimatedCostUsd += rowCost;
  });

  const families = Array.from(grouped.values())
    .map((row) => ({
      ...row,
      estimatedCostUsd: rounded(row.estimatedCostUsd),
      estimatedCostYen: Math.round(row.estimatedCostUsd * CONSULT_COST_USD_JPY_RATE),
      limitStatus: row.plan !== "plus"
        ? "trial"
        : row.successfulAnswers >= CONSULT_PER_FAMILY_MONTHLY_LIMIT
          ? "limit"
          : row.successfulAnswers >= Math.ceil(CONSULT_PER_FAMILY_MONTHLY_LIMIT * 0.8)
            ? "near"
            : "ok"
    }))
    .sort((left, right) => right.estimatedCostUsd - left.estimatedCostUsd);

  return NextResponse.json({
    period: { monthStart, dayStart },
    limits: {
      perClientDaily: CONSULT_PER_CLIENT_DAILY_LIMIT,
      perFamilyMonthly: CONSULT_PER_FAMILY_MONTHLY_LIMIT,
      serviceDaily: CONSULT_SERVICE_DAILY_LIMIT
    },
    exchangeRate: CONSULT_COST_USD_JPY_RATE,
    summary: {
      apiCalls: rows.length,
      todayApiCalls,
      successfulAnswers,
      inputTokens,
      outputTokens,
      estimatedCostUsd: rounded(estimatedCostUsd),
      estimatedCostYen: Math.round(estimatedCostUsd * CONSULT_COST_USD_JPY_RATE)
    },
    families
  });
}
