"use client";

import {
  Heart,
  Sparkles,
  Baby,
  Bone,
  Ear,
  Eye,
  Brain,
  Stethoscope,
  BrainCircuit,
  Scan,
  Ribbon,
  Activity,
  Pill,
  Microscope,
  Syringe,
  Dna,
  ShieldCheck,
  Building2,
  type LucideIcon,
} from "lucide-react";
import {
  DEPARTMENT_ICON_CONFIGS,
  type DepartmentIconKey,
} from "@/lib/mock/departments";
import { cn } from "@/lib/cn";

function VenusIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="9" r="6" />
      <path d="M12 15v7" />
      <path d="M9 19h6" />
    </svg>
  );
}

const ICON_COMPONENTS: Record<
  DepartmentIconKey,
  LucideIcon | (({ size, className }: { size?: number; className?: string }) => React.JSX.Element)
> = {
  heart: Heart,
  skin: Sparkles,
  baby: Baby,
  bone: Bone,
  venus: VenusIcon,
  ear: Ear,
  eye: Eye,
  brain: Brain,
  stethoscope: Stethoscope,
  psychiatry: BrainCircuit,
  radiology: Scan,
  ribbon: Ribbon,
  activity: Activity,
  pill: Pill,
  microscope: Microscope,
  syringe: Syringe,
  dna: Dna,
  shield: ShieldCheck,
};

export function DepartmentIcon({
  iconKey,
  size = 44,
  iconSize = 22,
  className,
}: {
  iconKey: DepartmentIconKey | string;
  size?: number;
  iconSize?: number;
  className?: string;
}) {
  const config =
    DEPARTMENT_ICON_CONFIGS[iconKey as DepartmentIconKey] || {
      label: "Department",
      bg: "bg-[#E6FAF7]",
      color: "#0A9189",
    };

  const IconComp = ICON_COMPONENTS[iconKey as DepartmentIconKey] || Building2;

  return (
    <div
      style={{
        width: size,
        height: size,
        color: config.color,
      }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition-transform",
        config.bg,
        className,
      )}
      aria-hidden
    >
      <IconComp size={iconSize} className="shrink-0" />
    </div>
  );
}

export const SELECTABLE_ICONS: Array<{ key: DepartmentIconKey; label: string }> = [
  { key: "heart", label: "Heart" },
  { key: "skin", label: "Dermatology" },
  { key: "baby", label: "Pediatrics" },
  { key: "bone", label: "Orthopedics" },
  { key: "venus", label: "Gynecology" },
  { key: "ear", label: "ENT" },
  { key: "eye", label: "Ophthalmology" },
  { key: "brain", label: "Neurology" },
  { key: "stethoscope", label: "General" },
  { key: "psychiatry", label: "Psychiatry" },
  { key: "radiology", label: "Radiology" },
  { key: "ribbon", label: "Oncology" },
  { key: "activity", label: "Emergency" },
  { key: "pill", label: "Pharmacy" },
  { key: "microscope", label: "Laboratory" },
  { key: "syringe", label: "Surgery" },
  { key: "dna", label: "Genetics" },
  { key: "shield", label: "Preventive" },
];
