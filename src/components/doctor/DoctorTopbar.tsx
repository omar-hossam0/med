"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, Search, Settings, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatPersonName } from "@/lib/format";
import { useComingSoon } from "@/components/patient/ComingSoon";
import { Avatar } from "@/components/patient/ui";
import { cn } from "@/lib/cn";

/** Specialty is not part of the auth session yet; this is the fixture default. */
const DEFAULT_SPECIALTY = "Cardiology";

export function DoctorTopbar({ onMenu }: { onMenu: () => void }) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const comingSoon = useComingSoon();

  const displayName = formatPersonName(user?.full_name) || "Dr. Sarah Ahmed";

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

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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
          placeholder="Search for patients, medical records, prescriptions, or anything..."
          aria-label="Search for patients, medical records, prescriptions, or anything"
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
          className="relative grid h-9 w-9 place-items-center rounded-full text-ink-secondary transition hover:bg-surface-subtle"
        >
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-[6px] w-[6px] rounded-full bg-[#E5484D] ring-2 ring-white" />
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1.5 transition hover:bg-surface-subtle sm:pr-2"
          >
            <Avatar name={displayName} size={32} />
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-[150px] truncate text-[12px] font-semibold leading-tight text-navy">
                {displayName}
              </span>
              <span className="block text-[10px] leading-tight text-[#8A99A8]">
                {DEFAULT_SPECIALTY}
              </span>
            </span>
            <ChevronDown size={14} className="hidden text-[#8A99A8] sm:block" />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] z-40 w-[196px] overflow-hidden rounded-xl border border-[#E6EFEE] bg-white py-1 shadow-[0_18px_40px_-24px_rgba(15,45,74,0.45)]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  comingSoon("Profile");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-[#33475B] transition hover:bg-[#F5FAFA]"
              >
                <User size={14} /> Profile
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  comingSoon("Settings");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-[#33475B] transition hover:bg-[#F5FAFA]"
              >
                <Settings size={14} /> Settings
              </button>
              <div className="my-1 h-px bg-[#EDF3F3]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void logout();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-[#E5484D] transition hover:bg-[#FFF4F5]",
                )}
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
