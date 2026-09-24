import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { getSupabase } from "./supabase";

export type PushRegistrationResult = {
  token: string | null; saved: boolean;
  reason?: "permission_denied" | "token_failed" | "login_required" | "save_failed" | "legacy_registration_unknown" | "registration_unverified";
};
type Operation = { ownerId: string; requestId: string; revision: number; action: "register" | "revoke"; token?: string; platform?: "ios" | "android" };
type Installation = {
  version: 2; id: string; secret: string; revision: number; ownerId: string | null;
  state: "pristine" | "active" | "revoked"; pending: Operation | null;
};
const key = "oyano.push-installation.v2";
const legacyKey = "oyano.push-device.v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenPattern = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{1,256}\]$/;
const failedMessage = "この端末の通知解除を確認できないため、ログアウトを中止しました。通信を確認してもう一度お試しください。";
const legacyMessage = "以前の通知登録をこの端末のものと確認できないため、ログアウトを中止しました。端末の設定でこのアプリの通知をオフにし、サポートへお問い合わせください。";
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation, operation);
  queue = next.catch(() => undefined);
  return next;
}
async function session() {
  const result = await getSupabase()?.auth.getSession();
  if (!result || result.error) return null;
  return result.data.session;
}
async function persist(value: Installation) {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}
async function freshInstallation(): Promise<Installation> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const value: Installation = { version: 2, id: Crypto.randomUUID(), secret: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
    revision: 0, ownerId: null, state: "pristine", pending: null };
  await persist(value);
  return value;
}
async function installation(): Promise<Installation> {
  const raw = await SecureStore.getItemAsync(key);
  if (raw !== null) {
    const value = JSON.parse(raw) as Installation;
    if (value.version !== 2 || !uuid.test(value.id) || !/^[a-f0-9]{64}$/.test(value.secret)
      || !Number.isSafeInteger(value.revision) || value.revision < 0
      || (value.ownerId !== null && typeof value.ownerId !== "string")
      || !["pristine", "active", "revoked"].includes(value.state)
      || (value.pending !== null && (!value.pending || typeof value.pending.ownerId !== "string"
        || !uuid.test(value.pending.requestId) || value.pending.revision !== value.revision
        || !["register", "revoke"].includes(value.pending.action)
        || (value.pending.action === "register" && (!tokenPattern.test(value.pending.token ?? "") || !["ios", "android"].includes(value.pending.platform ?? "")))
        || (value.pending.action === "revoke" && (value.pending.token !== undefined || value.pending.platform !== undefined))))) {
      throw new Error("Invalid installation state");
    }
    return value;
  }
  const legacy = await SecureStore.getItemAsync(legacyKey);
  if (legacy !== null) {
    const value = JSON.parse(legacy);
    if (value?.version !== 1 || !Array.isArray(value.tokens) || value.tokens.length
      || !Array.isArray(value.unsettledTokens) || value.unsettledTokens.length) throw new Error("legacy_registration_unknown");
  }
  // A fresh v2 identity is not evidence that an unknown legacy installation was
  // migrated. The server rollout gate must first clear that inventory.
  return freshInstallation();
}
async function prepare(value: Installation, ownerId: string, action: Operation["action"], token?: string): Promise<Installation> {
  // The authenticated RPC decides whether the previous owner is still active,
  // revoked or erased. Local Auth may have changed after account erasure; a
  // stale local owner must not prevent checking the irreversible tombstone.
  if (value.pending?.action === action && value.pending.ownerId === ownerId && value.pending.token === token) return value;
  if (!Number.isSafeInteger(value.revision + 1)) throw new Error("Revision exhausted");
  const next: Installation = { ...value, revision: value.revision + 1, pending: {
    ownerId, action, revision: value.revision + 1, requestId: Crypto.randomUUID(),
    ...(action === "register" ? { token, platform: Platform.OS as "ios" | "android" } : {})
  } };
  await persist(next);
  return next;
}
async function send(value: Installation, accessToken: string): Promise<Installation | "retired" | null> {
  const pending = value.pending;
  const base = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "");
  if (!pending || !base) return null;
  try {
    const response = await fetch(`${base}/api/push-tokens/${pending.action === "register" ? "register" : "unregister"}`, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ protocol: 2, installationId: value.id, secret: value.secret, revision: pending.revision,
        requestId: pending.requestId, ...(pending.action === "register" ? { expoPushToken: pending.token, platform: pending.platform } : {}) })
    });
    const body = await response.json() as Record<string, unknown>;
    if (response.status === 409 && body.error === "installation_retired") return "retired";
    if (!response.ok || body.ok !== true || body.installationId !== value.id || body.revision !== pending.revision
      || body.requestId !== pending.requestId || !["active", "revoked"].includes(body.state as string)
      || (pending.action === "revoke" && body.state !== "revoked")) return null;
    const next: Installation = { ...value, ownerId: pending.ownerId, state: body.state as "active" | "revoked", pending: null };
    await persist(next);
    return next;
  } catch { return null; }
}

export function registerPushToken(): Promise<PushRegistrationResult> {
  return serialize(async () => {
    try {
      const auth = await session();
      if (!auth) return { token: null, saved: false, reason: "login_required" };
      const value = await installation();
      const Notifications = await import("expo-notifications");
      if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "default", importance: Notifications.AndroidImportance.DEFAULT });
      if (!(await Notifications.requestPermissionsAsync()).granted) return { token: null, saved: false, reason: "permission_denied" };
      let token: string;
      try {
        const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
        token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
        if (!tokenPattern.test(token)) throw new Error("Invalid token");
      } catch { return { token: null, saved: false, reason: "token_failed" }; }
      if ((await session())?.user.id !== auth.user.id) return { token: null, saved: false, reason: "login_required" };
      const prepared = await prepare(value, auth.user.id, "register", token);
      let confirmed = await send(prepared, auth.access_token);
      if ((await session())?.user.id !== auth.user.id) return { token: null, saved: false, reason: "login_required" };
      if (confirmed === "retired") {
        // Only a server-confirmed, irreversibly erased identity may be reset.
        // Lost responses/legacy conflicts never mint a replacement identity.
        confirmed = await send(await prepare(await freshInstallation(), auth.user.id, "register", token), auth.access_token);
      }
      if ((await session())?.user.id !== auth.user.id) return { token: null, saved: false, reason: "login_required" };
      return confirmed && confirmed !== "retired" && confirmed.state === "active" ? { token, saved: true } : { token: null, saved: false, reason: "registration_unverified" };
    } catch (error) {
      return { token: null, saved: false, reason: error instanceof Error && error.message === "legacy_registration_unknown" ? "legacy_registration_unknown" : "save_failed" };
    }
  });
}

export function withDevicePushRevoked<T>(signOut: () => Promise<T>): Promise<{ completed: true; result: T } | { completed: false; message: string }> {
  return serialize(async () => {
    try {
      const auth = await session();
      if (!auth) return { completed: false, message: failedMessage };
      const value = await installation();
      const prepared = await prepare(value, auth.user.id, "revoke");
      const confirmed = await send(prepared, auth.access_token);
      if (!confirmed || (await session())?.user.id !== auth.user.id) return { completed: false, message: failedMessage };
      // Account erasure already removed every managed registration for this
      // identity. Persist a fresh unused identity before allowing Auth logout.
      if (confirmed === "retired") await freshInstallation();
      return { completed: true, result: await signOut() };
    } catch (error) {
      return { completed: false, message: error instanceof Error && error.message === "legacy_registration_unknown" ? legacyMessage : failedMessage };
    }
  });
}
