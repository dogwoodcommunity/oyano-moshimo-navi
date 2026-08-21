"use client";

import type { FunnelEvent } from "@oyano/shared";

const ANON_KEY = "oyano_anon_id_v01";

function anonId(): string | null {
  try {
    const storage = window.localStorage;
    if (!storage) return null;

    const existing = storage.getItem(ANON_KEY);
    if (existing) return existing;

    const created = globalThis.crypto?.randomUUID?.() ?? `anon_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    storage.setItem(ANON_KEY, created);
    return created;
  } catch {
    return null;
  }
}

/** 計測は失敗しても何も起こさない。利用者の操作を止めないことを優先する。 */
export function trackFunnel(event: FunnelEvent): void {
  if (typeof window === "undefined") return;

  const id = anonId();
  if (!id) return;

  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anonId: id, event, platform: "web" }),
    keepalive: true
  }).catch(() => null);
}
