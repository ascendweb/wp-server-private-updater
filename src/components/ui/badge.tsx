import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

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
      success: "border-green-300 bg-green-100 text-green-800 dark:border-green-950 dark:bg-green-950 dark:text-green-400",
      error: "border-red-300 bg-red-100 text-red-800 dark:border-red-950 dark:bg-red-950 dark:text-red-400",
      warn: "border-orange-100 bg-orange-100 text-orange-800 dark:border-orange-950 dark:bg-orange-950 dark:text-orange-400",
      subtle: "border-taupe-200 bg-taupe-200 text-taupe-600 dark:border-taupe-900 dark:bg-taupe-900 dark:text-taupe-400",
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

export { Badge, badgeVariants };
