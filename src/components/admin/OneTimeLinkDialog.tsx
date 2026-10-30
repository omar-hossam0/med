"use client";

import { useState } from "react";
import { ActionDialog } from "@/components/admin/ActionDialog";

/**
 * Shows a one-time invitation or password-reset link.
 *
 * The backend stores only the token hash, so this is the only moment the link
 * exists in readable form. There is no mailer yet, which is why it is surfaced
 * here for the administrator to hand over.
 */
export function OneTimeLinkDialog({
  open,
  title,
  description,
  path,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  path: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <ActionDialog
      open={open}
      title={title}
      description={description}
      onClose={() => {
        setCopied(false);
        onClose();
      }}
      confirmLabel="Done"
      onConfirm={() => {
        setCopied(false);
        onClose();
      }}
    >
      {path && (
        <>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-[#F6FAFB] px-2 py-1.5 text-[10px] text-[#0F2D4A]">
              {path}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(`${window.location.origin}${path}`);
                setCopied(true);
              }}
              className="inline-flex h-7 shrink-0 items-center rounded-lg border border-line px-2 text-[10px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="mt-2 text-[9.5px] leading-relaxed text-[#9AA9B8]">
            Shown once. The link cannot be retrieved later; issue a new one if it is lost.
          </p>
        </>
      )}
    </ActionDialog>
  );
}
