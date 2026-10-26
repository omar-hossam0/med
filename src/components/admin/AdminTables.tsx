"use client";

import { MoreHorizontal } from "lucide-react";
import { recentAppointments, recentUsers } from "@/lib/mock/admin";
import { Avatar, StatusPill } from "./ui";
import { useComingSoon } from "./ComingSoon";

export function RecentAppointmentsTable() {
  const comingSoon = useComingSoon();
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#0F2D4A]">Recent Appointments</h3>
        <button
          type="button"
          onClick={() => comingSoon("All appointments")}
          className="text-[10.5px] font-semibold text-[#0A9189] hover:underline"
        >
          See All
        </button>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[430px] text-left">
          <thead>
            <tr className="border-b border-line">
              {["Patient", "Doctor", "Time", "Type", "Status"].map((h) => (
                <th
                  key={h}
                  className="pb-2 pr-2 text-[9px] font-semibold uppercase tracking-wide text-[#9AA9B8]"
                >
                  {h}
                </th>
              ))}
              <th className="pb-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {recentAppointments.map((a) => (
              <tr key={a.id} className="text-[11px]">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-1.5">
                    <Avatar name={a.patient} size={22} />
                    <span className="whitespace-nowrap font-medium text-[#0F2D4A]">
                      {a.patient}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap py-2 pr-2 text-[#5B6B7C]">{a.doctor}</td>
                <td className="whitespace-nowrap py-2 pr-2 text-[#5B6B7C]">{a.time}</td>
                <td className="whitespace-nowrap py-2 pr-2 text-[#5B6B7C]">{a.type}</td>
                <td className="py-2 pr-2">
                  <StatusPill status={a.status} />
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => comingSoon("Row actions")}
                    aria-label={`Actions for ${a.patient}`}
                    className="grid h-6 w-6 place-items-center rounded-md text-ink-muted transition hover:bg-surface-subtle hover:text-navy"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RecentUsersTable() {
  const comingSoon = useComingSoon();
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#0F2D4A]">Recent Users</h3>
        <button
          type="button"
          onClick={() => comingSoon("User directory")}
          className="text-[10.5px] font-semibold text-[#0A9189] hover:underline"
        >
          See All
        </button>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[360px] text-left">
          <thead>
            <tr className="border-b border-line">
              {["Name", "Role", "Created At", "Status"].map((h) => (
                <th
                  key={h}
                  className="pb-2 pr-2 text-[9px] font-semibold uppercase tracking-wide text-[#9AA9B8]"
                >
                  {h}
                </th>
              ))}
              <th className="pb-2" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {recentUsers.map((u) => (
              <tr key={u.id} className="text-[11px]">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-1.5">
                    <Avatar name={u.name} size={22} />
                    <span className="whitespace-nowrap font-medium text-[#0F2D4A]">{u.name}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap py-2 pr-2 text-[#5B6B7C]">{u.role}</td>
                <td className="whitespace-nowrap py-2 pr-2 text-[#5B6B7C]">{u.created}</td>
                <td className="py-2 pr-2">
                  <StatusPill status={u.status} />
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => comingSoon("Row actions")}
                    aria-label={`Actions for ${u.name}`}
                    className="grid h-6 w-6 place-items-center rounded-md text-ink-muted transition hover:bg-surface-subtle hover:text-navy"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
