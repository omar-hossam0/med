"use client";

import { useEffect, useRef } from "react";
import { WAVE_BARS } from "@/lib/audio/useAudioRecorder";
import { cn } from "@/lib/cn";

const MIN_HEIGHT = 8;
const MAX_HEIGHT = 46;

/**
 * Live microphone waveform.
 *
 * Bar heights come straight from the recorder's RMS history. The DOM is mutated
 * on the animation frame instead of through React state, so a 60fps waveform
 * never re-renders the consultation screen.
 *
 * When capture is not active the bars ease back to the baseline and the loop
 * stops, so silence is genuinely still rather than an idle animation.
 */
export function AudioWaveform({
  levelsRef,
  active,
  bars = WAVE_BARS,
  className,
}: {
  levelsRef: React.MutableRefObject<Float32Array>;
  active: boolean;
  bars?: number;
  className?: string;
}) {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const display = new Float32Array(bars);
    let frame = 0;
    let settledFrames = 0;

    const loop = () => {
      const levels = levelsRef.current;
      let moving = false;

      for (let index = 0; index < bars; index += 1) {
        const target = active ? (levels[index] ?? 0) : 0;
        const current = display[index];
        // Fast attack while capturing; slower release back to the baseline.
        const next = current + (target - current) * (active ? 0.55 : 0.12);
        display[index] = next;
        if (Math.abs(next) > 0.002) moving = true;

        const element = barRefs.current[index];
        if (element) {
          const height = MIN_HEIGHT + next * (MAX_HEIGHT - MIN_HEIGHT);
          element.style.height = `${height.toFixed(1)}px`;
          element.style.opacity = (0.3 + next * 0.7).toFixed(2);
        }
      }

      if (!active && !moving) {
        settledFrames += 1;
        if (settledFrames > 8) return; // fully at baseline — stop burning frames
      } else {
        settledFrames = 0;
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active, bars, levelsRef]);

  return (
    <div
      className={cn("flex h-[64px] items-center justify-center gap-[3px]", className)}
      role="img"
      aria-label={active ? "Live microphone level" : "Microphone level idle"}
    >
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          ref={(element) => {
            barRefs.current[index] = element;
          }}
          aria-hidden
          className="w-[3px] shrink-0 rounded-full bg-[#0A9189]"
          style={{ height: MIN_HEIGHT, opacity: 0.3 }}
        />
      ))}
    </div>
  );
}
