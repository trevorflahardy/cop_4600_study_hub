import { type ComponentPropsWithoutRef } from "react";
import clsx from "clsx";

type ChipTone = "default" | "hl" | "mint" | "sky" | "amber" | "pop" | "soft";

interface ChipProps extends ComponentPropsWithoutRef<"span"> {
  tone?: ChipTone;
}

export function Chip({ tone = "default", className, children, ...rest }: ChipProps) {
  return (
    <span className={clsx("chip", tone !== "default" && tone, className)} {...rest}>
      {children}
    </span>
  );
}
