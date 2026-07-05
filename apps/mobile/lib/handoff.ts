export type HandoffResult = {
  familyId: string;
  personId: string;
  tasksCreated: number;
};

export async function consumeWebHandoff(caseId?: string, token?: string): Promise<HandoffResult | null> {
  const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  if (!webBaseUrl || !caseId || !token || caseId === "demo" || token === "demo") {
    return null;
  }

  const response = await fetch(`${webBaseUrl.replace(/\/$/, "")}/api/handoff/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, token })
  });

  if (!response.ok) {
    return null;
  }

  return await response.json() as HandoffResult;
}
