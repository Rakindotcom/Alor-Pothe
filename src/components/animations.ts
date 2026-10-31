"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * FLIP animation for list re-ordering: when leaderboard ranks change, rows glide
 * smoothly from their old position to their new one instead of jumping.
 * Returns a ref-callback factory to attach to each keyed row element.
 */
export function useFlipReorder(orderKey: string) {
  const elements = useRef(new Map<string, HTMLElement>());
  const lastTops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const newTops = new Map<string, number>();

    elements.current.forEach((el, id) => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      newTops.set(id, top);

      const prevTop = lastTops.current.get(id);
      if (reduce || prevTop === undefined) return;

      const delta = prevTop - top;
      if (Math.abs(delta) < 1) return;

      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      // Force reflow so the browser registers the inverted starting position
      void el.offsetHeight;
      el.style.transition = "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "";
    });

    lastTops.current = newTops;
  }, [orderKey]);

  return (id: string) => (el: HTMLElement | null) => {
    if (el) elements.current.set(id, el);
    else elements.current.delete(id);
  };
}

/**
 * Gently counts a number up/down to its new value (subtle, ~600ms).
 */
export function useAnimatedNumber(target: number, durationMs = 600): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target || prefersReducedMotion()) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      setDisplay(value);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return display;
}
