import { authorizeAiReportOperator, AiReportOperatorError, operatorJson, operatorErrorResponse } from "@/lib/aiReportOperator";
import { parseAiReportReview, readAiReportDetail, writeAiReportReview } from "@/lib/aiReportReview";
export const dynamic = "force-dynamic";
type Context = { params: { reportId: string } };
export async function GET(request: Request, { params }: Context) {
  try {
    const operator = await authorizeAiReportOperator(request);
    return operatorJson(await readAiReportDetail(operator, params.reportId));
  } catch (error) { return operatorErrorResponse(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const operator = await authorizeAiReportOperator(request);
    const raw = await request.text();
    const change = raw.length <= 1024 ? parseAiReportReview(JSON.parse(raw)) : null;
    if (!change) throw new AiReportOperatorError("invalid_request", "対応状況を選び直してください。", 400);
    return operatorJson(await writeAiReportReview(operator, params.reportId, change));
  } catch (error) {
    if (error instanceof SyntaxError) return operatorJson({ error: "invalid_request", message: "入力を読み取れませんでした。" }, 400);
    return operatorErrorResponse(error);
  }
}
