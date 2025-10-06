import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400",
        destructive: "bg-rose-500 text-white hover:bg-rose-600 dark:bg-rose-500 dark:hover:bg-rose-400",
        outline: "border border-gray-300 bg-white text-slate-900 hover:bg-gray-100 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800",
        secondary: "bg-rose-400 text-white hover:bg-rose-500 dark:bg-rose-400 dark:hover:bg-rose-300",
        ghost: "text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-900/40 shadow-none",
        link: "text-teal-700 underline-offset-4 hover:underline hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200 shadow-none",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
