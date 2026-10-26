import type { LucideIcon } from "lucide-react";

type Props = {
  Icon: LucideIcon;
  title: string;
  value: string;
};

/** Floating white contact card (Call / Email / Location). */
export function ContactInfoCard({ Icon, title, value }: Props) {
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_18px_44px_-20px_rgba(15,23,42,0.30)] ring-1 ring-line/60 lg:w-[238px]">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-dark">
        <Icon size={19} />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[13px] font-semibold text-navy">{title}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-ink-secondary">
          {value}
        </p>
      </div>
    </div>
  );
}
