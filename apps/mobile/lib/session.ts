import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { mobileAuthBrowserUrl } from "./authFlow";

export type MobileSessionState = {
  status: "loading" | "unconfigured" | "signed-out" | "signed-in" | "error";
  userId: string | null;
};

export function sessionState(session: Session | null): MobileSessionState {
  const user = session?.user;
  return user?.id && user.email_confirmed_at && !user.is_anonymous
    ? { status: "signed-in", userId: user.id }
    : { status: "signed-out", userId: null };
}

/** Observe local auth only. An older initial read cannot overwrite a newer event. */
export function observeMobileSession(publish: (state: MobileSessionState) => void) {
  let active = true;
  let revision = 0;
  try {
    mobileAuthBrowserUrl(process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "", "0".repeat(64));
    const client = getSupabase();
    if (!client) {
      publish({ status: "unconfigured", userId: null });
      return () => { active = false; };
    }
    publish({ status: "loading", userId: null });
    const readRevision = revision;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      revision += 1;
      if (active) publish(sessionState(session));
    });
    void client.auth.getSession().then((result) => {
      if (!active || revision !== readRevision) return;
      publish(result.error ? { status: "error", userId: null } : sessionState(result.data.session));
    }).catch(() => {
      if (active && revision === readRevision) publish({ status: "error", userId: null });
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  } catch {
    publish({ status: "unconfigured", userId: null });
    return () => { active = false; };
  }
}
