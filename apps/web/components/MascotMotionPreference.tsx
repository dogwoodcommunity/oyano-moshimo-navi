"use client";

import { useEffect, useId, useState } from "react";

const MASCOT_MOTION_KEY = "oyano-moshimo:mascot-motion:v1";
const MASCOT_MOTION_EVENT = "oyano-moshimo:mascot-motion:change";

// A failed save can still change this tab, including subsequently mounted mascots.
// This is a visual preference only; notebook data is never read or changed here.
let temporaryChoice: boolean | undefined;

function readMotionPreference(): boolean {
  if (temporaryChoice !== undefined) return temporaryChoice;
  try {
    return window.localStorage.getItem(MASCOT_MOTION_KEY) !== "off";
  } catch {
    // If the saved choice cannot be read, do not start unsolicited movement.
    return false;
  }
}

function saveMotionPreference(enabled: boolean): boolean {
  let saved = false;
  try {
    window.localStorage.setItem(MASCOT_MOTION_KEY, enabled ? "on" : "off");
    saved = true;
  } catch {
    // Security/privacy settings and a full quota must not disable the control.
  }
  temporaryChoice = saved ? undefined : enabled;
  window.dispatchEvent(new CustomEvent(MASCOT_MOTION_EVENT, { detail: { enabled } }));
  return saved;
}

export function useMascotMotionPreference(): { enabled: boolean; ready: boolean } {
  // Match the server and first client render; never write a default on mount.
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onPreferenceChange = (event: Event) => {
      const choice = (event as CustomEvent<{ enabled?: unknown }>).detail?.enabled;
      if (typeof choice !== "boolean") return;
      setEnabled(choice);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== MASCOT_MOTION_KEY) return;
      try {
        if (event.storageArea !== window.localStorage) return;
      } catch {
        return;
      }
      temporaryChoice = undefined;
      setEnabled(event.newValue !== "off");
    };

    window.addEventListener(MASCOT_MOTION_EVENT, onPreferenceChange);
    window.addEventListener("storage", onStorage);
    setEnabled(readMotionPreference());
    setReady(true);

    return () => {
      window.removeEventListener(MASCOT_MOTION_EVENT, onPreferenceChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { enabled, ready };
}

export function MascotMotionToggle() {
  const { enabled, ready } = useMascotMotionPreference();
  const [message, setMessage] = useState("");
  const helpId = useId();

  function choose(next: boolean) {
    const saved = saveMotionPreference(next);
    setMessage(saved
      ? `キャラクターの動きを${next ? "オン" : "オフ"}にしました。`
      : "動きの設定を変更しましたが、保存できませんでした。この画面では反映されますが、開き直すと元に戻る場合があります。");
  }

  return (
    <div className="mascot-motion-control">
      <label className="mascot-motion-label">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!ready}
          aria-describedby={helpId}
          onChange={(event) => choose(event.currentTarget.checked)}
        />
        <span>キャラクターの動き</span>
        <strong className="mascot-motion-value" aria-hidden="true">{enabled ? "オン" : "オフ"}</strong>
      </label>
      <p id={helpId} className="mascot-motion-help">動きをオフにしても、表情は表示されます。</p>
      <p className="mascot-motion-message" role="status">{message}</p>
    </div>
  );
}
