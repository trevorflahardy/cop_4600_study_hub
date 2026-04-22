import { forwardRef, type ComponentPropsWithoutRef } from "react";
import clsx from "clsx";

type Variant = "default" | "primary" | "pop" | "ghost";
type Size = "default" | "big";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "default", className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      className={clsx(
        "btn-sk",
        variant === "primary" && "primary",
        variant === "pop" && "pop",
        variant === "ghost" && "ghost",
        size === "big" && "big",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
