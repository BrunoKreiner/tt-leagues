import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "cyberpunk-text inline-flex items-center justify-center rounded-lg border px-3 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md",
        secondary:
          "border-transparent bg-gray-700 text-gray-200 shadow-sm hover:bg-gray-600 hover:shadow-md",
        destructive:
          "border-transparent bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md",
        outline:
          "border-gray-600 bg-transparent text-gray-300 hover:bg-gray-800 hover:border-gray-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props} />
  );
}

export { Badge, badgeVariants }
