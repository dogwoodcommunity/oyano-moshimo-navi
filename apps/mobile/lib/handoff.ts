import { getSupabase } from "./supabase";

export type HandoffResult = {
  familyId: string;
  personId: string;
  tasksCreated: number;
  error?: string;
};

export async function consumeWebHandoff(
  caseId: string | undefined,
  token: string | undefined,
  isCurrent: () => boolean
): Promise<HandoffResult | null> {
  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  if (!isCurrent() || !webBaseUrl || !caseId || !token || caseId === "demo" || token === "demo") {
    return null;
  }

  const supabase = getSupabase();
  const { data: sessionResult } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  // The auth read can wait for token refresh. Do not start a new write after
  // the initiating screen/target/request has gone away. A POST already sent
  // cannot be assumed cancelled; the server's same-owner retry stays in place.
  if (!isCurrent()) return null;
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
