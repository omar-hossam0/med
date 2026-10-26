import type { Transition } from "motion/react";

/**
 * Subtle fade + small vertical entrance used when switching tabs inside the
 * Doctors & Staff member details views. Kept in the existing `transitions`
 * folder so all motion values stay centralized.
 */
export const TAB_TRANSITION: Transition = {
  duration: 0.18,
  ease: "easeOut",
};

export const TAB_OFFSET = 6;

/** Motion props for a tab panel (mount-only animation; no exit delay). */
export const tabMotion = (reduce: boolean) => ({
  initial: reduce ? false : { opacity: 0, y: TAB_OFFSET },
  animate: { opacity: 1, y: 0 },
  transition: reduce ? { duration: 0 } : TAB_TRANSITION,
});
