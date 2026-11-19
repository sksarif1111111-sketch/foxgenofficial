/** Site colour theme: "dark" adds the `.dark` class on <html>; the choice is kept on this device. */
export type Theme = "light" | "dark";
export const THEME_KEY = "foxgen-theme";
export const THEME_EVENT = "foxgen-theme-change";

/** Runs in <head> before paint so a saved dark choice never flashes white. */
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}
