"use client";

import { useEffect, useState } from "react";
import { ActionDialog } from "@/components/admin/ActionDialog";
import { adminApi, ApiError, type AccountStatus } from "@/lib/api/admin";
import type { DemoUser } from "@/lib/mock/users";
import { cn } from "@/lib/cn";

/**
 * Mirrors the backend transition matrix so the dialog never offers a change
 * the server will reject. The reason is mandatory: it is stored in the audit
 * row and the security event.
 */
const ALLOWED_TRANSITIONS: Record<AccountStatus, AccountStatus[]> = {
  active: ["suspended", "inactive"],
  suspended: ["active", "inactive"],
  inactive: ["active"],
  pending: ["inactive"],
};

const STATUS_LABEL: Record<AccountStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  inactive: "Inactive",
  pending: "Pending Invitation",
};

export function ChangeStatusDialog({
  user,
  onClose,
  onUpdated,
}: {
  user: DemoUser | null;
  onClose: () => void;
  onUpdated: (user: DemoUser) => void;
}) {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const allowed = ALLOWED_TRANSITIONS[user.status] ?? [];
    setStatus(allowed[0] ?? null);
    setReason("");
    setError(null);
    setSubmitting(false);
  }, [user]);

  if (!user) return null;

  const allowed = ALLOWED_TRANSITIONS[user.status] ?? [];
  const confirmDisabled = !status || reason.trim().length < 3;

  async function submit() {
    if (!user || !status) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await adminApi.updateUserStatus(user.id, {
        status,
        reason: reason.trim(),
      });
      onUpdated(result.user);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not change the account status.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ActionDialog
      open
      title="Change account status"
      description={`${user.name} · ${user.email}`}
      onClose={onClose}
      confirmLabel="Update status"
      onConfirm={submit}
      submitting={submitting}
      error={error}
      confirmDisabled={confirmDisabled}
      tone={status && status !== "active" ? "danger" : "default"}
    >
      {allowed.length === 0 ? (
        <p className="text-[11.5px] text-[#7A8B9C]">
          No status changes are available for this account.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-[#0F2D4A]">New status</p>
            <div className="flex flex-wrap gap-1.5">
              {allowed.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  aria-pressed={status === option}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition",
                    status === option
                      ? "border-[#0A9189] bg-[#E6FAF7] text-[#0A9189]"
                      : "border-line text-[#5B6B7C] hover:bg-surface-subtle",
                  )}
                >
                  {STATUS_LABEL[option]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="status-reason"
              className="mb-1 block text-[11px] font-medium text-[#0F2D4A]"
            >
              Reason
            </label>
            <textarea
              id="status-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Why is this change being made? It is recorded in the audit log."
              className="w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-[12px] text-[#0F2D4A] outline-none transition placeholder:text-[#9AA9B8] focus:border-[#0A9189] focus:ring-2 focus:ring-[#0A9189]/15"
            />
            <p className="mt-1 text-right text-[9.5px] text-[#9AA9B8]">
              {reason.length}/500
            </p>
          </div>
        </div>
      )}
    </ActionDialog>
  );
}
