import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "icon";

const variantClasses: Record<Variant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800 border border-navy-900",
  secondary: "bg-blue-100 text-navy-900 hover:bg-blue-100/70 border border-blue-100",
  outline: "bg-surface text-navy-900 border border-border-strong hover:bg-surface-muted",
  ghost: "bg-transparent text-navy-900 hover:bg-surface-muted border border-transparent",
  danger: "bg-red-600 text-white hover:bg-red-700 border border-red-600",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  icon: "h-9 w-9 justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 whitespace-nowrap",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
