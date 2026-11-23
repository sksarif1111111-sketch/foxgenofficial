import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { currentTheme, switchTheme, THEME_EVENT } from "@/lib/theme";

/**
 * Day/night pill: a glowing sun knob rolls across a sky track and turns into a moon; clouds drift
 * away and stars twinkle in. Reads the real theme after mount (no hydration mismatch).
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(currentTheme() === "dark");
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);
  return (
    <Button
      variant="ghost"
      type="button"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        switchTheme(currentTheme() === "dark" ? "light" : "dark", { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      data-on={dark ? "" : undefined}
      className={`theme-switch h-[26px] w-[46px] rounded-full p-0 ${className}`}
    >
      <span aria-hidden="true" className="theme-switch-clouds"><i /><i /></span>
      <span aria-hidden="true" className="theme-switch-stars"><i /><i /><i /><i /></span>
      <span aria-hidden="true" className="theme-switch-knob">
        <span className="theme-switch-sun"><Sun size={11} weight="fill" /></span>
        <span className="theme-switch-moon"><Moon size={11} weight="fill" /></span>
      </span>
    </Button>
  );
}
