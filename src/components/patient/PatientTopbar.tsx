"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Search, Bell, ChevronDown } from "lucide-react";
import { patient } from "@/lib/mock/patient";
import { formatPersonName } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "./ui";
import { useComingSoon } from "./ComingSoon";
import { cn } from "@/lib/cn";

export function PatientTopbar({ onMenu }: { onMenu: () => void }) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { user, logout } = useAuth();
  const comingSoon = useComingSoon();

  const displayName = formatPersonName(user?.full_name) || patient.fullName;
  const roleLabel = user?.roles?.length
    ? user.roles[0].charAt(0).toUpperCase() + user.roles[0].slice(1)
    : patient.role;

  // Make the ⌘K hint in the search field functional.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-3 z-30 mx-3 mt-3 flex h-[58px] items-center gap-2 rounded-2xl border border-[#E6EFEE] bg-white px-3 shadow-[0_10px_30px_-24px_rgba(15,45,74,0.35)] sm:gap-3 sm:px-4 lg:mx-4">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-secondary transition hover:bg-surface-subtle lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="relative min-w-0 flex-1 xl:max-w-[560px]">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for doctors, specialties, services, or anything..."
          aria-label="Search for doctors, specialties, services, or anything"
          className="h-10 w-full rounded-full border border-[#E8EFEF] bg-[#F7FAFA] pl-10 pr-12 text-[12px] text-navy outline-none transition placeholder:text-[#9AA9B8] focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
        />
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-[#E5ECEC] bg-white px-1.5 py-0.5 text-[9px] font-medium text-[#8A99A8] sm:inline-flex"
        >
          ⌘ K
        </kbd>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => comingSoon("Notifications")}
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-full text-ink-secondary transition hover:bg-surface-subtle"
        >
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#E5484D] ring-2 ring-white" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1.5 transition hover:bg-surface-subtle sm:pr-2"
          >
            <Avatar name={displayName} size={36} />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[150px] truncate text-[12.5px] font-semibold text-navy">
                {displayName}
              </span>
              <span className="block text-[10.5px] text-ink-muted">{roleLabel}</span>
            </span>
            <ChevronDown
              size={15}
              className={cn("text-ink-muted transition-transform", menuOpen && "rotate-180")}
            />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-pop"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    comingSoon("Profile");
                  }}
                  className="block w-full px-4 py-2 text-left text-[13px] text-ink-secondary transition hover:bg-surface-subtle"
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
                  className="block w-full px-4 py-2 text-left text-[13px] text-ink-secondary transition hover:bg-surface-subtle"
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
                  className="block w-full border-t border-line px-4 py-2 text-left text-[13px] font-medium text-[#E5484D] transition hover:bg-[#FDECEF]"
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
