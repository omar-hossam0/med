"use client";

import { useState } from "react";
import { Menu, Search, Bell, ChevronDown, PanelLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "./ui";
import { useComingSoon } from "./ComingSoon";
import { cn } from "@/lib/cn";

export function AdminTopbar({
  onMenu,
  collapsed,
  onToggleCollapse,
}: {
  onMenu: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const comingSoon = useComingSoon();
  const { user, logout } = useAuth();

  const displayName = user?.full_name?.trim() || "Administrator";
  const displayEmail = user?.email || "";
  const isAdmin = user?.roles?.includes("admin");
  const roleLabel = isAdmin ? "Administrator" : user?.roles?.[0] || "Administrator";

  return (
    <header className="sticky top-3 z-30 flex h-[52px] items-center gap-2 rounded-2xl border border-line bg-white px-3 shadow-soft sm:gap-3 sm:px-4">
      {/* Mobile drawer trigger */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-secondary hover:bg-surface-subtle lg:hidden"
      >
        <Menu size={18} />
      </button>

      {/* Desktop collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={collapsed}
        className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-secondary transition hover:bg-surface-subtle lg:grid"
      >
        <PanelLeft
          size={17}
          className={cn("transition-transform duration-250 ease-out", collapsed && "rotate-180")}
        />
      </button>

      <div className="relative w-full max-w-[520px]">
        <Search
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for patients, doctors, appointments, or anything..."
          aria-label="Search"
          className="h-9 w-full rounded-xl border border-line bg-surface-subtle/70 pl-9 pr-14 text-[12.5px] text-navy outline-none transition placeholder:text-ink-muted focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-muted sm:block">
          ⌘ K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => comingSoon("Notifications")}
          className="relative grid h-9 w-9 place-items-center rounded-full text-ink-secondary transition hover:bg-surface-subtle"
        >
          <Bell size={17} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#E5484D] ring-2 ring-white" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-1.5 transition hover:bg-surface-subtle"
          >
            <Avatar name={displayName} size={30} />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[140px] truncate text-[12px] font-semibold text-navy">
                {displayName}
              </span>
              <span className="block text-[10px] text-ink-muted">{roleLabel}</span>
            </span>
            <ChevronDown
              size={14}
              className={cn("text-ink-muted transition-transform", menuOpen && "rotate-180")}
            />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-pop"
              >
                <div className="border-b border-line px-3.5 pb-2 pt-1.5">
                  <p className="truncate text-[12px] font-semibold text-navy">{displayName}</p>
                  {displayEmail && (
                    <p className="truncate text-[10.5px] text-ink-muted">{displayEmail}</p>
                  )}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    comingSoon("Profile");
                  }}
                  title="Coming soon"
                  className="block w-full px-3.5 py-2 text-left text-[12.5px] text-ink-secondary transition hover:bg-surface-subtle"
                >
                  Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    comingSoon("Settings");
                  }}
                  title="Coming soon"
                  className="block w-full px-3.5 py-2 text-left text-[12.5px] text-ink-secondary transition hover:bg-surface-subtle"
                >
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                  className="block w-full border-t border-line px-3.5 py-2 text-left text-[12.5px] font-medium text-[#E5484D] transition hover:bg-[#FDECEF]"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
