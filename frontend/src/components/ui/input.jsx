import * as React from "react"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  ...props
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "cyberpunk-text file:text-gray-200 placeholder:text-gray-500 selection:bg-blue-600 selection:text-white bg-gray-800/50 border-gray-600 flex h-10 w-full min-w-0 rounded-lg border px-4 py-2 text-base shadow-sm transition-all duration-200 outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-blue-500 focus-visible:ring-blue-500/30 focus-visible:ring-2 focus-visible:bg-gray-800/80",
        "hover:border-gray-500 hover:bg-gray-800/60",
        "aria-invalid:ring-red-500/30 aria-invalid:border-red-500",
        className
      )}
      {...props} />
  );
}

export { Input }
