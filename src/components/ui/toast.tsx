"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"

export function Toast(props: {
  kind: "success" | "error"
  message: string | null
  onDismiss: () => void
  timeoutMs?: number
}) {
  const { kind, message, onDismiss, timeoutMs = 3000 } = props
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDismiss, timeoutMs)
    return () => clearTimeout(t)
  }, [message, onDismiss, timeoutMs])

  if (!message) return null
  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg",
        kind === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
      )}
    >
      {message}
    </div>
  )
}
