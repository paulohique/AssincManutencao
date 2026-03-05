"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Props = {
  idleMinutes?: number;
};

export function IdleAutoRefresh({ idleMinutes = 5 }: Props) {
  const router = useRouter();

  const idleMs = Math.max(1, Number(idleMinutes) || 5) * 60_000;

  const lastInteractionAtRef = useRef<number>(Date.now());
  const lastRefreshAtRef = useRef<number>(0);

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    // Interações típicas
    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "wheel"
    ];

    for (const ev of events) {
      window.addEventListener(ev, markInteraction, { passive: true });
    }

    // Considera foco/visibilidade como interação (evita refresh imediato ao voltar)
    window.addEventListener("focus", markInteraction);
    const onVisibility = () => {
      if (document.visibilityState === "visible") markInteraction();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const interval = window.setInterval(() => {
      // Só faz refresh quando a aba está visível
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      const idleFor = now - lastInteractionAtRef.current;
      const sinceLastRefresh = now - lastRefreshAtRef.current;

      // Refresh a cada idleMs enquanto estiver idle
      if (idleFor >= idleMs && sinceLastRefresh >= idleMs) {
        lastRefreshAtRef.current = now;
        router.refresh();
      }
    }, 15_000);

    return () => {
      window.clearInterval(interval);
      for (const ev of events) {
        window.removeEventListener(ev, markInteraction);
      }
      window.removeEventListener("focus", markInteraction);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, idleMs]);

  return null;
}
