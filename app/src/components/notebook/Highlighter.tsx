import { type ReactNode } from "react";
import clsx from "clsx";

type Color = "yellow" | "mint" | "sky" | "amber" | "pop";

interface HighlighterProps {
  color?: Color;
  children: ReactNode;
  className?: string;
}

export function Highlighter({ color = "yellow", children, className }: HighlighterProps) {
  return (
    <span
      className={clsx(
        "highlighter",
        color === "mint" && "mint",
        color === "sky" && "sky",
        color === "amber" && "amber",
        color === "pop" && "pop",
        className
      )}
    >
      {children}
    </span>
  );
}
