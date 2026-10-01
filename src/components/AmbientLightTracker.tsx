"use client";

import { useEffect } from "react";

/**
 * AmbientLightTracker
 * Throttles pointer movements with requestAnimationFrame and sets
 * relative --mx and --my CSS variables on interactive elements with the
 * .lit, .lit-dark, or .lit-paper class.
 * Active exclusively when (hover: hover) and (pointer: fine).
 */
export function AmbientLightTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!mediaQuery.matches) return;

    let rafId: number | null = null;
    let pendingEvent: PointerEvent | null = null;

    const handlePointerMove = (e: PointerEvent) => {
      pendingEvent = e;
      if (rafId === null) {
        rafId = window.requestAnimationFrame(() => {
          if (pendingEvent) {
            const target = (pendingEvent.target as HTMLElement | null)?.closest?.(
              ".lit, .lit-dark, .lit-paper"
            ) as HTMLElement | null;

            if (target) {
              const rect = target.getBoundingClientRect();
              const x = pendingEvent.clientX - rect.left;
              const y = pendingEvent.clientY - rect.top;
              target.style.setProperty("--mx", `${Math.round(x)}px`);
              target.style.setProperty("--my", `${Math.round(y)}px`);
            }
          }
          rafId = null;
          pendingEvent = null;
        });
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return null;
}
