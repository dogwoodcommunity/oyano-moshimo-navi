// Display preferences belong to this browser, not to a person/family notebook.
// Never use the notebook store, cloud payload, or backup for these values.
export const DISPLAY_THEME_KEY = "oyano-display-color-v1";
export const displayThemes = [
  { id: "sky", name: "水色", paper: "#f4fbff", action: "#d6f1ff", soft: "#eaf8ff", line: "#8ebdd0" },
  { id: "mint", name: "ミント", paper: "#f3fcf9", action: "#d5f5e9", soft: "#e8faf2", line: "#8fbeb0" },
  { id: "leaf", name: "若草", paper: "#f8fcf3", action: "#e5f3ce", soft: "#f0f8e4", line: "#acbf8f" },
  { id: "lemon", name: "レモン", paper: "#fffef3", action: "#fff3bf", soft: "#fff9df", line: "#c8bc7d" },
  { id: "peach", name: "ピーチ", paper: "#fff8f4", action: "#ffe4d1", soft: "#fff0e5", line: "#cfad97" },
  { id: "sakura", name: "さくら", paper: "#fff7fa", action: "#fce0ec", soft: "#ffedf4", line: "#cba4b5" },
  { id: "lavender", name: "ラベンダー", paper: "#faf7ff", action: "#ede2fc", soft: "#f4edff", line: "#b8a6cd" },
  { id: "violet", name: "すみれ", paper: "#f8f8ff", action: "#e3e3ff", soft: "#eeeefe", line: "#abafd0" },
  { id: "blue", name: "あお", paper: "#f5f9ff", action: "#dbe9ff", soft: "#eaf2ff", line: "#9cb5d6" },
  { id: "gray", name: "グレー", paper: "#f8fafb", action: "#e6ecef", soft: "#f0f4f6", line: "#a5b6be" }
] as const;
export type DisplayThemeId = typeof displayThemes[number]["id"];

export function displayTheme(value: unknown) {
  return displayThemes.find((theme) => theme.id === value) ?? displayThemes[0];
}

export function readDisplayTheme(storage: Pick<Storage, "getItem">) {
  try {
    return displayTheme(storage.getItem(DISPLAY_THEME_KEY));
  } catch {
    return displayThemes[0];
  }
}

export function saveDisplayTheme(storage: Pick<Storage, "setItem">, id: DisplayThemeId) {
  try {
    storage.setItem(DISPLAY_THEME_KEY, displayTheme(id).id);
    return true;
  } catch {
    return false;
  }
}

// Only static, allowlisted values become CSS; stored strings never become CSS.
// The reading ink stays dark for every palette. Warning/error colors are separate.
export const displayThemeCss = displayThemes.map((theme) => `
  html.readable-design-b[data-display-color="${theme.id}"] {
    --bg-paper: ${theme.paper}; --paper: ${theme.paper}; --body-bg: ${theme.paper};
    --surface-soft: ${theme.paper}; --action-bg: ${theme.action}; --primary-tint: ${theme.action};
    --tab-teal: ${theme.action}; --cover-sub: ${theme.soft}; --tab-sand: ${theme.soft};
    --line: ${theme.line}; --rule-line: ${theme.line}; --stitch: ${theme.line};
    --leader: ${theme.line}; --hairline: ${theme.line}; --secondary-border: ${theme.line};
  }
`).join("\n");
