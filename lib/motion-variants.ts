import type { TargetAndTransition, Transition, Variants } from "framer-motion";

export const motionDurations = {
  instant: 0.01,
  hover: 0.16,
  short: 0.18,
  medium: 0.24,
  panel: 0.28,
  count: 0.48,
  stagger: 0.05,
} as const;

const premiumEase = [0.22, 1, 0.36, 1] as const;
const softEase = [0.16, 1, 0.3, 1] as const;

export const motionTransitions = {
  hover: {
    duration: motionDurations.hover,
    ease: softEase,
  } satisfies Transition,
  short: {
    duration: motionDurations.short,
    ease: softEase,
  } satisfies Transition,
  medium: {
    duration: motionDurations.medium,
    ease: premiumEase,
  } satisfies Transition,
  panel: {
    duration: motionDurations.panel,
    ease: premiumEase,
  } satisfies Transition,
  layout: {
    type: "spring",
    stiffness: 300,
    damping: 30,
    mass: 0.72,
  } satisfies Transition,
} as const;

interface ContainerOptions {
  delayChildren?: number;
  stagger?: number;
}

interface ItemOptions {
  distance?: number;
}

export function containerVariants(reducedMotion: boolean, options?: ContainerOptions): Variants {
  const stagger = options?.stagger ?? motionDurations.stagger;
  const delayChildren = options?.delayChildren ?? 0;

  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { duration: motionDurations.instant },
      },
    };
  }

  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren,
        staggerChildren: stagger,
      },
    },
  };
}

export function itemVariants(reducedMotion: boolean, options?: ItemOptions): Variants {
  const distance = options?.distance ?? 18;

  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { duration: motionDurations.short },
      },
    };
  }

  return {
    hidden: {
      opacity: 0,
      y: distance,
      filter: "blur(8px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: motionTransitions.panel,
    },
  };
}

export function hoverVariants(reducedMotion: boolean): TargetAndTransition {
  if (reducedMotion) {
    return {};
  }

  return {
    y: -6,
    scale: 1.01,
    transition: motionTransitions.hover,
  };
}

export function tabPanelVariants(reducedMotion: boolean): Variants {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: motionDurations.short } },
      exit: { opacity: 0, transition: { duration: motionDurations.short } },
    };
  }

  return {
    initial: {
      opacity: 0,
      y: 18,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: motionTransitions.panel,
    },
    exit: {
      opacity: 0,
      y: -12,
      transition: motionTransitions.short,
    },
  };
}

export function listItemVariants(reducedMotion: boolean): Variants {
  if (reducedMotion) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1, transition: { duration: motionDurations.instant } },
      exit: { opacity: 0, transition: { duration: motionDurations.short } },
    };
  }

  return {
    initial: {
      opacity: 0,
      y: 14,
      scale: 0.985,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: motionTransitions.medium,
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.98,
      transition: motionTransitions.short,
    },
  };
}

export function countTransition(reducedMotion: boolean): Transition {
  if (reducedMotion) {
    return { duration: motionDurations.instant };
  }

  return {
    duration: motionDurations.count,
    ease: premiumEase,
  };
}

export function kineticLetterVariants(reducedMotion: boolean): Variants {
  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: motionDurations.short } },
    };
  }

  return {
    hidden: {
      opacity: 0,
      y: "120%",
      rotateX: -45,
      filter: "blur(12px)",
    },
    visible: {
      opacity: 1,
      y: "0%",
      rotateX: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.9,
        ease: premiumEase,
      },
    },
  };
}

export function magneticTileVariants(reducedMotion: boolean): Variants {
  if (reducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: motionDurations.short } },
    };
  }

  return {
    hidden: { opacity: 0, y: 28, filter: "blur(10px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.8, ease: premiumEase },
    },
  };
}

export function liveBadgeAnimation(reducedMotion: boolean, isLive: boolean): TargetAndTransition {
  if (reducedMotion || !isLive) {
    return {
      scale: 1,
      boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
    };
  }

  return {
    scale: [1, 1.015, 1],
    boxShadow: [
      "0 0 0 rgba(232, 90, 30, 0)",
      "0 10px 28px rgba(232, 90, 30, 0.12)",
      "0 0 0 rgba(232, 90, 30, 0)",
    ],
    transition: {
      duration: 2.4,
      ease: "easeInOut",
      repeat: Infinity,
    },
  };
}
