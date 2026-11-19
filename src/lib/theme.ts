/** Site colour theme: "dark" adds the `.dark` class on <html>; the choice is kept on this device. */
export type Theme = "light" | "dark";
export const THEME_KEY = "foxgen-theme";
export const THEME_EVENT = "foxgen-theme-change";
export const THEME_COLORS: Record<Theme, string> = { light: "#ffffff", dark: "#17181c" };

/**
 * Runs in <head> before paint: saved choice wins, otherwise the device setting. Also sets the
 * mobile browser bar colour, so a reload never flashes the wrong theme.
 */
export const THEME_BOOT_SCRIPT = `try{var s;try{s=localStorage.getItem("${THEME_KEY}")}catch(x){}var d=s==="dark"||s!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches;var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.name="theme-color";document.head.appendChild(m)}m.content=d?"${THEME_COLORS.dark}":"${THEME_COLORS.light}"}catch(x){}`;

export const currentTheme = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

function paint(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
  meta.content = THEME_COLORS[theme];
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Instant theme change (no animation); saves the choice. */
export function applyTheme(theme: Theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
  paint(theme);
}

type ThemeTransition = { ready: Promise<void>; finished: Promise<void>; skipTransition: () => void };
type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => ThemeTransition };
let activeTransition: ThemeTransition | undefined;
let fadeTimer: number | undefined;
let switchVersion = 0;

/**
 * Animated switch: circular reveal from (x, y) via the View Transitions API (~600ms), a 300ms
 * colour fade where unsupported, and an instant switch under reduced motion.
 */
export function switchTheme(theme: Theme, origin?: { x: number; y: number }) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
  const version = ++switchVersion;
  activeTransition?.skipTransition();
  activeTransition = undefined;
  const root = document.documentElement;
  if (fadeTimer !== undefined) window.clearTimeout(fadeTimer);
  root.classList.remove("theme-fading", "theme-revealing");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return paint(theme);
  const doc = document as ViewTransitionDoc;
  if (doc.startViewTransition && origin) {
    const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    root.classList.add("theme-revealing");
    const t = doc.startViewTransition(() => { if (version === switchVersion) paint(theme); });
    activeTransition = t;
    void t.ready.then(async () => {
      if (version !== switchVersion) return;
      const animation = root.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 600, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      );
      await animation.finished;
    }).catch(() => { /* A superseded reveal is intentionally skipped. */ });
    void t.finished.catch(() => {}).finally(() => {
      if (version !== switchVersion) return;
      activeTransition = undefined;
      root.classList.remove("theme-revealing");
    });
    return;
  }
  root.classList.add("theme-fading");
  paint(theme);
  fadeTimer = window.setTimeout(() => root.classList.remove("theme-fading"), 320);
}
