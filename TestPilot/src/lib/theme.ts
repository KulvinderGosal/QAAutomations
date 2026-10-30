// Light/dark theme: toggles `.dark` on <html>. Persisted to localStorage,
// defaulting to the OS preference.
export type Theme = "light" | "dark";

const KEY = "testpilot.theme";

export function initialTheme(): Theme {
  try {
    const s = localStorage.getItem(KEY);
    if (s === "light" || s === "dark") return s;
  } catch {
    /* ignore */
  }
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(t: Theme): void {
  if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", t === "dark");
}

export function saveTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
}
