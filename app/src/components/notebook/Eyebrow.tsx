import type { ReactNode } from "react";
import clsx from "clsx";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("eyebrow", className)}>{children}</div>;
}

export function MiniLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx("mini-label", className)}>{children}</span>;
}
