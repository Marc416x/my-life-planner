// Colour-mode handling: light + dark (themes.css keys on body.mode-*).
// Persisted per-device in localStorage. (The old "white/clean" mode was dropped.)
export const MODES = ["mode-light", "mode-dark"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABELS: Record<Mode, string> = {
  "mode-light": "Light",
  "mode-dark": "Dark",
};

const STORAGE_KEY = "mlp_colour_mode";

export function applyMode(mode: Mode) {
  // Also strip the retired "mode-white" class in case it lingers from an old session.
  document.body.classList.remove("mode-light", "mode-white", "mode-dark");
  document.body.classList.add(mode);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

export function getStoredMode(): Mode {
  try {
    const m = localStorage.getItem(STORAGE_KEY);
    if (m === "mode-light" || m === "mode-dark") return m;
  } catch {
    // ignore
  }
  return "mode-light";
}
