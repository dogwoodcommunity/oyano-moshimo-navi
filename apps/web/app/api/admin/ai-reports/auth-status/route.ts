import { authorizeAiReportOperator, operatorJson, operatorErrorResponse } from "@/lib/aiReportOperator";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const operator = await authorizeAiReportOperator(request, false);
    return operatorJson({ authenticated: true, method: "supabase_app_admin", email: operator.email ?? null, aal: operator.aal });
  } catch (error) { return operatorErrorResponse(error); }
}
