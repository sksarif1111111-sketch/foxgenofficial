import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ASSISTANT_OPEN_EVENT } from "@/lib/assistant-events";
import { canFall, clampX, hasRoomToFall, pickTarget, robotWidth, walkDuration } from "@/lib/robot-motion";

/** Loaded only when the visitor first opens the chat, so pages stay light. */
const AssistantChatPopup = lazy(() => import("@/components/site/assistant-chat-popup"));

const PRIMARY = "How can I help you?";
const EXTRA = ["Hey there!", "Need a little help?", "I'm here for you!", "Let's find something!"];

type Act = "idle" | "walk" | "look" | "wave" | "stumble" | "fall" | "fallen" | "getup" | "shake" | "greet";
type Token = { cancelled: boolean };

/**
 * Foxgen's little walking robot. It strolls along the bottom of the screen, looks around, waves,
 * and now and then trips, plops down, wiggles back up and asks "How can I help you?".
 * Clicking it opens the chat pop-up; walking pauses while the chat is open, the tab is hidden
 * or the pointer rests on it. Reduced motion keeps a still robot in the corner.
 */
export function AssistantRobot() {
  const layerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const xRef = useRef(0);
  const lastFallRef = useRef<number | null>(null);
  const startedRef = useRef(0);
  const extraRef = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [act, setAct] = useState<Act>("idle");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [bubble, setBubble] = useState<string | null>(null);
  const [align, setAlign] = useState<"left" | "center" | "right">("right");
  const [hidden, setHidden] = useState(false);
  const [hover, setHover] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSide, setChatSide] = useState<"left" | "right">("right");

  /** Move the layer; duration 0 jumps. */
  const moveTo = useCallback((x: number, ms: number) => {
    const el = layerRef.current;
    if (!el) return;
    xRef.current = x;
    el.style.transition = ms > 0 ? `transform ${ms}ms linear` : "none";
    el.style.transform = `translate3d(${x}px,0,0)`;
    const vw = window.innerWidth;
    const centre = x + robotWidth(vw) / 2;
    setAlign(centre < vw * 0.3 ? "left" : centre > vw * 0.7 ? "right" : "center");
  }, []);

  /** Stop wherever the robot is right now (mid-walk included). */
  const freeze = useCallback(() => {
    const el = layerRef.current;
    if (!el) return;
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    moveTo(Number.isFinite(m.m41) ? m.m41 : xRef.current, 0);
  }, [moveTo]);

  // Place it in the bottom-right corner after mount and keep it on screen when the window resizes.
  useEffect(() => {
    startedRef.current = Date.now();
    moveTo(clampX(window.innerWidth, window.innerWidth), 0);
    setMounted(true);
    const onResize = () => moveTo(clampX(xRef.current, window.innerWidth), 0);
    const onVis = () => setHidden(document.hidden);
    const onOpen = () => setChatOpen(true);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpen);
    };
  }, [moveTo]);

  const paused = !mounted || hidden || hover || chatOpen;

  // The little life script.
  useEffect(() => {
    if (paused) return;
    const token: Token = { cancelled: false };
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const t = window.setTimeout(() => (token.cancelled ? reject(new Error("stop")) : resolve()), ms);
        if (token.cancelled) {
          window.clearTimeout(t);
          reject(new Error("stop"));
        }
      });
    const nextExtra = () => {
      // Every other greeting is the main one.
      extraRef.current += 1;
      return extraRef.current % 2 === 1 ? PRIMARY : EXTRA[(extraRef.current >> 1) % EXTRA.length]!;
    };

    const fallSequence = async () => {
      lastFallRef.current = Date.now();
      setBubble(null);
      setAct("stumble");
      await wait(560);
      setAct("fall");
      await wait(620);
      setAct("fallen");
      await wait(1500);
      setAct("getup");
      await wait(780);
      setAct("shake");
      await wait(700);
      setAct("greet");
      setBubble(PRIMARY);
      await wait(3800);
      setBubble(null);
      setAct("idle");
      await wait(900);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const run = async () => {
      if (reduced) {
        moveTo(clampX(window.innerWidth, window.innerWidth), 0);
        await wait(2500);
        for (;;) {
          setBubble(nextExtra());
          await wait(4500);
          setBubble(null);
          await wait(8000);
        }
      }
      setAct("idle");
      await wait(1200);
      for (;;) {
        const vw = window.innerWidth;
        const from = xRef.current;
        const to = pickTarget(from, vw);
        const d: 1 | -1 = to >= from ? 1 : -1;
        const ms = walkDuration(from, to, vw);
        setDir(d);
        setBubble(null);
        setAct("walk");
        moveTo(to, ms);

        // Maybe trip halfway through this walk.
        const tripAt = 0.5 + Math.random() * 0.15;
        const midX = from + (to - from) * tripAt;
        if (canFall(Date.now(), startedRef.current, lastFallRef.current) && hasRoomToFall(midX, d, vw)) {
          await wait(ms * tripAt);
          freeze();
          await fallSequence();
          continue;
        }
        await wait(ms);

        const roll = Math.random();
        if (roll < 0.3) {
          setAct("look");
          await wait(2400);
        } else if (roll < 0.6) {
          setAct("wave");
          setBubble(nextExtra());
          await wait(3200);
          setBubble(null);
        } else {
          setAct("idle");
          await wait(1400 + Math.random() * 1200);
        }
      }
    };
    run().catch(() => undefined);
    return () => {
      token.cancelled = true;
      freeze();
      setAct("idle");
      setBubble(null);
    };
  }, [paused, moveTo, freeze]);

  const closeChat = useCallback(() => {
    setChatOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeChat();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, closeChat]);

  const toggleChat = () => {
    if (!chatOpen) {
      const vw = window.innerWidth;
      setChatSide(xRef.current + robotWidth(vw) / 2 < vw / 2 ? "left" : "right");
    }
    setChatOpen((v) => !v);
  };

  const showBubble = !chatOpen && (bubble !== null || hover);
  const bubbleText = bubble ?? PRIMARY;
  const bubblePos =
    align === "left" ? "left-[30%] rounded-bl-md origin-bottom-left" : align === "right" ? "right-[30%] rounded-br-md origin-bottom-right" : "left-1/2 -translate-x-1/2 origin-bottom";

  return (
    <>
      {chatOpen && (
        <Suspense fallback={null}>
          <AssistantChatPopup onClose={closeChat} side={chatSide} />
        </Suspense>
      )}
      <div
        ref={layerRef}
        data-act={act}
        data-paused={hidden ? "true" : undefined}
        className={`robot-root pointer-events-none fixed bottom-1 left-0 z-30 transition-opacity duration-500 sm:bottom-2 ${mounted ? "opacity-100" : "opacity-0"}`}
      >
        <span
          aria-hidden="true"
          className={`robot-bubble caption-4 sm:caption-1 pointer-events-none absolute bottom-[92%] w-max max-w-[170px] rounded-2xl border border-border bg-card px-3 py-2 text-foreground shadow-lift transition duration-300 ease-weighted sm:max-w-[200px] ${bubblePos} ${
            showBubble ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        >
          {bubbleText}
        </span>
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleChat}
          onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
          onPointerLeave={() => setHover(false)}
          aria-label={chatOpen ? "Close Foxgen AI chat" : "Ask Foxgen AI: open the chat"}
          aria-expanded={chatOpen}
          title="Ask Foxgen AI"
          className="robot-hit pointer-events-auto block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="robot-facing block" style={{ transform: `scaleX(${dir})` }}>
            <RobotSvg />
          </span>
        </button>
      </div>
    </>
  );
}

function RobotSvg() {
  return (
    <svg viewBox="0 0 120 150" className="robot-svg block h-auto w-[58px] sm:w-[84px]" aria-hidden="true">
      <defs>
        <radialGradient id="rb-white" cx="0.35" cy="0.28" r="0.85">
          <stop offset="0" style={{ stopColor: "var(--robot-white)" }} />
          <stop offset="0.7" style={{ stopColor: "var(--robot-white)" }} />
          <stop offset="1" style={{ stopColor: "var(--robot-white-shade)" }} />
        </radialGradient>
        <radialGradient id="rb-blue" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" style={{ stopColor: "var(--robot-blue-light)" }} />
          <stop offset="1" style={{ stopColor: "var(--robot-blue)" }} />
        </radialGradient>
        <linearGradient id="rb-visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--robot-visor-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--robot-visor)" }} />
        </linearGradient>
      </defs>

      <ellipse className="rb-shadow" cx="60" cy="146" rx="22" ry="3.6" />

      {/* Little dust puffs when it lands */}
      <g className="rb-dust">
        <circle cx="96" cy="142" r="4" />
        <circle cx="118" cy="140" r="3" />
        <circle cx="140" cy="143" r="3.6" />
      </g>

      <g className="rb-figure">
        <g className="rb-bob">
          {/* Feet */}
          <g className="rb-leg-l">
            <rect x="46" y="126" width="9" height="11" rx="4.5" fill="url(#rb-white)" className="rb-line" />
            <ellipse cx="50" cy="139" rx="8.5" ry="5" fill="url(#rb-blue)" />
          </g>
          <g className="rb-leg-r">
            <rect x="65" y="126" width="9" height="11" rx="4.5" fill="url(#rb-white)" className="rb-line" />
            <ellipse cx="70" cy="139" rx="8.5" ry="5" fill="url(#rb-blue)" />
          </g>

          {/* Tiny hands */}
          <g className="rb-arm-l">
            <ellipse cx="37" cy="113" rx="6" ry="9.5" fill="url(#rb-blue)" transform="rotate(24 37 113)" />
          </g>
          <g className="rb-arm-r">
            <ellipse cx="83" cy="113" rx="6" ry="9.5" fill="url(#rb-blue)" transform="rotate(-24 83 113)" />
          </g>

          {/* Round body with a glowing heart */}
          <ellipse cx="60" cy="113" rx="21" ry="18" fill="url(#rb-white)" className="rb-line" />
          <ellipse cx="60" cy="117" rx="11.5" ry="9" fill="url(#rb-blue)" />
          <path className="rb-heart" d="M60 122 C54 117.5 54.5 112.5 57.6 112.5 C59 112.5 60 113.6 60 114.6 C60 113.6 61 112.5 62.4 112.5 C65.5 112.5 66 117.5 60 122 Z" />
          <ellipse cx="51" cy="104" rx="6" ry="2.4" className="rb-gloss" />

          {/* Big round head */}
          <g className="rb-head">
            <path d="M23 46 L27 12 L50 30 Z" fill="url(#rb-blue)" strokeLinejoin="round" className="rb-ear" />
            <path d="M97 46 L93 12 L70 30 Z" fill="url(#rb-blue)" strokeLinejoin="round" className="rb-ear" />
            <path d="M29 37 L30 21 L42 30 Z" className="rb-ear-inner" />
            <path d="M91 37 L90 21 L78 30 Z" className="rb-ear-inner" />

            <rect x="58.8" y="14" width="2.4" height="11" rx="1.2" fill="url(#rb-blue)" />
            <circle cx="60" cy="12" r="4.6" className="rb-antenna" />

            <rect x="16" y="22" width="88" height="74" rx="37" fill="url(#rb-white)" className="rb-line" />
            <rect x="26" y="36" width="68" height="48" rx="24" fill="url(#rb-visor)" />

            <g className="rb-eyes">
              <g className="rb-eyes-open">
                <ellipse className="rb-eye" cx="46" cy="59" rx="8.5" ry="10.5" />
                <ellipse className="rb-eye" cx="74" cy="59" rx="8.5" ry="10.5" />
                <circle cx="49" cy="54.5" r="3.2" className="rb-eye-shine" />
                <circle cx="77" cy="54.5" r="3.2" className="rb-eye-shine" />
                <circle cx="43.5" cy="63" r="1.5" className="rb-eye-shine" />
                <circle cx="71.5" cy="63" r="1.5" className="rb-eye-shine" />
              </g>
              <g className="rb-eyes-squint" fill="none" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M40 53 L50 59 L40 65" />
                <path d="M80 53 L70 59 L80 65" />
              </g>
            </g>

            <path className="rb-mouth rb-mouth-smile" d="M55 72 Q60 76.5 65 72" fill="none" strokeWidth="2.6" strokeLinecap="round" />
            <path className="rb-mouth-open" d="M53.5 70.5 Q60 80 66.5 70.5 Z" />
            <ellipse className="rb-mouth-o" cx="60" cy="74" rx="3" ry="3.6" />
            <ellipse cx="34" cy="72" rx="4.5" ry="2.6" className="rb-cheek" />
            <ellipse cx="86" cy="72" rx="4.5" ry="2.6" className="rb-cheek" />
            <ellipse cx="38" cy="30" rx="11" ry="4" className="rb-gloss" transform="rotate(-18 38 30)" />
          </g>
        </g>
      </g>

      {/* Cartoon stars circling its head while it lies on the floor */}
      <g className="rb-stars">
        <path d="M150 92 l2 4.5 4.8 .6 -3.5 3.3 .9 4.8 -4.2 -2.3 -4.2 2.3 .9 -4.8 -3.5 -3.3 4.8 -.6 z" />
        <path d="M168 104 l1.4 3.2 3.4 .4 -2.5 2.3 .6 3.4 -2.9 -1.6 -2.9 1.6 .6 -3.4 -2.5 -2.3 3.4 -.4 z" />
        <path d="M134 106 l1.2 2.7 2.9 .4 -2.1 2 .5 2.9 -2.5 -1.4 -2.5 1.4 .5 -2.9 -2.1 -2 2.9 -.4 z" />
      </g>
    </svg>
  );
}
