import type { Transition } from "motion/react";

/**
 * Reusable animation presets for the Admin "Add New User" stepper and the
 * confirmation dialog. Kept in the existing `transitions` folder so motion
 * values stay centralized (consistent with the sidebar/route transitions).
 */
export const STEP_TRANSITION: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
};

export const MODAL_TRANSITION: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};

/** Directional slide + fade for step changes. */
export const stepMotion = (direction: number) => ({
  initial: { opacity: 0, x: direction >= 0 ? 16 : -16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: direction >= 0 ? -16 : 16 },
  transition: STEP_TRANSITION,
});

/** Subtle fade + scale-in for the centered confirmation dialog. */
export const modalMotion = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
  transition: MODAL_TRANSITION,
};
