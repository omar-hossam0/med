"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Stethoscope,
  FileText,
  Pill,
  FlaskConical,
  MessageSquare,
  ClipboardList,
  User,
  Settings,
  Headset,
  ChevronRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { MedoraLogo } from "@/components/ui/MedoraLogo";
import { useComingSoon } from "@/components/patient/ComingSoon";
import { cn } from "@/lib/cn";

type NavItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: number;
  color: string;
};

/**
 * Doctor Portal navigation.
 *
 * Overview, My Schedule and Patients are implemented. Every other destination is rendered
 * as a real, focusable item that explains it is a future module instead of
 * linking to a route that does not exist yet.
 */
const PRIMARY_NAV: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/doctor/dashboard", color: "#0A9189" },
  { label: "My Schedule", icon: CalendarDays, href: "/doctor/appointments", color: "#5B6B7C" },
  { label: "Patients", icon: Users, href: "/doctor/patients", color: "#3B6EF6" },
  { label: "Consultation Workspace", icon: Stethoscope, color: "#8B5CF6" },
  { label: "Medical Records", icon: FileText, color: "#3B6EF6" },
  { label: "Prescriptions", icon: Pill, color: "#0A9189" },
  { label: "Lab Results", icon: FlaskConical, color: "#8B5CF6" },
  { label: "Messages", icon: MessageSquare, badge: 3, color: "#5B6B7C" },
  { label: "Reports", icon: ClipboardList, color: "#D98A0B" },
];

const ACCOUNT_NAV: NavItem[] = [
  { label: "Profile", icon: User, color: "#5B6B7C" },
  { label: "Settings", icon: Settings, color: "#5B6B7C" },
];

export function DoctorSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[228px] p-3 lg:block">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E6EFEE] bg-white shadow-[0_14px_40px_-26px_rgba(15,45,74,0.28)]">
          <SidebarBody onNavigate={onClose} />
        </div>
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          onClick={onClose}
          className={cn(
            "absolute inset-0 bg-navy/40 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[280px] p-3 transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#E6EFEE] bg-white shadow-pop">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 grid h-8 w-8 place-items-center rounded-full text-ink-secondary transition hover:bg-surface-subtle"
            >
              <X size={18} />
            </button>
            <SidebarBody onNavigate={onClose} />
          </div>
        </div>
      </div>
    </>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const comingSoon = useComingSoon();
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    Boolean(item.href) && (pathname === item.href || pathname.startsWith(`${item.href}/`));

  const renderItems = (items: NavItem[]) =>
    items.map((item) => (
      <NavRow
        key={item.label}
        item={item}
        active={isActive(item)}
        onNavigate={onNavigate}
        onComingSoon={comingSoon}
      />
    ));

  return (
    <>
      <div className="px-4 pb-4 pt-5">
        <Link
          href="/doctor/dashboard"
          aria-label="Medora Doctor Portal"
          onClick={onNavigate}
          className="inline-block"
        >
          <MedoraLogo variant="primary" height={29} priority />
        </Link>
      </div>

      <nav aria-label="Doctor navigation" className="flex-1 overflow-y-auto px-2.5 pb-3">
        <ul className="space-y-0.5">{renderItems(PRIMARY_NAV)}</ul>

        <div className="mt-2 border-t border-[#EDF3F3] pt-2">
          <p className="px-2.5 pb-1 text-[8.5px] font-semibold uppercase tracking-[0.16em] text-[#9AA9B8]">
            Account
          </p>
          <ul className="space-y-0.5">{renderItems(ACCOUNT_NAV)}</ul>
        </div>
      </nav>

      <div className="px-2.5 pb-3">
        <button
          type="button"
          onClick={() => comingSoon("Contact Support")}
          className="flex w-full items-center gap-2.5 rounded-xl bg-[#EAFBF8] p-2.5 text-left transition hover:bg-[#DDF7F2]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#0A9189]">
            <Headset size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] font-semibold text-navy">Need Help?</span>
            <span className="block text-[10.5px] text-[#5B6B7C]">Contact Support</span>
          </span>
          <ChevronRight size={15} className="shrink-0 text-[#5B6B7C]" />
        </button>
      </div>
    </>
  );
}

function NavRow({
  item,
  active,
  onNavigate,
  onComingSoon,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  onComingSoon: (label: string) => void;
}) {
  const Icon = item.icon;
  const cls = cn(
    "group relative flex h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-[12.5px] transition-colors duration-150",
    active
      ? "bg-[#E7FBF8] font-semibold text-[#0A9189]"
      : "text-[#5B6B7C] hover:bg-[#F5FAFA] hover:text-[#0F2D4A]",
  );

  const inner = (
    <>
      {active && (
        <span className="absolute -left-2.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#0A9189]" />
      )}
      <Icon size={17} className="shrink-0" style={{ color: active ? "#0A9189" : item.color }} />
      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
      {item.badge ? (
        <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#E5484D] px-1 text-[9.5px] font-semibold text-white">
          {item.badge}
        </span>
      ) : null}
    </>
  );

  return (
    <li>
      {item.href ? (
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          className={cls}
        >
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onComingSoon(item.label)}
          title={`${item.label} — future phase`}
          className={cls}
        >
          {inner}
        </button>
      )}
    </li>
  );
}
