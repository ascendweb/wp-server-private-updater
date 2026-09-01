"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-bg": "var(--color-green-100)",
          "--success-border": "var(--color-green-200)",
          "--success-text": "var(--color-green-800)",
          "--error-bg": "var(--color-red-100)",
          "--error-border": "var(--color-red-200)",
          "--error-text": "var(--color-red-800)",
          "--warning-bg": "var(--color-orange-100)",
          "--warning-border": "var(--color-orange-200)",
          "--warning-text": "var(--color-orange-800)",
          "--info-bg": "var(--color-blue-100)",
          "--info-border": "var(--color-blue-200)",
          "--info-text": "var(--color-blue-800)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          success:
            "dark:!bg-green-950 dark:!border-green-900 dark:!text-green-400",
          error: "dark:!bg-red-950 dark:!border-red-900 dark:!text-red-400",
          warning:
            "dark:!bg-orange-950 dark:!border-orange-900 dark:!text-orange-400",
          info: "dark:!bg-blue-950 dark:!border-blue-900 dark:!text-blue-400",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
