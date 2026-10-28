import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#6366f1] text-white shadow-xs",
        secondary:
          "border-[rgba(148,163,184,0.3)] bg-[rgba(148,163,184,0.08)] text-[rgba(148,163,184,0.95)]",
        destructive: "border-rose-500/30 bg-rose-500/15 text-rose-400 font-medium",
        outline: "text-foreground border-[rgba(128,128,128,0.25)] bg-[#1a1c24]",
        success: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
        warning: "border-amber-500/30 bg-amber-500/15 text-amber-400",
        accent: "border-indigo-500/30 bg-indigo-500/15 text-indigo-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
