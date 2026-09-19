import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  gradient?: boolean;
  pad?: boolean;
}

/** Surface card with optional hover lift / brand gradient / padding. */
export function Card({ hover, gradient, pad = true, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "card",
        gradient ? "card-gradient" : undefined,
        hover ? "card-hover" : undefined,
        pad && "card-pad",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}