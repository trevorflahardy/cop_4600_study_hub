import type { ReactNode, CSSProperties } from "react";
import clsx from "clsx";

type Position = "tl" | "tr" | "bl";

export function Callout({
  children,
  position = "tl",
  style,
  className,
}: {
  children: ReactNode;
  position?: Position;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={clsx("callout", position, className)} style={style}>
      {children}
    </div>
  );
}
