import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva("group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-3 py-0.5 text-[0.8125rem] font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
      secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
      destructive: "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
      outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
      ghost: "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
      link: "text-primary underline-offset-4 hover:underline",
      success: "border-green-100 bg-green-100 text-green-800 dark:border-green-950 dark:bg-green-950 dark:text-green-400",
      error: "border-red-100 bg-red-100 text-red-800 dark:border-red-950 dark:bg-red-950 dark:text-red-400",
      warn: "border-orange-100 bg-orange-100 text-orange-800 dark:border-orange-950 dark:bg-orange-950 dark:text-orange-400",
      info: "border-blue-100 bg-blue-100 text-blue-800 dark:border-blue-950 dark:bg-blue-950 dark:text-blue-400",
      subtle: "border-muted bg-muted text-muted-foreground dark:border-muted dark:bg-muted dark:text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Badge({ className, variant = "default", render, ...props }: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

function BadgeGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="badge-group"
      className={cn(
        "inline-flex items-center",
        "[&>:first-child:not(:only-child)]:rounded-r-none",
        "[&>:first-child:not(:only-child)]:overflow-visible",
        "[&>:first-child:not(:only-child)]:[clip-path:polygon(0_0,100%_0,calc(100%-5px)_100%,0_100%)]",
        "[&>:not(:first-child)]:-ml-1.25",
        "[&>:not(:first-child)]:rounded-l-none",
        "[&>:not(:first-child)]:pl-4.25",
        "[&>:not(:first-child)]:overflow-visible",
        "[&>:not(:first-child)]:[clip-path:polygon(5px_0,100%_0,100%_100%,0_100%)]",
        className
      )}
      {...props}
    />
  );
}

export { Badge, BadgeGroup, badgeVariants };
