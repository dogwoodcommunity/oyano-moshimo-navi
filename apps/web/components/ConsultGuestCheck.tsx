"use client";

import { TurnstileCheck } from "@/components/AuthCaptcha";

/** Mounted only after the person explicitly selects first-use consent. */
export function ConsultGuestCheck({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  return <TurnstileCheck siteKey={siteKey} onToken={onToken} />;
}
