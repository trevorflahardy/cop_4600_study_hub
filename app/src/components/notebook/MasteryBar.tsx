import clsx from "clsx";
import type { MasteryLevel } from "@/lib/db";

interface MasteryBarProps {
  level: MasteryLevel;
  gain?: boolean;
  size?: "default" | "lg";
  className?: string;
}

/**
 * Five pip indicator of mastery level, 0–5.
 * When `gain` is true, the newly-gained pip shows as .gain (yellow).
 */
export function MasteryBar({ level, gain = false, size = "default", className }: MasteryBarProps) {
  return (
    <span className={clsx("mastery", size === "lg" && "lg", className)}>
      {Array.from({ length: 5 }).map((_, i) => {
        const on = i < level;
        const isGainPip = gain && i === level - 1;
        return <i key={i} className={clsx(on && "on", isGainPip && "gain")} />;
      })}
    </span>
  );
}
