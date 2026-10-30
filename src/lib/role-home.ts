/**
 * Single source of truth for "where does this role land after sign-in".
 *
 * The app currently has workspaces for admin and patient only. Doctor and
 * receptionist accounts are provisioned by an admin and can authenticate, but
 * their clinical workspace is not built yet, so they land on /workspace, which
 * explains the state instead of bouncing them back to /login.
 *
 * Returns null for a role with no destination, so callers can show a message
 * rather than redirect in a loop.
 */
export function homeForRoles(roles: string[] | null | undefined): string | null {
  const list = roles ?? [];

  if (list.includes("admin")) return "/admin/dashboard";
  if (list.includes("patient")) return "/patient/dashboard";
  if (list.includes("doctor") || list.includes("receptionist")) return "/workspace";

  return null;
}
