import { useEffect, useRef, useState } from "react";

/** Mandatory tagline reveal (skill B11): each word goes from 30% to full opacity as it crosses the trigger line. */
export function TaglineReveal({ lines }: { lines: string[] }) {
  const words = lines.flatMap((line, li) => line.split(" ").map((w, wi) => ({ w, key: `${li}-${wi}`, br: wi === 0 && li > 0 })));
  const refs = useRef<Array<HTMLSpanElement | null>>([]);
  const [active, setActive] = useState<Set<number>>(new Set());
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setReduced(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const hits = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.i));
        if (!hits.length) return;
        setActive((prev) => {
          const next = new Set(prev);
          hits.forEach((i) => next.add(i));
          return next;
        });
        entries.forEach((e) => e.isIntersecting && io.unobserve(e.target));
      },
      { rootMargin: "0px 0px -35% 0px", threshold: 1 },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <p className="heading-4 mx-auto max-w-[680px] text-center sm:heading-3 lg:heading-2" aria-label={lines.join(" ")}>
      {words.map((item, i) => (
        <span key={item.key} aria-hidden="true">
          {item.br && <br className="hidden sm:block" />}
          <span
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-i={i}
            className={`inline-block transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${reduced || active.has(i) ? "opacity-100" : "opacity-30"}`}
          >
            {item.w}
          </span>{" "}
        </span>
      ))}
    </p>
  );
}
