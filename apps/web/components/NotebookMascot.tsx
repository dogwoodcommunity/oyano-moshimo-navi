"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./NotebookMascot.module.css";

export type NotebookMascotPose = "neutral" | "hello" | "saved" | "photo" | "listen";

type NotebookMascotProps = {
  pose?: NotebookMascotPose;
  motionKey?: number;
  motionEnabled?: boolean;
  className?: string;
};

type MascotMotion = { key: number; pose: NotebookMascotPose };

export function NotebookMascot({
  pose = "neutral",
  motionKey = 0,
  motionEnabled = false,
  className = "",
}: NotebookMascotProps) {
  // The first key is already consumed: rendering or enabling motion is not an event.
  const previousMotionKey = useRef(motionKey);
  const [motion, setMotion] = useState<MascotMotion | null>(null);

  useEffect(() => {
    const isNewKey = previousMotionKey.current !== motionKey;
    previousMotionKey.current = motionKey;
    setMotion(null);

    // Consume events even while disabled, so they cannot play later when enabled.
    if (!isNewKey || !Number.isFinite(motionKey) || motionKey <= 0 || !motionEnabled || pose === "neutral") {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    setMotion({ key: motionKey, pose });
    const timer = window.setTimeout(() => setMotion(null), 1000);
    const stopIfReduced = () => {
      if (reducedMotion.matches) setMotion(null);
    };
    reducedMotion.addEventListener("change", stopIfReduced);

    return () => {
      window.clearTimeout(timer);
      reducedMotion.removeEventListener("change", stopIfReduced);
    };
  }, [motionKey, motionEnabled, pose]);

  const animating = motionEnabled && pose !== "neutral" && motion?.key === motionKey && motion.pose === pose;

  return (
    <span
      className={`${styles.mascot} ${className}`.trim()}
      aria-hidden="true"
      data-mascot-pose={pose}
      data-mascot-animating={animating}
    >
      <span key={animating ? motionKey : "still"} className={styles.figure}>
        <span className={styles.wing} />
        <span className={styles.face}>
          {/* This local brand asset stays unchanged; expression overlays are decorative. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/watch-bird-mark.svg" width="82" height="82" alt="" draggable={false} />
          {pose === "saved" && (
            <>
              <span className={styles.eyesMask} />
              <span className={`${styles.eye} ${styles.eyeLeft}`} />
              <span className={`${styles.eye} ${styles.eyeRight}`} />
            </>
          )}
        </span>
        <span className={styles.keepsake}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </span>
      </span>
    </span>
  );
}
