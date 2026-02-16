"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

/**
 * Load Analytics and SpeedInsights after initial paint to avoid blocking FCP/LCP.
 */
export default function DeferredAnalytics() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const useIdle = typeof requestIdleCallback !== "undefined";
    const id = useIdle
      ? requestIdleCallback(() => setMounted(true), { timeout: 2000 })
      : setTimeout(() => setMounted(true), 0);
    return () =>
      useIdle ? cancelIdleCallback(id as number) : clearTimeout(id as ReturnType<typeof setTimeout>);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
