interface Props {
  hint: string
  className?: string
}

/**
 * Small info icon with a CSS-only tooltip on hover. We use the native
 * `title` attribute for full delay + accessibility behavior, plus a styled
 * span underneath so it's discoverable visually.
 */
export function InfoIcon({ hint, className }: Props) {
  return (
    <span
      title={hint}
      aria-label={hint}
      className={`inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-zinc-400 text-[8px] font-bold text-zinc-500 transition hover:border-cyan-500 hover:text-cyan-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:text-cyan-300 ${className ?? ''}`}
    >
      i
    </span>
  )
}

/** Inline tooltip-wrapper: any element + a hidden popover on hover. */
export function Tooltip({
  hint,
  children,
  className,
}: {
  hint: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span title={hint} className={`relative ${className ?? ''}`}>
      {children}
    </span>
  )
}
