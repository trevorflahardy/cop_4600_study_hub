import clsx from "clsx";
import type { ReactNode } from "react";

export function CodeBlock({
  children,
  inline,
  className,
}: {
  children: ReactNode;
  inline?: boolean;
  className?: string;
}) {
  if (inline) {
    return <code className={clsx("code-block inline", className)}>{children}</code>;
  }
  return <pre className={clsx("code-block", className)}>{children}</pre>;
}
