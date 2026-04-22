import { type ComponentPropsWithoutRef } from "react";
import clsx from "clsx";

type Variant = "default" | "dashed" | "soft" | "wobble";

interface FrameProps extends ComponentPropsWithoutRef<"div"> {
  variant?: Variant;
  padded?: boolean;
  shadow?: "none" | "card" | "canvas";
}

export function Frame({
  variant = "default",
  padded = true,
  shadow = "card",
  className,
  children,
  style,
  ...rest
}: FrameProps) {
  const classes = clsx(
    "frame",
    variant === "dashed" && "dashed",
    variant === "soft" && "soft",
    variant === "wobble" && "wobble",
    padded && "p-5",
    className
  );
  const shadowStyle =
    shadow === "canvas"
      ? "var(--shadow-canvas)"
      : shadow === "card"
      ? "var(--shadow-card)"
      : "none";
  return (
    <div className={classes} style={{ boxShadow: shadowStyle, ...style }} {...rest}>
      {children}
    </div>
  );
}
