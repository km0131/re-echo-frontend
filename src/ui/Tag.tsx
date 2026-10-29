import type { ReactNode } from 'react'
import { cx } from '../lib/cx'

type Variant = 'solid' | 'sepia' | 'off'

const variants: Record<Variant, string> = {
  solid: 'bg-navy text-paper border border-navy',
  sepia: 'border border-sepia text-sepia',
  off: 'border border-off text-off',
}

/** 小さなタグ（「幹事専用」「回答受付中」など）。 */
export function Tag({
  variant = 'solid',
  children,
  className,
}: {
  variant?: Variant
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-tag px-2 py-px text-tiny font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
