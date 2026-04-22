"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { countTransition } from "@/lib/motion-variants";

interface AnimatedNumberProps {
  className?: string;
  value: number;
}

export function AnimatedNumber({ className, value }: AnimatedNumberProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const [displayValue, setDisplayValue] = useState(value);
  const latestValueRef = useRef(value);

  useEffect(() => {
    if (reducedMotion) {
      latestValueRef.current = value;
      return;
    }

    const controls = animate(latestValueRef.current, value, {
      ...countTransition(false),
      onUpdate: (nextValue) => {
        latestValueRef.current = nextValue;
        setDisplayValue(Math.round(nextValue));
      },
    });

    return () => {
      controls.stop();
    };
  }, [reducedMotion, value]);

  if (reducedMotion) {
    return <span className={className}>{value.toLocaleString()}</span>;
  }

  return <span className={className}>{displayValue.toLocaleString()}</span>;
}
