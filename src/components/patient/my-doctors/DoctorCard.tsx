"use client";

import { Bookmark, BriefcaseMedical, Heart, MapPin, Star } from "lucide-react";
import { DoctorPortrait } from "../DoctorPortrait";
import type { Doctor } from "@/lib/mock/doctors";
import { cn } from "@/lib/cn";

/**
 * Discovery card from the approved My Doctors reference: portrait, public
 * professional information, patient rating and the two actions (save + view).
 */
export function DoctorCard({
  doctor,
  favorite,
  onToggleFavorite,
  onView,
}: {
  doctor: Doctor;
  favorite: boolean;
  onToggleFavorite: () => void;
  onView: () => void;
}) {
  return (
    <article className="group flex flex-col rounded-2xl border border-[#E6EFEE] bg-white p-3.5 shadow-[0_10px_30px_-26px_rgba(15,45,74,0.35)] transition-shadow duration-200 hover:border-[#CFE9E5] hover:shadow-[0_16px_36px_-26px_rgba(15,45,74,0.4)] motion-safe:transition-transform motion-safe:hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <DoctorPortrait
          name={doctor.name}
          photoUrl={doctor.photoUrl}
          size={118}
          shape="rounded"
          className="bg-[#EFF7F7]"
        />

        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={
            favorite
              ? `Remove ${doctor.name} from saved doctors`
              : `Save ${doctor.name} to your doctors`
          }
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full transition",
            favorite
              ? "bg-[#FFF0F2] text-[#E5486B]"
              : "text-[#9AA9B8] hover:bg-[#FFF5F6] hover:text-[#E5486B]",
          )}
        >
          <Heart size={16} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="mt-3 min-w-0">
        <h3 className="truncate text-[14px] font-bold tracking-[-0.01em] text-[#0F2D4A]">
          {doctor.name}
        </h3>
        <p className="mt-0.5 truncate text-[11.5px] font-medium text-[#3FA3C4]">
          {doctor.specialty}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
          <span className="inline-flex items-center gap-1">
            <Star size={12} className="fill-[#F5A623] text-[#F5A623]" />
            <span className="font-semibold text-[#0F2D4A]">{doctor.rating.toFixed(1)}</span>
            <span className="text-[#8A99A8]">({doctor.reviews} reviews)</span>
          </span>
        </div>

        <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#5B6B7C]">
          <BriefcaseMedical size={12} className="shrink-0 text-[#9AA9B8]" />
          {doctor.years}+ years experience
        </p>

        <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-snug text-[#5B6B7C]">
          <MapPin size={12} className="mt-[1px] shrink-0 text-[#9AA9B8]" />
          <span className="min-w-0">
            <span className="block truncate">{doctor.clinic}</span>
            <span className="block text-[#8A99A8]">{doctor.city}, Egypt</span>
          </span>
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-[#EDF3F3] pt-3">
        <button
          type="button"
          onClick={onView}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-[#E6F9F6] px-3 text-[11px] font-semibold text-[#0A9189] transition hover:bg-[#D7F4EF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A9189]"
        >
          View Details
        </button>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? "Remove from saved doctors" : "Save this doctor"}
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition",
            favorite
              ? "border-[#F8D6DC] bg-[#FFF5F6] text-[#E5486B]"
              : "border-[#E6EFEE] bg-white text-[#9AA9B8] hover:border-[#BFE8E2] hover:text-[#0A9189]",
          )}
        >
          <Bookmark size={14} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  );
}
