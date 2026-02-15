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
    const id = requestIdleCallback
      ? requestIdleCallback(() => setMounted(true), { timeout: 2000 })
      : setTimeout(() => setMounted(true), 0);
    return () => (requestIdleCallback ? cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  if (!mounted) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
