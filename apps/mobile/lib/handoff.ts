import { getSupabase } from "./supabase";

export type HandoffResult = {
  familyId: string;
  personId: string;
  tasksCreated: number;
  error?: string;
};

export async function consumeWebHandoff(caseId?: string, token?: string): Promise<HandoffResult | null> {
  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  if (!webBaseUrl || !caseId || !token || caseId === "demo" || token === "demo") {
    return null;
  }

  const supabase = getSupabase();
  const { data: sessionResult } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const accessToken = sessionResult.session?.access_token;
  if (!accessToken) return { familyId: "", personId: "", tasksCreated: 0, error: "login_required" };

  const response = await fetch(`${webBaseUrl.replace(/\/$/, "")}/api/handoff/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ caseId, token })
  });

  if (!response.ok) {
    return { familyId: "", personId: "", tasksCreated: 0, error: "handoff_failed" };
  }

  return await response.json() as HandoffResult;
}
