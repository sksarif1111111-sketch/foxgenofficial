import { afterEach, describe, expect, it } from "bun:test";
import { runInNewContext } from "node:vm";
import { applyTheme, switchTheme, THEME_BOOT_SCRIPT, THEME_KEY } from "./theme";

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalStorage = globalThis.localStorage;
afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  globalThis.localStorage = originalStorage;
});

function environment(saved, deviceDark = false, blocked = false) {
  const classes = new Set();
  const meta = {};
  const root = { style: {}, classList: {
    toggle: (key, on) => on ? classes.add(key) : classes.delete(key),
    contains: (key) => classes.has(key),
    add: (...keys) => keys.forEach((key) => classes.add(key)),
    remove: (...keys) => keys.forEach((key) => classes.delete(key)),
  } };
  const values = new Map(saved ? [[THEME_KEY, saved]] : []);
  const context = {
    document: { documentElement: root, querySelector: () => meta },
    localStorage: {
      getItem: (key) => { if (blocked) throw Error("blocked"); return values.get(key); },
      setItem: (key, value) => values.set(key, value),
    },
    matchMedia: () => ({ matches: deviceDark }),
  };
  return { context, classes, meta, values };
}

describe("existing theme preference rules", () => {
  it("preserves foxgen-theme saved light over a dark device preference", () => {
    const env = environment("light", true);
    runInNewContext(THEME_BOOT_SCRIPT, env.context);
    expect(env.classes.has("dark")).toBe(false);
    expect(env.context.document.documentElement.style.colorScheme).toBe("light");
  });
  it("applies saved dark before rendering and updates the browser bar", () => {
    const env = environment("dark");
    runInNewContext(THEME_BOOT_SCRIPT, env.context);
    expect(env.classes.has("dark")).toBe(true);
    expect(env.meta.content).toBe("#17181c");
  });
  it("uses device dark on first visit", () => {
    const env = environment(undefined, true);
    runInNewContext(THEME_BOOT_SCRIPT, env.context);
    expect(env.classes.has("dark")).toBe(true);
  });
  it("retains device fallback when storage is blocked", () => {
    const env = environment(undefined, true, true);
    runInNewContext(THEME_BOOT_SCRIPT, env.context);
    expect(env.classes.has("dark")).toBe(true);
  });
  it("switches instantly under reduced motion and saves the selected theme", () => {
    const env = environment();
    globalThis.document = env.context.document;
    globalThis.localStorage = env.context.localStorage;
    let transitions = 0;
    globalThis.document.startViewTransition = () => { transitions++; };
    globalThis.window = { matchMedia: () => ({ matches: true }), dispatchEvent: () => {} };
    switchTheme("dark", { x: 0, y: 0 });
    expect(transitions).toBe(0);
    expect(env.classes.has("dark")).toBe(true);
    expect(env.values.get("foxgen-theme")).toBe("dark");
    applyTheme("light");
    expect(env.classes.has("dark")).toBe(false);
    expect(env.values.get("foxgen-theme")).toBe("light");
  });
});