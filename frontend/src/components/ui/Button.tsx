import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "soft" | "gold" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

interface AnchorProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  href: string;
}

type Props = ButtonProps | AnchorProps;

const VARIANT: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  soft: "btn-soft",
  gold: "btn-gold",
  danger: "btn-danger",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-5",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10 p-0",
};

function classes(props: Props): string {
  return cn(
    VARIANT[props.variant ?? "primary"],
    SIZE[props.size ?? "md"],
    "fullWidth" in props && props.fullWidth && "w-full",
    props.className,
  );
}

export function Button(props: Props) {
  const { variant: _v, size: _s, loading: _l, fullWidth: _f, ...rest } = props;

  if ("href" in rest && rest.href != null) {
    return <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} className={classes(props)} />;
  }

  const { loading = false, disabled, children, ...btnProps } = rest as ButtonProps & { children?: React.ReactNode };
  return (
    <button
      className={classes(props)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...btnProps}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}