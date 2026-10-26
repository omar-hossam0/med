import type { CSSProperties } from "react";

/**
 * Reusable transition configuration for the Medora Admin collapsible sidebar.
 * Lives in the existing `transitions` folder so motion values stay centralized
 * and consistent with the rest of the project.
 */
export const SIDEBAR_TRANSITION = {
  expandedWidth: 208,
  collapsedWidth: 84,
  duration: "260ms",
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

/** CSS custom properties that drive the rail width + content offset together. */
export function sidebarLayoutVars(collapsed: boolean): CSSProperties {
  return {
    "--admin-sidebar-w": `${
      collapsed ? SIDEBAR_TRANSITION.collapsedWidth : SIDEBAR_TRANSITION.expandedWidth
    }px`,
    "--admin-sidebar-dur": SIDEBAR_TRANSITION.duration,
    "--admin-sidebar-ease": SIDEBAR_TRANSITION.ease,
  } as CSSProperties;
}

/** Rail (aside) — animates its width only. */
export function sidebarRailStyle(): CSSProperties {
  return {
    width: "var(--admin-sidebar-w)",
    transitionProperty: "width",
    transitionDuration: "var(--admin-sidebar-dur)",
    transitionTimingFunction: "var(--admin-sidebar-ease)",
  };
}

/** Content column — animates its left offset in lockstep with the rail. */
export function sidebarContentStyle(): CSSProperties {
  return {
    transitionProperty: "padding-left",
    transitionDuration: "var(--admin-sidebar-dur)",
    transitionTimingFunction: "var(--admin-sidebar-ease)",
  };
}
