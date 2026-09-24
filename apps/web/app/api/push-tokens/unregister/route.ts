import { applyPushInstallation } from "@/lib/pushInstallation";

export function POST(request: Request) {
  return applyPushInstallation(request, "revoke");
}
