import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import { InfoIcon } from './icons'

/** お知らせ帯。tone="error" で文字を maybe-ink にする。 */
export function Notice({
  children,
  tone = 'info',
  icon,
  className,
}: {
  children: ReactNode
  tone?: 'info' | 'error'
  icon?: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-2 rounded-field bg-highlight px-3.5 py-2.5 text-note',
        tone === 'error' ? 'text-maybe-ink' : 'text-sepia-ink',
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{icon ?? <InfoIcon size={16} />}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
