// Colour-mode handling, mirroring the original prototype's light/white/dark
// modes (themes.css keys on body.mode-*). Persisted per-device in localStorage.
export const MODES = ["mode-light", "mode-white", "mode-dark"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABELS: Record<Mode, string> = {
  "mode-light": "Light",
  "mode-white": "White",
  "mode-dark": "Dark",
};

const STORAGE_KEY = "mlp_colour_mode";

export function applyMode(mode: Mode) {
  document.body.classList.remove(...MODES);
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
    if (m === "mode-light" || m === "mode-white" || m === "mode-dark") return m;
  } catch {
    // ignore
  }
  return "mode-light";
}
