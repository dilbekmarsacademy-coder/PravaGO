"use client";

import { forwardRef, ReactNode, useEffect, useState } from "react";

interface RevealSectionProps {
  children: ReactNode;
}

/**
 * Mounts children with a fade + slide-in transition so newly unlocked
 * landing-page sections appear gradually instead of popping in.
 */
const RevealSection = forwardRef<HTMLDivElement, RevealSectionProps>(
  function RevealSection({ children }, ref) {
    const [shown, setShown] = useState(false);

    useEffect(() => {
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }, []);

    return (
      <div
        ref={ref}
        className={`transition-all duration-700 ease-out ${
          shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}
      >
        {children}
      </div>
    );
  },
);

export default RevealSection;
