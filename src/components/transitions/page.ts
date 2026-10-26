import type { Transition } from "motion/react";

/**
 * Admin page transition: a light fade + 8px upward slide of the main content
 * only. The Admin shell (sidebar/topbar) lives in the layout and stays fixed.
 */
export const ADMIN_PAGE_TRANSITION: Transition = {
  duration: 0.2,
  ease: "easeOut",
};

export const ADMIN_PAGE_OFFSET = 8;
