"use client";

import { useEffect, useState } from "react";
import { DISPLAY_THEME_KEY, displayTheme, displayThemes, readDisplayTheme, saveDisplayTheme, type DisplayThemeId } from "@/lib/display-theme";

function applyTheme(id: DisplayThemeId) {
  const theme = displayTheme(id);
  document.documentElement.dataset.displayColor = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.action);
}

export function DisplayThemePicker() {
  // Match SSR until mount. Do not write the default over a saved preference.
  const [selected, setSelected] = useState<DisplayThemeId>("sky");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const theme = readDisplayTheme(window.localStorage);
      setSelected(theme.id);
      applyTheme(theme.id);
    } catch {
      // Accessing localStorage itself can be disallowed by the browser.
      applyTheme("sky");
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== DISPLAY_THEME_KEY && event.key !== null) return;
      const theme = displayTheme(event.newValue);
      setSelected(theme.id);
      applyTheme(theme.id);
      setMessage("");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function choose(id: DisplayThemeId) {
    setSelected(id);
    applyTheme(id);
    let saved = false;
    try {
      saved = saveDisplayTheme(window.localStorage, id);
    } catch {
      // Still allow a temporary color change if browser storage is unavailable.
    }
    setMessage(saved
      ? `${displayTheme(id).name}に変更しました。このブラウザに保存しました。`
      : "色を変更しましたが、保存できませんでした。次に開くと元の色に戻る場合があります。");
  }

  const current = displayTheme(selected);
  return (
    <div className="display-theme-bar">
      <details className="display-theme-picker">
        <summary>
          <span>色を選ぶ</span>
          <span className="display-theme-current"><i aria-hidden="true" style={{ backgroundColor: current.action }} />{current.name}</span>
        </summary>
        <div className="display-theme-panel">
          <fieldset aria-describedby="display-theme-help">
            <legend>画面の色を選ぶ（10色）</legend>
            <p id="display-theme-help">押すとすぐに変わります。保存できた場合は、同じブラウザで次に開くときも選んだ色になります。記録の内容は変わりません。</p>
            <p>色は別の端末には引き継がれません。このブラウザを一緒に使う方には、同じ色で表示されます。</p>
            <div className="display-theme-options">
              {displayThemes.map((theme) => (
                <label className="display-theme-option" key={theme.id} style={{ backgroundColor: theme.action }}>
                  <input type="radio" name="display-color" value={theme.id} checked={selected === theme.id} onChange={() => choose(theme.id)} />
                  <span>{theme.name}</span>
                  <small aria-hidden="true">{selected === theme.id ? "選択中" : ""}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="display-theme-message" role="status">{message}</p>
        </div>
      </details>
    </div>
  );
}
