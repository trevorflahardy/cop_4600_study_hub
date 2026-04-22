import clsx from "clsx";
import type { ReactNode } from "react";

interface RibbonProps {
  tone?: "default" | "pop" | "mint" | "sky" | "amber";
  children: ReactNode;
}

export function Ribbon({ tone = "default", children }: RibbonProps) {
  return <span className={clsx("ribbon", tone !== "default" && tone)}>{children}</span>;
}
