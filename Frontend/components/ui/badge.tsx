import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold shadow-sm",
  {
    variants: {
      variant: {
        ok: "bg-emerald-500 text-white",
        late: "bg-rose-500 text-white",
        pending: "bg-amber-500 text-white",
        neutral: "bg-gray-500 text-white"
      }
    },
    defaultVariants: {
      variant: "neutral"
    }
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
