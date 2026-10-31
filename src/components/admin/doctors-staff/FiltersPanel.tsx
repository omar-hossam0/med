"use client";

import { RotateCcw } from "lucide-react";
import {
  VERIFICATION_LABEL,
  ACCOUNT_STATUS_LABEL,
} from "@/lib/mock/doctorsStaff";
import { SelectField } from "@/components/ui/SelectField";
import { useReferenceData } from "@/components/admin/ReferenceDataProvider";
import { useDirectory } from "./DirectoryProvider";
import { cn } from "@/lib/cn";

const VERIFICATION_OPTIONS = [
  "All Statuses",
  ...Object.values(VERIFICATION_LABEL),
];

const ACCOUNT_OPTIONS = ["All Statuses", ...Object.values(ACCOUNT_STATUS_LABEL)];

export function FiltersPanel() {
  const { filters, setFilter, clearFilters } = useDirectory();
  const { departments, locations } = useReferenceData();

  const activeCount = (
    ["department", "role", "verification", "accountStatus", "location"] as const
  ).filter(
    (k) =>
      filters[k] !== "All Departments" &&
      filters[k] !== "All Roles" &&
      filters[k] !== "All Statuses" &&
      filters[k] !== "All Locations",
  ).length;

  return (
    <aside className="w-full rounded-2xl border border-[#E5ECEC] bg-white p-4 shadow-soft xl:sticky xl:top-3">
      {/* Header matching Reference Image 1 */}
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Teal accent bar */}
          <span className="h-4 w-1 rounded-full bg-[#0A9189]" />
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0A9189"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <h2 className="text-[13px] font-bold text-[#0F2D4A]">Filters</h2>
        </div>
        {activeCount > 0 && (
          <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-[#0A9189] px-1 text-[9.5px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </div>

      {/* 5 Filter Select Fields with Labels Above */}
      <div className="space-y-3">
        <FilterSelect
          id="fp-department"
          label="Department"
          value={filters.department}
          options={["All Departments", ...departments.map((d) => d.name)]}
          onChange={(v) => setFilter("department", v)}
        />
        <FilterSelect
          id="fp-role"
          label="Role"
          value={filters.role}
          options={["All Roles", "Doctor", "Staff"]}
          onChange={(v) => setFilter("role", v)}
        />
        <FilterSelect
          id="fp-verification"
          label="Verification Status"
          value={filters.verification}
          options={VERIFICATION_OPTIONS}
          onChange={(v) => setFilter("verification", v)}
        />
        <FilterSelect
          id="fp-account"
          label="Account Status"
          value={filters.accountStatus}
          options={ACCOUNT_OPTIONS}
          onChange={(v) => setFilter("accountStatus", v)}
        />
        <FilterSelect
          id="fp-location"
          label="Work Location"
          value={filters.location}
          options={["All Locations", ...locations.map((l) => l.name)]}
          onChange={(v) => setFilter("location", v)}
        />
      </div>

      {/* Clear Filters Button (Reference Image 1: rounded, border, rotate icon) */}
      <button
        type="button"
        onClick={clearFilters}
        className={cn(
          "mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line py-2 text-[11.5px] font-semibold text-[#0F2D4A] transition hover:bg-surface-subtle",
          activeCount > 0 && "border-[#0A9189]/40 text-[#0A9189] hover:bg-[#E6FAF7]",
        )}
      >
        <RotateCcw size={13} />
        Clear Filters
      </button>
    </aside>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[10.5px] font-medium text-[#7A8B9C]">
        {label}
      </label>
      <SelectField
        id={id}
        label={label}
        placeholder={options[0]}
        value={options.includes(value) ? value : options[0]}
        onChange={onChange}
        options={options.map((o) => ({ value: o, label: o }))}
        height={36}
      />
    </div>
  );
}
