import { authorizeAiReportOperator, AiReportOperatorError, operatorJson, operatorErrorResponse } from "@/lib/aiReportOperator";
import { listAiReports } from "@/lib/aiReportReview";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const operator = await authorizeAiReportOperator(request);
    const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
    if (!/^\d{1,6}$/.test(rawOffset)) throw new AiReportOperatorError("invalid_request", "一覧の位置を確認してください。", 400);
    return operatorJson(await listAiReports(operator, Number(rawOffset)));
  } catch (error) { return operatorErrorResponse(error); }
}
