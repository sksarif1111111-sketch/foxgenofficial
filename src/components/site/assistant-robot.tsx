import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ASSISTANT_OPEN_EVENT } from "@/lib/assistant-events";
import { canFall, canPoint, clampX, hasRoomToFall, pickTarget, pointDirection, robotWidth, walkDuration } from "@/lib/robot-motion";

/** Loaded only when the visitor first opens the chat, so pages stay light. */
const AssistantChatPopup = lazy(() => import("@/components/site/assistant-chat-popup"));

const PRIMARY = "How can I help you?";
const EXTRA = ["Hey there!", "Need a little help?", "I'm here for you!", "Let's find something!", "Look at my AI tools!"];
const POINT_LINES = ["Look at this!", "Check this one out!", "Have a look!"];

type Act = "idle" | "walk" | "look" | "wave" | "point" | "stumble" | "fall" | "fallen" | "getup" | "shake" | "greet";
const BUSY_ACTS: Act[] = ["stumble", "fall", "fallen", "getup", "shake", "greet"];
type Token = { cancelled: boolean };

/**
 * Foxgen's little walking robot. It strolls along the bottom of the screen, looks around, waves,
 * and now and then trips, plops down, wiggles back up and asks "How can I help you?".
 * When a product card comes into view it stops and points at it with its little finger.
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
  const actRef = useRef<Act>("idle");
  const lastPointRef = useRef<number | null>(null);
  const pendingPointRef = useRef<1 | -1 | null>(null);
  const pointLineRef = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [act, setAct] = useState<Act>("idle");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [bubble, setBubble] = useState<string | null>(null);
  const [align, setAlign] = useState<"left" | "center" | "right">("right");
  const [hidden, setHidden] = useState(false);
  const [hover, setHover] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSide, setChatSide] = useState<"left" | "right">("right");
  const [pointNonce, setPointNonce] = useState(0);
  actRef.current = act;

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
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Watch product cards; when one comes into view, ask the robot to point at it.
  useEffect(() => {
    if (!mounted) return;
    const seen = new WeakSet<Element>();
    const pointed = new WeakSet<Element>();
    /** A product that appeared while the robot was busy; it gets its point once the robot is free. */
    let waiting: Element | null = null;

    const tryPoint = (el: Element) => {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const visible = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < vw;
      if (!visible) return "gone";
      const now = Date.now();
      if (pausedRef.current || BUSY_ACTS.includes(actRef.current) || !canPoint(now, lastPointRef.current)) return "wait";
      pointed.add(el);
      pendingPointRef.current = pointDirection(xRef.current + robotWidth(vw) / 2, r.left + r.width / 2);
      lastPointRef.current = now;
      setPointNonce((n) => n + 1);
      return "done";
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || pointed.has(e.target)) continue;
          if (tryPoint(e.target) === "wait") waiting = e.target;
        }
      },
      { threshold: 0.6 },
    );
    const scan = () => {
      document.querySelectorAll("[data-robot-point]").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
      if (waiting && tryPoint(waiting) !== "wait") waiting = null;
    };
    scan();
    const t = window.setInterval(scan, 1500);
    return () => {
      window.clearInterval(t);
      io.disconnect();
    };
  }, [mounted]);

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
      if (pendingPointRef.current !== null) {
        const d = pendingPointRef.current;
        pendingPointRef.current = null;
        setDir(d);
        setAct("point");
        pointLineRef.current = (pointLineRef.current + 1) % POINT_LINES.length;
        setBubble(POINT_LINES[pointLineRef.current]!);
        await wait(2800);
        setBubble(null);
        setAct("idle");
        await wait(600);
      } else {
        setAct("idle");
        await wait(1200);
      }
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
  }, [paused, pointNonce, moveTo, freeze]);

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
    <svg viewBox="0 0 120 150" className="robot-svg block h-auto w-[62px] sm:w-[90px]" aria-hidden="true">
      <defs>
        <radialGradient id="rb-fur-g" cx="0.4" cy="0.3" r="0.85">
          <stop offset="0" style={{ stopColor: "var(--yeti-fur-light)" }} />
          <stop offset="0.65" style={{ stopColor: "var(--yeti-fur)" }} />
          <stop offset="1" style={{ stopColor: "var(--yeti-fur-shade)" }} />
        </radialGradient>
        <radialGradient id="rb-face-g" cx="0.45" cy="0.35" r="0.8">
          <stop offset="0" style={{ stopColor: "var(--yeti-face-light)" }} />
          <stop offset="1" style={{ stopColor: "var(--yeti-face)" }} />
        </radialGradient>
        <linearGradient id="rb-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--robot-blue-light)" }} />
          <stop offset="1" style={{ stopColor: "var(--robot-blue)" }} />
        </linearGradient>
        <filter id="rb-fur" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="3.2" />
        </filter>
      </defs>

      <ellipse className="rb-shadow" cx="60" cy="146" rx="24" ry="3.6" />

      <g className="rb-dust">
        <circle cx="96" cy="142" r="4" />
        <circle cx="118" cy="140" r="3" />
        <circle cx="140" cy="143" r="3.6" />
      </g>

      {/* Floating music notes from the headphones */}
      <g className="rb-notes">
        <g className="rb-note rb-note-1"><ellipse cx="14" cy="34" rx="3" ry="2.3" transform="rotate(-20 14 34)" /><rect x="16" y="22" width="1.3" height="12" rx="0.6" /></g>
        <g className="rb-note rb-note-2"><ellipse cx="104" cy="22" rx="3" ry="2.3" transform="rotate(-20 104 22)" /><rect x="106" y="10" width="1.3" height="12" rx="0.6" /><path d="M106.6 10 q4 1 4 5" fill="none" strokeWidth="1.3" className="rb-note-flag" /></g>
      </g>

      <g className="rb-figure">
        <g className="rb-bob">
          {/* Stubby fluffy feet */}
          <g className="rb-leg-l">
            <ellipse cx="47" cy="137" rx="10" ry="8" fill="url(#rb-fur-g)" filter="url(#rb-fur)" />
          </g>
          <g className="rb-leg-r">
            <ellipse cx="73" cy="137" rx="10" ry="8" fill="url(#rb-fur-g)" filter="url(#rb-fur)" />
          </g>

          {/* One round fluffy body */}
          <path
            d="M60 12 C84 12 94 30 94 52 C94 64 99 76 99 96 C99 122 84 136 60 136 C36 136 21 122 21 96 C21 76 26 64 26 52 C26 30 36 12 60 12 Z"
            fill="url(#rb-fur-g)"
            filter="url(#rb-fur)"
          />

          <g className="rb-head">
            {/* Face window */}
            <ellipse cx="60" cy="52" rx="24" ry="21" fill="url(#rb-face-g)" />
            <ellipse cx="51" cy="40" rx="8" ry="3" className="rb-gloss" transform="rotate(-12 51 40)" />

            <g className="rb-eyes">
              <g className="rb-eyes-open">
                <ellipse className="rb-eye" cx="50" cy="52" rx="3.3" ry="3.8" />
                <ellipse className="rb-eye" cx="70" cy="52" rx="3.3" ry="3.8" />
                <circle cx="51.2" cy="50.6" r="1.1" className="rb-eye-shine" />
                <circle cx="71.2" cy="50.6" r="1.1" className="rb-eye-shine" />
              </g>
              <g className="rb-eyes-squint" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M47 49 L52 52 L47 55" />
                <path d="M73 49 L68 52 L73 55" />
              </g>
            </g>
            <path className="rb-mouth rb-mouth-smile" d="M56 60 Q60 63.5 64 60" fill="none" strokeWidth="1.8" strokeLinecap="round" />
            <path className="rb-mouth-open" d="M55.5 59 Q60 66 64.5 59 Z" />
            <ellipse className="rb-mouth-o" cx="60" cy="61" rx="2.2" ry="2.6" />
            <ellipse cx="43" cy="59" rx="4.6" ry="2.8" className="rb-cheek" />
            <ellipse cx="77" cy="59" rx="4.6" ry="2.8" className="rb-cheek" />

            {/* Headphones */}
            <path d="M28 50 C28 18 92 18 92 50" fill="none" stroke="url(#rb-blue)" strokeWidth="5" strokeLinecap="round" />
            <path d="M33 34 C42 22 78 22 87 34" fill="none" className="rb-band-shine" strokeWidth="1.4" strokeLinecap="round" />
            <rect x="20" y="42" width="13" height="22" rx="6.5" fill="url(#rb-blue)" />
            <rect x="87" y="42" width="13" height="22" rx="6.5" fill="url(#rb-blue)" />
            <rect x="23" y="46" width="3" height="13" rx="1.5" className="rb-cup-shine" />
            <rect x="90" y="46" width="3" height="13" rx="1.5" className="rb-cup-shine" />
          </g>

          {/* The AI tool it shows off; icons take turns */}
          <g className="rb-tool">
            <circle cx="60" cy="100" r="17" fill="url(#rb-blue)" />
            <circle cx="60" cy="100" r="17" className="rb-tool-ring" fill="none" strokeWidth="1.2" />
            <g className="rb-tool-icon rb-tool-1" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M50 94 h20 a3 3 0 0 1 3 3 v8 a3 3 0 0 1 -3 3 h-12 l-5 4 v-4 h-3 a3 3 0 0 1 -3 -3 v-8 a3 3 0 0 1 3 -3 z" />
              <circle cx="55" cy="101" r="0.6" /><circle cx="60" cy="101" r="0.6" /><circle cx="65" cy="101" r="0.6" />
            </g>
            <g className="rb-tool-icon rb-tool-2">
              <path d="M60 88 C61.5 96 64 98.5 72 100 C64 101.5 61.5 104 60 112 C58.5 104 56 101.5 48 100 C56 98.5 58.5 96 60 88 Z" />
              <path d="M70 89 c.5 2.5 1.2 3.2 3.6 3.6 c-2.4 .4 -3.1 1.1 -3.6 3.6 c-.5 -2.5 -1.2 -3.2 -3.6 -3.6 c2.4 -.4 3.1 -1.1 3.6 -3.6 z" />
            </g>
            <g className="rb-tool-icon rb-tool-3" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M54 93 L47 100 L54 107" /><path d="M66 93 L73 100 L66 107" /><path d="M62.5 91 L57.5 109" />
            </g>
            <g className="rb-tool-icon rb-tool-4" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="48" y="91" width="24" height="18" rx="3.5" />
              <path d="M49 106 L56 99 L61 104 L64 101 L71 108" /><circle cx="66" cy="96" r="2" />
            </g>
          </g>

          {/* Fluffy arms hugging the tool */}
          <g className="rb-arm-l">
            <ellipse cx="40" cy="101" rx="10" ry="12" fill="url(#rb-fur-g)" filter="url(#rb-fur)" transform="rotate(30 40 101)" />
          </g>
          <g className="rb-arm-r">
            <ellipse cx="80" cy="101" rx="10" ry="12" fill="url(#rb-fur-g)" filter="url(#rb-fur)" transform="rotate(-30 80 101)" />
            <ellipse className="rb-finger" cx="88" cy="114" rx="3" ry="5.5" fill="url(#rb-fur-g)" transform="rotate(-24 88 114)" />
          </g>
        </g>
      </g>

      <g className="rb-stars">
        <g transform="translate(0 -52)">
        <path d="M150 92 l2 4.5 4.8 .6 -3.5 3.3 .9 4.8 -4.2 -2.3 -4.2 2.3 .9 -4.8 -3.5 -3.3 4.8 -.6 z" />
        <path d="M168 104 l1.4 3.2 3.4 .4 -2.5 2.3 .6 3.4 -2.9 -1.6 -2.9 1.6 .6 -3.4 -2.5 -2.3 3.4 -.4 z" />
        <path d="M134 106 l1.2 2.7 2.9 .4 -2.1 2 .5 2.9 -2.5 -1.4 -2.5 1.4 .5 -2.9 -2.1 -2 2.9 -.4 z" />
        </g>
      </g>
    </svg>
  );
}
