"use client";

import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { RouteGuard } from "@/components/auth/RouteGuard";
import { useAuth } from "@/lib/auth-context";

/**
 * Destination for doctor and receptionist accounts.
 *
 * They can authenticate today, but the clinical workspace does not exist yet.
 * Without this page the login redirect sent them to the patient dashboard, whose
 * guard rejected the role and bounced them back to /login — indistinguishable
 * from a failed sign-in.
 */
export default function WorkspacePage() {
  return (
    <RouteGuard allow={["doctor", "receptionist"]}>
      <WorkspaceHome />
    </RouteGuard>
  );
}

function WorkspaceHome() {
  const { user, logout } = useAuth();
  const isDoctor = user?.roles?.includes("doctor") ?? false;
  const roleLabel = isDoctor ? "Doctor" : "Staff";

  return (
    <main className="grid min-h-screen place-items-center bg-[#F3F8F8] px-4 py-10">
      <div className="w-full max-w-[520px] rounded-2xl border border-[#E5ECEC] bg-white p-6 shadow-soft">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A9189]">
          Medora
        </p>

        <h1 className="mt-2 text-[20px] font-bold text-[#0F2D4A]">
          Your account is active
        </h1>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[#5B6B7C]">
          You are signed in. The {roleLabel.toLowerCase()} workspace is not available yet, so
          there is nothing to open here for now. An administrator still manages your account,
          schedule and credentials.
        </p>

        <dl className="mt-4 space-y-2 rounded-xl border border-line bg-[#FAFDFD] p-3">
          <Row label="Name" value={user?.full_name ?? "—"} />
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Role" value={roleLabel} />
          <Row label="Status" value={user?.status ?? "—"} />
        </dl>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void logout();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0A9189] px-3.5 text-[11.5px] font-semibold text-white transition hover:bg-[#087F78]"
          >
            <LogOut size={14} />
            Sign out
          </button>

          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3.5 text-[11.5px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle"
          >
            <ArrowLeft size={14} />
            Back to Medora
          </Link>
        </div>

        <p className="mt-4 text-[10px] leading-relaxed text-[#9AA9B8]">
          This page exists so a valid doctor or staff sign-in has a destination. It will be
          replaced by the clinical workspace.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <dt className="text-[#7A8B9C]">{label}</dt>
      <dd className="truncate font-medium text-[#0F2D4A]">{value}</dd>
    </div>
  );
}
