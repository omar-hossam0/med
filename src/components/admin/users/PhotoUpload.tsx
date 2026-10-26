"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, ImageUp, X } from "lucide-react";
import { cn } from "@/lib/cn";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png";

type Props = {
  id: string;
  /** Object URL of the picked image (owned by the parent). */
  value: string | null;
  /** Receives a fresh object URL, or null when the image is removed. */
  onChange: (url: string | null) => void;
};

/**
 * Compact profile-photo upload card (mint tint, thin teal border, circular
 * avatar preview). Frontend-only: the picked file stays in the browser as an
 * object URL; nothing is uploaded anywhere.
 */
export function PhotoUpload({ id, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const openPicker = () => {
    setError("");
    inputRef.current?.click();
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      setError("Only JPG and PNG images are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large. Maximum size is 5MB.");
      return;
    }
    setError("");
    onChange(URL.createObjectURL(file));
  };

  const remove = () => {
    setError("");
    onChange(null);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border bg-[#F1FAF7] p-2.5 transition",
          error ? "border-[#E5484D]/50" : "border-[#0A9189]/25 hover:border-[#0A9189]/45",
        )}
      >
        {/* Circular avatar / picker trigger */}
        <button
          type="button"
          onClick={openPicker}
          aria-label={value ? "Replace profile photo" : "Upload profile photo"}
          className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[#0A9189]/25 bg-white text-[#7A8B9C] transition hover:border-[#0A9189]/55 hover:text-[#0A9189]"
        >
          {value ? (
            <motion.img
              key={value}
              src={value}
              alt=""
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="h-full w-full object-cover"
            />
          ) : (
            <Camera size={19} aria-hidden />
          )}
        </button>

        {/* Label + helper + remove */}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={openPicker}
            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#0A9189] transition hover:opacity-80"
          >
            <ImageUp size={14} aria-hidden />
            {value ? "Replace Profile Photo" : "Upload Profile Photo"}
          </button>
          <p className="mt-0.5 text-[9.5px] text-[#7A8B9C]">JPG, PNG up to 5MB</p>
          {value && (
            <button
              type="button"
              onClick={remove}
              className="mt-1 inline-flex items-center gap-1 text-[9.5px] font-medium text-[#E5484D] transition hover:underline"
            >
              <X size={10} strokeWidth={2.5} aria-hidden />
              Remove
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-1 text-[10px] font-medium text-[#E5484D]">
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT}
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}
