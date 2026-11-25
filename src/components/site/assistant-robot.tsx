import { lazy, Suspense, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { ASSISTANT_OPEN_EVENT, ASSISTANT_SIGNAL_EVENT, type AssistantSignal } from "@/lib/assistant-events";
import { avoidSpans, canChat, canFall, canPoint, clampX, gaitPose, pickTarget, pointDirection, reachableTarget, ROBOT_MOTION, robotWidth, wanderTarget } from "@/lib/robot-motion";

import foxyFull from "@/assets/foxy-full.webp.asset.json";
import { FOXY_3D, type FoxyAct, type FoxyFace, type FoxyRenderState } from "@/lib/foxy-pose";
const FoxyModel = lazy(() => import("@/components/site/foxy-model"));

/** Loaded only when the visitor first opens the chat, so pages stay light. */
const AssistantChatPopup = lazy(() => import("@/components/site/assistant-chat-popup"));

const HOVER_LINE = "Hi! Need help? 💙";
const HELLO = "Hi, I'm Foxy! What can I help you with?";
const LINES = [HELLO, "Need help choosing? 💙", "Ask me anything!", "Instant delivery after approval ⚡"];
const POINT_LINE = "This one is popular! 👀";
const PRODUCT_LINE = "Want to know more about this? Ask me!";
const CHECKOUT_LINE = "After payment, upload your screenshot + transaction ID. I'll keep it safe! 📸";
const SPLASH_LINE = "Oops! I'm okay 😄 How can I help you?";
const DIZZY_LINE = "Whoa… so dizzy!";
const MINI_KEY = "foxy-minimized";
const FALL_KEY = "foxy-last-drop";
const START_KEY = "foxy-started";

type Act = FoxyAct;
type Face = FoxyFace;
const BUSY_ACTS: Act[] = ["turn", "held", "land", "drop", "splash", "puddle", "reform", "dizzy", "tail", "juggle", "peek"];
/** Dropped by hand from higher than this (px) it splashes into water and reforms. */
const SPLASH_DROP = 200;
/** Dropped by hand from higher than this (px) it lands dizzy. */
const DIZZY_DROP = 90;
type Token = { cancelled: boolean };

const AVOID_SELECTOR = "[data-robot-avoid], button[type=submit]";

function readNum(storage: Storage, key: string) {
  const v = Number(storage.getItem(key));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Horizontal spans of buttons near the bottom of the screen that Foxy must never cover. */
function blockedSpans(): Array<[number, number]> {
  const vh = window.innerHeight;
  const out: Array<[number, number]> = [];
  document.querySelectorAll(AVOID_SELECTOR).forEach((el) => {
    if (el.closest(".robot-root, .assistant-pop, [data-robot-floor]")) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.bottom < vh - ROBOT_MOTION.avoidBand || r.top > vh) return;
    out.push([r.left, r.right]);
  });
  return out;
}

/**
 * Foxy, FOXGEN's baby fox-robot. It waddles along the bottom of the screen, blinks, follows the cursor
 * with its eyes, points at products, sometimes drops in from the top and splashes into jelly-water before
 * popping back. Clicking it opens the chat pop-up; motion pauses while the chat is open, the tab is hidden,
 * the pointer rests on it or it is asleep. Reduced motion (and low-end devices for the drop) keep it calm.
 */
export function AssistantRobot() {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const xRef = useRef(0);
  const yRef = useRef(0);
  const dirRef = useRef<1 | -1>(-1);
  const dragRef = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const lastFallRef = useRef<number | null>(null);
  const startedRef = useRef(0);
  const lineRef = useRef(0);
  const lastBubbleRef = useRef<number | null>(null);
  const actRef = useRef<Act>("idle");
  const lastPointRef = useRef<number | null>(null);
  const pendingPointRef = useRef<1 | -1 | null>(null);
  const pendingWaveRef = useRef<string | null>(HELLO);
  const lastInteractRef = useRef(Date.now());
  const manualRef = useRef(0);
  const clickTimerRef = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [mini, setMini] = useState(false);
  const [act, setAct] = useState<Act>("idle");
  const [dir, setDirState] = useState<1 | -1>(-1);
  const [bubble, setBubble] = useState<string | null>(null);
  const [align, setAlign] = useState<"left" | "center" | "right">("right");
  const [hidden, setHidden] = useState(false);
  const [hover, setHover] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSide, setChatSide] = useState<"left" | "right">("right");
  const [nonce, setNonce] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [blink, setBlink] = useState(false);
  const [press, setPress] = useState(false);
  const [nod, setNod] = useState(false);
  const [faceOverride, setFaceOverride] = useState<Face | null>(null);
  const [burst, setBurst] = useState<{ kind: "hearts" | "sparkles"; id: number } | null>(null);
  const [reduced, setReduced] = useState(false);
  const [clearance, setClearance] = useState(false);
  const renderRef = useRef<FoxyRenderState>({
    act: "idle", face: "normal", dir: -1, blink: false, nod: false, hover: false,
    reduced: false, hidden: false, press: false, gaze: { x: 0, y: 0 }, gait: gaitPose(0, 1),
  });
  actRef.current = act;

  const setDir = useCallback((d: 1 | -1) => {
    dirRef.current = d;
    setDirState(d);
  }, []);

  const pop = useCallback((kind: "hearts" | "sparkles") => {
    const id = Date.now();
    setBurst({ kind, id });
    window.setTimeout(() => setBurst((b) => (b?.id === id ? null : b)), 1300);
  }, []);

  /** Move the layer; duration 0 jumps. */
  const moveTo = useCallback((x: number, ms: number, y = 0) => {
    const el = layerRef.current;
    if (!el) return;
    xRef.current = x;
    yRef.current = y;
    el.style.transition = ms > 0 ? `transform ${ms}ms linear` : "none";
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
    const vw = window.innerWidth;
    const centre = x + robotWidth(vw) / 2;
    setAlign(centre < vw * 0.3 ? "left" : centre > vw * 0.7 ? "right" : "center");
  }, []);

  /** Stop wherever Foxy is right now (mid-walk included). */
  const freeze = useCallback(() => {
    const el = layerRef.current;
    if (!el) return;
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    moveTo(Number.isFinite(m.m41) ? m.m41 : xRef.current, 0, Number.isFinite(m.m42) ? m.m42 : yRef.current);
  }, [moveTo]);

  // Mount: corner spot, remembered minimise choice, tab/resize/open listeners.
  useEffect(() => {
    const now = Date.now();
    startedRef.current = readNum(sessionStorage, START_KEY) ?? now;
    sessionStorage.setItem(START_KEY, String(startedRef.current));
    lastFallRef.current = readNum(sessionStorage, FALL_KEY);
    if (startedRef.current !== now) pendingWaveRef.current = null;
    setMini(localStorage.getItem(MINI_KEY) === "1");
    moveTo(avoidSpans(window.innerWidth, window.innerWidth, blockedSpans()), 0);
    setMounted(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      setReduced(media.matches);
      if (media.matches) {
        manualRef.current += 1;
        setDragging(false);
        setBlink(false);
        moveTo(xRef.current, 0);
        setAct("idle");
      }
    };
    onMotion();
    media.addEventListener("change", onMotion);
    const onResize = () => moveTo(clampX(xRef.current, window.innerWidth), 0);
    const onVis = () => {
      setHidden(document.hidden);
      if (document.hidden) {
        manualRef.current += 1;
        setDragging(false);
        setNod(false);
      }
      if (!document.hidden) pendingWaveRef.current = "Welcome back! 💙";
    };
    const onOpen = () => {
      manualRef.current += 1;
      freeze();
      moveTo(xRef.current, 0);
      setDragging(false);
      setSleeping(false);
      setMini(false);
      setChatSide(xRef.current + robotWidth(window.innerWidth) / 2 < window.innerWidth / 2 ? "left" : "right");
      setChatOpen(true);
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(ASSISTANT_OPEN_EVENT, onOpen);
    return () => {
      manualRef.current += 1;
      window.clearTimeout(clickTimerRef.current);
      media.removeEventListener("change", onMotion);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(ASSISTANT_OPEN_EVENT, onOpen);
    };
  }, [moveTo, freeze]);

  // Eyes follow the mouse (a few px, clamped); moving near wakes a sleeping Foxy.
  useEffect(() => {
    if (!mounted) return;
    let raf = 0;
    let last: { x: number; y: number } | null = null;
    const apply = () => {
      raf = 0;
      const root = layerRef.current;
      const btn = buttonRef.current;
      if (!root || !btn || !last) return;
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.42;
      const dx = last.x - cx;
      const dy = last.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 220);
      renderRef.current.gaze = { x: (dx / dist) * 2.4 * k, y: (dy / dist) * 2 * k };
      root.style.setProperty("--ex", `${((dx / dist) * 2.4 * k * dirRef.current).toFixed(2)}px`);
      root.style.setProperty("--ey", `${((dy / dist) * 2 * k).toFixed(2)}px`);
      if (dist < 240) {
        lastInteractRef.current = Date.now();
        setSleeping((s) => {
          if (s) {
            pendingWaveRef.current = HOVER_LINE;
            setNonce((n) => n + 1);
          }
          return false;
        });
      }
    };
    const onMove = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== "mouse") {
        lastInteractRef.current = Date.now();
        setSleeping(false);
        return;
      }
      last = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onKey = () => {
      lastInteractRef.current = Date.now();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("keydown", onKey);
    const sleepTimer = window.setInterval(() => {
      if (Date.now() - lastInteractRef.current >= ROBOT_MOTION.sleepAfterMs && !BUSY_ACTS.includes(actRef.current)) setSleeping(true);
    }, 5000);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("keydown", onKey);
      window.clearInterval(sleepTimer);
    };
  }, [mounted]);

  // Natural blinking every 3–6 s, sometimes a double blink.
  useEffect(() => {
    if (!mounted || hidden || reduced) return;
    let t = 0;
    const timers: number[] = [];
    const schedule = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        timers.push(window.setTimeout(() => setBlink(false), 140));
        if (Math.random() < 0.25) {
          timers.push(window.setTimeout(() => setBlink(true), 280));
          timers.push(window.setTimeout(() => setBlink(false), 420));
        }
        schedule();
      }, 3000 + Math.random() * 3000);
    };
    schedule();
    return () => { window.clearTimeout(t); timers.forEach(window.clearTimeout); setBlink(false); };
  }, [mounted, hidden, reduced]);

  // Chat cues: hearts when a message is sent, nodding while the AI types, happy when it answers.
  useEffect(() => {
    const onSignal = (e: Event) => {
      const s = (e as CustomEvent<AssistantSignal>).detail;
      if (s === "love") pop("hearts");
      if (s === "typing") setNod(true);
      if (s === "answered") {
        setNod(false);
        setFaceOverride("happy");
        window.setTimeout(() => setFaceOverride(null), 2000);
      }
    };
    window.addEventListener(ASSISTANT_SIGNAL_EVENT, onSignal);
    return () => window.removeEventListener(ASSISTANT_SIGNAL_EVENT, onSignal);
  }, [pop]);

  const paused = !mounted || mini || hidden || hover || chatOpen || dragging || sleeping;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Watch product cards (point at them), checkout buttons (step aside) and finished orders (hearts).
  useEffect(() => {
    if (!mounted) return;
    const seen = new WeakSet<Element>();
    const pointed = new WeakSet<Element>();
    let waiting: Element | null = null;
    let doneSeen = false;

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
      setNonce((n) => n + 1);
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
      let floor = 0;
      document.querySelectorAll("[data-robot-floor]").forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.bottom >= window.innerHeight - 2) floor = Math.max(floor, window.innerHeight - rect.top);
      });
      document.documentElement.style.setProperty("--foxy-floor", `${floor}px`);
      document.querySelectorAll("[data-robot-point]").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
      if (waiting && tryPoint(waiting) !== "wait") waiting = null;
      // Step aside when a "Place order" / "Pay" button ends up under Foxy.
      const vw = window.innerWidth;
      const blocked = blockedSpans();
      const free = avoidSpans(xRef.current, vw, blocked);
      setClearance(blocked.some(([l, r]) => free < r + 8 && free + robotWidth(vw) > l - 8));
      if (Math.abs(free - xRef.current) > 2 && !BUSY_ACTS.includes(actRef.current) && !dragRef.current && !chatOpen) {
        freeze();
        moveTo(free, 0, yRef.current);
        setNonce((n) => n + 1);
      }
      const done = !!document.querySelector("[data-foxy-done]");
      if (done && !doneSeen) pop("hearts");
      doneSeen = done;
    };
    scan();
    const t = window.setInterval(scan, 1200);
    return () => {
      window.clearInterval(t);
      io.disconnect();
      document.documentElement.style.removeProperty("--foxy-floor");
    };
  }, [mounted, moveTo, freeze, pop, chatOpen]);

  // The little life script.
  useEffect(() => {
    if (paused) return;
    const token: Token = { cancelled: false };
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        if (token.cancelled) return reject(new Error("stop"));
        window.setTimeout(() => (token.cancelled ? reject(new Error("stop")) : resolve()), ms);
      });
    const say = async (text: string, ms: number) => {
      lastBubbleRef.current = Date.now();
      setBubble(text);
      await wait(ms);
      setBubble(null);
    };
    const nextLine = () => {
      if (document.querySelector('[data-robot-avoid="pay"]')) return CHECKOUT_LINE;
      if (window.location.pathname.startsWith("/product/") && lineRef.current % 2 === 0) {
        lineRef.current += 1;
        return PRODUCT_LINE;
      }
      lineRef.current += 1;
      return LINES[lineRef.current % LINES.length] ?? HELLO;
    };
    /** Soft hop turn: squash, hop, mirror while small at the top, land. Never a thin spin. */
    const turnTo = async (d: 1 | -1) => {
      if (d === dirRef.current) return;
      setAct("turn");
      await wait(150);
      setDir(d);
      await wait(160);
    };
    const gravity = (fromY: number) =>
      new Promise<void>((resolve) => {
        let v = 0;
        let y = fromY;
        let last = performance.now();
        const step = (t: number) => {
          if (token.cancelled) return resolve();
          const dt = Math.min((t - last) / 1000, 0.05);
          last = t;
          v += 2600 * dt;
          y = Math.min(0, y + v * dt);
          moveTo(xRef.current, 0, y);
          if (y >= 0) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });

    /** Signature move: drop from the top, splash into jelly-water, reform with a springy bounce. */
    const dropIn = async () => {
      lastFallRef.current = Date.now();
      sessionStorage.setItem(FALL_KEY, String(lastFallRef.current));
      setBubble(null);
      const vw = window.innerWidth;
      const x = avoidSpans(pickTarget(xRef.current, vw), vw, blockedSpans());
      setAct("drop");
      moveTo(x, 0, -(window.innerHeight + 40));
      await wait(30);
      await gravity(yRef.current);
      setAct("splash");
      await wait(560);
      setAct("puddle");
      await wait(420);
      setAct("reform");
      await wait(640);
      setAct("dizzy");
      await wait(1000);
      setAct("wave");
      setFaceOverride("happy");
      await say(SPLASH_LINE, 3600);
      setFaceOverride(null);
      setAct("idle");
      await wait(700);
    };

    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowEnd = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2;

    const run = async () => {
      if (reduced) {
        setAct("idle");
        moveTo(avoidSpans(window.innerWidth, window.innerWidth, blockedSpans()), 0);
        await wait(2500);
        for (;;) {
          await say(nextLine(), 4500);
          await wait(ROBOT_MOTION.bubbleGapMs);
        }
      }
      if (pendingWaveRef.current) {
        const line = pendingWaveRef.current;
        pendingWaveRef.current = null;
        setAct("wave");
        setFaceOverride("happy");
        await say(line, 2800);
        setFaceOverride(null);
      } else if (pendingPointRef.current !== null) {
        const d = pendingPointRef.current;
        pendingPointRef.current = null;
        await turnTo(d);
        setAct("point");
        if (canChat(Date.now(), lastBubbleRef.current)) await say(window.location.pathname.startsWith("/product/") ? PRODUCT_LINE : POINT_LINE, 2800);
        else await wait(2400);
      }
      setAct("idle");
      await wait(1000);
      for (;;) {
        const vw = window.innerWidth;
        if (!lowEnd && canFall(Date.now(), startedRef.current, lastFallRef.current)) {
          await dropIn();
          continue;
        }
        const from = xRef.current;
        const to = reachableTarget(from, wanderTarget(from, vw), vw, blockedSpans());
        if (Math.abs(to - from) > 4) {
          const d: 1 | -1 = to >= from ? 1 : -1;
          await turnTo(d);
          const distance = Math.abs(to - from);
          const stride = robotWidth(vw) * FOXY_3D.strideRatio;
          const ms = Math.max(FOXY_3D.walkCycleMs, Math.ceil(distance / stride) * FOXY_3D.walkCycleMs);
          setAct("walk");
          // Distance-driven paw planting: travel, feet, head and tail share one clock.
          await new Promise<void>((resolve) => {
            const start = performance.now();
            const step = (now: number) => {
              if (token.cancelled) return resolve();
              const p = Math.min(1, (now - start) / ms);
              const eased = p * p * (3 - 2 * p);
              const travelled = distance * eased;
              const pose = gaitPose(travelled, stride);
              renderRef.current.gait = pose;
              const el = layerRef.current;
              if (el) {
                for (const [name, value] of Object.entries({ "--gait-bob": pose.bob, "--gait-lean": pose.lean, "--paw-l-x": pose.left.x, "--paw-l-y": pose.left.y, "--paw-l-angle": pose.left.angle, "--paw-r-x": pose.right.x, "--paw-r-y": pose.right.y, "--paw-r-angle": pose.right.angle })) {
                  el.style.setProperty(name, `${value}${name.endsWith("angle") || name.endsWith("lean") ? "deg" : "px"}`);
                }
              }
              moveTo(from + (to - from) * eased, 0);
              if (p < 1) requestAnimationFrame(step);
              else resolve();
            };
            requestAnimationFrame(step);
          });
          if (token.cancelled) return;
          setAct("land");
          await wait(340);
        }
        const roll = Math.random();
        if (roll < 0.06) {
          // A curious sniff and ear twitch, rather than repeated abrupt mirror flips.
          setAct("sniff");
          setFaceOverride("curious");
          await wait(1800);
          setFaceOverride(null);
        } else if (roll < 0.12) {
          setAct("juggle");
          await wait(2400);
        } else if (roll < 0.16) {
          setAct("peek");
          await wait(2200);
        } else if (roll < 0.45 && canChat(Date.now(), lastBubbleRef.current)) {
          setAct("wave");
          await say(nextLine(), 3200);
        } else {
          setAct("idle");
          await wait(2200 + Math.random() * 2000);
        }
      }
    };
    run().catch(() => undefined);
    return () => {
      token.cancelled = true;
      freeze();
      if (yRef.current !== 0 && !dragRef.current && !dragging) moveTo(xRef.current, 0, 0);
      setAct("idle");
      setBubble(null);
      setFaceOverride(null);
    };
  }, [paused, nonce, moveTo, freeze, setDir, reduced, dragging]);

  // While the chat is open Foxy sits beside it.
  useEffect(() => {
    if (chatOpen) setAct("sit");
    else setNod(false);
  }, [chatOpen]);

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

  /** Let go: fall with gravity; small drops squash, medium ones get dizzy, big ones splash into water. */
  const drop = useCallback(() => {
    const height = -yRef.current;
    const id = ++manualRef.current;
    const alive = () => manualRef.current === id;
    const later = (ms: number) => new Promise<void>((resolve, reject) => window.setTimeout(() => alive() ? resolve() : reject(new Error("cancelled")), ms));
    const fall = () =>
      new Promise<void>((resolve) => {
        if (reduced || height <= 0) {
          moveTo(xRef.current, 0, 0);
          return resolve();
        }
        let v = 0;
        let last = performance.now();
        const step = (t: number) => {
          if (!alive()) return resolve();
          const dt = Math.min((t - last) / 1000, 0.05);
          last = t;
          v += 2600 * dt;
          const y = Math.min(0, yRef.current + v * dt);
          moveTo(xRef.current, 0, y);
          if (y >= 0) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    void (async () => {
      setBubble(null);
      if (height > DIZZY_DROP && !reduced) setAct("drop");
      await fall();
      if (!alive()) return;
      if (height > SPLASH_DROP && !reduced) {
        setAct("splash");
        await later(560);
        setAct("puddle");
        await later(420);
        setAct("reform");
        await later(640);
        setAct("dizzy");
        await later(1000);
        setAct("wave");
        setBubble(SPLASH_LINE);
        await later(3000);
      } else if (height > DIZZY_DROP && !reduced) {
        setAct("land");
        await later(320);
        setAct("dizzy");
        setBubble(DIZZY_LINE);
        await later(1800);
      } else {
        setAct("land");
        await later(360);
      }
      setBubble(null);
      setAct("idle");
      moveTo(avoidSpans(xRef.current, window.innerWidth, blockedSpans()), 400);
      setDragging(false);
    })().catch(() => undefined);
  }, [moveTo, reduced]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    manualRef.current += 1;
    freeze();
    dragRef.current = { px: e.clientX, py: e.clientY, x: xRef.current, y: yRef.current, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 7) return;
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
      setHover(false);
      window.setTimeout(() => { if (dragRef.current?.moved) setAct("held"); }, 0);
      setBubble(null);
    }
    const vw = window.innerWidth;
    const w = robotWidth(vw);
    const x = Math.min(vw - w - 4, Math.max(4, d.x + dx));
    const y = Math.min(0, Math.max(-(window.innerHeight - w * 1.5), d.y + dy));
    moveTo(x, 0, y);
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d?.moved) return;
    suppressClickRef.current = true;
    drop();
  };

  const toggleChat = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    lastInteractRef.current = Date.now();
    manualRef.current += 1;
    freeze();
    moveTo(xRef.current, 0);
    setDragging(false);
    setSleeping(false);
    if (chatOpen) {
      setChatOpen(false);
      return;
    }
    const vw = window.innerWidth;
    setChatSide(xRef.current + robotWidth(vw) / 2 < vw / 2 ? "left" : "right");
    setPress(true);
    pop("sparkles");
    window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      setPress(false);
      setChatOpen(true);
    }, 260);
  };

  const minimise = (value: boolean) => {
    manualRef.current += 1;
    window.clearTimeout(clickTimerRef.current);
    freeze();
    moveTo(xRef.current, 0);
    setDragging(false);
    setMini(value);
    setChatOpen(false);
    localStorage.setItem(MINI_KEY, value ? "1" : "0");
  };

  const face: Face =
    faceOverride ??
    (sleeping
      ? "sleepy"
      : act === "dizzy" || act === "reform"
        ? "dizzy"
        : act === "drop" || act === "held"
          ? "surprised"
          : hover || (chatOpen && !nod)
            ? "happy"
            : act === "point"
              ? "curious"
              : "normal");

  Object.assign(renderRef.current, { act, face, dir, blink, nod, hover, reduced, hidden, press });

  const showBubble = !chatOpen && !mini && (bubble !== null || hover);
  const bubbleText = bubble ?? HOVER_LINE;
  const bubblePos =
    align === "left" ? "left-[22%] foxy-bubble-left" : align === "right" ? "right-[22%] foxy-bubble-right" : "left-1/2 -translate-x-1/2 foxy-bubble-center";

  if (mini && mounted) {
    return (
      <button
        type="button"
        onClick={() => minimise(false)}
        aria-label="Show Foxy, the FOXGEN assistant"
        title="Show Foxy"
        className="foxy-mini pointer-events-auto fixed bottom-3 right-3 z-30 flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MiniFace />
      </button>
    );
  }

  return (
    <>
      {chatOpen && (
        <Suspense fallback={null}>
          <AssistantChatPopup onClose={closeChat} side={chatSide} />
        </Suspense>
      )}
      <div ref={rootRef} className="contents">
        <div
          ref={layerRef}
          data-act={act}
          data-face={face}
          data-blink={blink && face === "normal" ? "true" : undefined}
          data-hover={hover ? "true" : undefined}
          data-press={press ? "true" : undefined}
          data-nod={nod && chatOpen ? "true" : undefined}
          data-paused={hidden ? "true" : undefined}
          data-clearance={clearance ? "true" : undefined}
          className={`robot-root group pointer-events-none fixed bottom-1 left-0 z-30 transition-opacity duration-500 sm:bottom-2 ${mounted ? "opacity-100" : "opacity-0"}`}
        >
          <span
            aria-hidden="true"
            className={`foxy-bubble caption-4 sm:caption-1 pointer-events-none absolute bottom-[96%] w-max max-w-[180px] px-3 py-2 text-foreground sm:max-w-[220px] ${bubblePos} ${showBubble ? "foxy-bubble-on" : ""}`}
          >
            {bubbleText}
          </span>
          <button
            type="button"
            onClick={() => minimise(true)}
            aria-label="Hide Foxy"
            title="Hide Foxy"
            className="foxy-hide pointer-events-auto absolute -top-1 right-0 z-10 flex size-5 items-center justify-center rounded-full text-[11px] leading-none focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ×
          </button>
          <button
            ref={buttonRef}
            type="button"
            onClick={toggleChat}
            onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
            onPointerLeave={() => setHover(false)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label={chatOpen ? "Close FOXGEN assistant" : "Open FOXGEN assistant"}
            aria-expanded={chatOpen}
            title="Ask Foxy"
            className="robot-hit pointer-events-auto block touch-none select-none rounded-[40%] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="foxy-3d-stage block">
              {mounted && <Suspense fallback={<img src={foxyFull.url} className="foxy-model-fallback" alt="" />}>
                <FoxyModel stateRef={renderRef} reduced={reduced} hidden={hidden} poseKey={`${act}:${face}:${blink}:${nod}:${dir}:${reduced}`} />
              </Suspense>}
              <FoxySvg burst={burst} />
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

const DROPS: Array<[number, number, number]> = [
  [-34, -30, 4.2], [-22, -44, 3.4], [-8, -52, 3], [10, -48, 3.6], [24, -40, 3.2], [36, -26, 4], [-44, -12, 3], [46, -10, 3.4],
];

function FoxySvg({ burst }: { burst: { kind: "hearts" | "sparkles"; id: number } | null }) {
  return (
    <svg viewBox="0 0 120 140" className="robot-svg block h-auto w-[68px] sm:w-[88px]" aria-hidden="true">
      <defs>
        <radialGradient id="fx-shell" cx="0.38" cy="0.28" r="0.85">
          <stop offset="0" style={{ stopColor: "var(--foxy-shell-light)" }} />
          <stop offset="0.6" style={{ stopColor: "var(--foxy-shell)" }} />
          <stop offset="1" style={{ stopColor: "var(--foxy-shell-shade)" }} />
        </radialGradient>
        <radialGradient id="fx-visor" cx="0.4" cy="0.25" r="0.9">
          <stop offset="0" style={{ stopColor: "var(--foxy-visor-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--foxy-visor)" }} />
        </radialGradient>
        <linearGradient id="fx-brand" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--foxy-cyan)" }} />
          <stop offset="1" style={{ stopColor: "var(--foxy-violet)" }} />
        </linearGradient>
        <linearGradient id="fx-tail" x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0" style={{ stopColor: "var(--foxy-shell)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--foxy-shell)" }} />
          <stop offset="0.75" style={{ stopColor: "var(--foxy-cyan)" }} />
          <stop offset="1" style={{ stopColor: "var(--foxy-violet)" }} />
        </linearGradient>
        <radialGradient id="fx-jelly" cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" style={{ stopColor: "var(--foxy-cyan)", stopOpacity: 0.95 }} />
          <stop offset="1" style={{ stopColor: "var(--foxy-violet)", stopOpacity: 0.85 }} />
        </radialGradient>
        <filter id="fx-goo" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="b" />
          <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="g" />
          <feComposite in="SourceGraphic" in2="g" operator="atop" />
        </filter>
      </defs>

      <ellipse className="fx-glow" cx="60" cy="134" rx="34" ry="6" />
      <ellipse className="fx-shadow" cx="60" cy="134" rx="26" ry="4" />
      <ellipse className="fx-ripple" cx="60" cy="132" rx="20" ry="4" />

      {/* Splash: gooey jelly-water blob and droplets */}
      <g className="fx-liquid" filter="url(#fx-goo)">
        <ellipse className="fx-blob" cx="60" cy="126" rx="26" ry="10" fill="url(#fx-jelly)" />
        {DROPS.map(([dx, dy, r], i) => (
          <circle key={i} className="fx-drop" cx="60" cy="124" r={r} fill="url(#fx-jelly)" style={{ ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px`, animationDelay: `${i * 18}ms` }} />
        ))}
      </g>
      <ellipse className="fx-blob-shine" cx="52" cy="122" rx="8" ry="2.4" />

      <g className="fx-dust">
        <circle cx="44" cy="132" r="3" />
        <circle cx="38" cy="130" r="2.2" />
      </g>

      <g className="fx-stars"><g className="fx-stars-spin">
        {[-26, 0, 26].map((x) => <path key={x} d="M60 12 l1.6 3.3 3.6 .4 -2.7 2.4 .8 3.6 -3.3 -1.8 -3.3 1.8 .8 -3.6 -2.7 -2.4 3.6 -.4 z" transform={`translate(${x} -8)`} />)}
      </g></g>
      <g className="fx-zzz"><text x="90" y="26">z</text><text x="98" y="16" className="fx-z2">z</text></g>

      {burst && (
        <g key={burst.id} className={`fx-burst fx-burst-${burst.kind}`}>
          {[-30, -12, 8, 26].map((dx, i) =>
            burst.kind === "hearts" ? (
              <path key={i} className="fx-burst-item" style={{ ["--dx" as string]: `${dx}px`, animationDelay: `${i * 90}ms` }} d="M60 40 C55 36 53 32.5 56 30.6 C57.8 29.5 59.4 30.6 60 32 C60.6 30.6 62.2 29.5 64 30.6 C67 32.5 65 36 60 40 Z" />
            ) : (
              <path key={i} className="fx-burst-item" style={{ ["--dx" as string]: `${dx * 1.4}px`, animationDelay: `${i * 30}ms` }} d="M60 52 l1.4 4 4 1.4 -4 1.4 -1.4 4 -1.4 -4 -4 -1.4 4 -1.4 z" />
            ),
          )}
        </g>
      )}
    </svg>
  );
}

/** Pieces of one generated picture retain the existing independent part animations. */
function FoxyPiece({ url }: { url: string }) {
  return <image href={url} x="10" y="4" width="100" height="128" preserveAspectRatio="xMidYMax meet" />;
}

/** The same generated face, cropped, when Foxy is minimised. */
function MiniFace() {
  return (
    <svg viewBox="12 4 94 86" className="size-11" aria-hidden="true">
      <FoxyPiece url={foxyFull.url} />
    </svg>
  );
}
