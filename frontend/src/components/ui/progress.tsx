"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string
}

const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    ProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => {
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0
    const clamped = Math.max(0, Math.min(100, Math.round(numeric)))

    return (
        <ProgressPrimitive.Root
            ref={ref}
            value={value}
            data-value={String(clamped)}
            className={cn(
                "rv-progress relative h-4 w-full overflow-hidden rounded-full bg-secondary",
                className
            )}
            {...props}
        >
            <ProgressPrimitive.Indicator
                className={cn(
                    "rv-progress-indicator h-full w-full flex-1 transition-transform",
                    indicatorClassName ?? "bg-primary"
                )}
            />
        </ProgressPrimitive.Root>
    )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
