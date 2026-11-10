import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

/** "How can I help you?" returns between every other greeting, so the robot keeps asking it. */
const GREETINGS = [
  "How can I help you?",
  "Hey! Need any help?",
  "How can I help you?",
  "I'm here for you!",
  "How can I help you?",
  "What are you looking for?",
  "How can I help you?",
  "Let's find something amazing!",
];
const FIRST_DELAY = 2500;
const SHOW_MS = 4500;
const HIDE_MS = 7000;

/**
 * Foxgen's cute AI robot (blue and white, little fox ears). Pure SVG + CSS animation: it bounces,
 * sways, turns and tilts its head, blinks, waves and steps. Clicking it opens the existing AI chat.
 * Animations pause while the tab is hidden; reduced motion shows a still robot.
 */
export function AssistantRobot() {
  const [line, setLine] = useState(0);
  const [bubble, setBubble] = useState(false);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (paused) {
      setBubble(false);
      return;
    }
    let showing = false;
    const step = () => {
      showing = !showing;
      if (showing) setBubble(true);
      else {
        setBubble(false);
        setLine((i) => (i + 1) % GREETINGS.length);
      }
      timer.current = window.setTimeout(step, showing ? SHOW_MS : HIDE_MS);
    };
    timer.current = window.setTimeout(step, FIRST_DELAY);
    return () => window.clearTimeout(timer.current);
  }, [paused]);

  return (
    <Link
      to="/chat"
      aria-label="Ask Foxgen AI: open the AI chat"
      title="Ask Foxgen AI"
      data-paused={paused ? "true" : undefined}
      className="robot-root group fixed bottom-3 right-2 z-30 block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:bottom-5 sm:right-4"
    >
      {/* Speech bubble: decorative, never catches clicks meant for the page. */}
      <span
        aria-hidden="true"
        className={`robot-bubble caption-4 sm:caption-1 pointer-events-none absolute bottom-[78%] right-[62%] w-max max-w-[170px] rounded-2xl rounded-br-md border border-border bg-card px-3 py-2 text-foreground shadow-lift transition duration-500 ease-weighted sm:max-w-[200px] ${
          bubble ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-90 opacity-0 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100"
        }`}
      >
        {GREETINGS[line]}
      </span>

      <span className="robot-hover block transition-transform duration-500 ease-weighted group-hover:-translate-y-1 group-hover:scale-105 group-active:scale-95">
        <svg viewBox="0 0 120 140" className="robot-svg block h-auto w-[60px] sm:w-[80px] lg:w-[88px]" aria-hidden="true">
          <defs>
            <linearGradient id="rb-blue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--robot-blue-light)" }} />
              <stop offset="1" style={{ stopColor: "var(--robot-blue)" }} />
            </linearGradient>
            <linearGradient id="rb-white" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--robot-white)" }} />
              <stop offset="1" style={{ stopColor: "var(--robot-white-shade)" }} />
            </linearGradient>
            <linearGradient id="rb-visor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--robot-visor-top)" }} />
              <stop offset="1" style={{ stopColor: "var(--robot-visor)" }} />
            </linearGradient>
          </defs>

          <ellipse className="rb-shadow" cx="60" cy="133" rx="24" ry="4" />

          <g className="rb-sway">
            <g className="rb-bounce">
              {/* Legs and feet */}
              <g className="rb-leg-l">
                <rect x="45" y="106" width="10" height="16" rx="5" fill="url(#rb-blue)" />
                <ellipse cx="49" cy="124" rx="9" ry="5" fill="url(#rb-white)" className="rb-line" />
              </g>
              <g className="rb-leg-r">
                <rect x="65" y="106" width="10" height="16" rx="5" fill="url(#rb-blue)" />
                <ellipse cx="71" cy="124" rx="9" ry="5" fill="url(#rb-white)" className="rb-line" />
              </g>

              {/* Left arm, gentle swing */}
              <g className="rb-arm-l">
                <rect x="24" y="82" width="11" height="24" rx="5.5" fill="url(#rb-blue)" transform="rotate(18 30 84)" />
                <circle cx="25" cy="106" r="6" fill="url(#rb-white)" className="rb-line" />
              </g>
              {/* Right arm, waves now and then */}
              <g className="rb-arm-r">
                <rect x="85" y="82" width="11" height="24" rx="5.5" fill="url(#rb-blue)" transform="rotate(-18 90 84)" />
                <circle cx="95" cy="106" r="6" fill="url(#rb-white)" className="rb-line" />
              </g>

              {/* Body with chest light */}
              <ellipse cx="60" cy="94" rx="27" ry="21" fill="url(#rb-white)" className="rb-line" />
              <ellipse cx="60" cy="97" rx="15" ry="11" fill="url(#rb-blue)" />
              <path d="M54 93 l6 9 l6 -9" fill="none" className="rb-chest" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              <ellipse cx="50" cy="84" rx="8" ry="3" className="rb-gloss" />

              {/* Head */}
              <g className="rb-head">
                {/* Fox ears */}
                <path d="M30 34 L34 8 L52 24 Z" fill="url(#rb-blue)" strokeLinejoin="round" className="rb-ear" />
                <path d="M90 34 L86 8 L68 24 Z" fill="url(#rb-blue)" strokeLinejoin="round" className="rb-ear" />
                <path d="M35 28 L37 15 L46 23 Z" className="rb-ear-inner" />
                <path d="M85 28 L83 15 L74 23 Z" className="rb-ear-inner" />

                <rect x="22" y="20" width="76" height="58" rx="28" fill="url(#rb-white)" className="rb-line" />
                <rect x="30" y="31" width="60" height="36" rx="18" fill="url(#rb-visor)" />
                <g className="rb-eyes">
                  <ellipse className="rb-eye" cx="48" cy="47" rx="6" ry="7.5" />
                  <ellipse className="rb-eye" cx="72" cy="47" rx="6" ry="7.5" />
                  <circle cx="50" cy="44" r="2" className="rb-eye-shine" />
                  <circle cx="74" cy="44" r="2" className="rb-eye-shine" />
                </g>
                <path d="M53 57 Q60 63 67 57" fill="none" className="rb-smile" strokeWidth="2.6" strokeLinecap="round" />
                <ellipse cx="38" cy="59" rx="4" ry="2.4" className="rb-cheek" />
                <ellipse cx="82" cy="59" rx="4" ry="2.4" className="rb-cheek" />
                <ellipse cx="42" cy="26" rx="10" ry="3.5" className="rb-gloss" />
                <circle cx="60" cy="16" r="3.5" className="rb-antenna" />
                <rect x="58.8" y="16" width="2.4" height="5" rx="1.2" fill="url(#rb-blue)" />
              </g>
            </g>
          </g>
        </svg>
      </span>
    </Link>
  );
}
