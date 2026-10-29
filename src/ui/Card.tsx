import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx'

type Props = HTMLAttributes<HTMLElement> & { emphasis?: boolean; as?: 'section' | 'div' | 'li' | 'article' }

/** 普通のカード。影は付けない。強調時は枠1.5px navy。 */
export function Card({ emphasis, as: Tag = 'section', className, ...rest }: Props) {
  return (
    <Tag
      className={cx(
        'flex flex-col gap-3 rounded-card bg-card p-4',
        emphasis ? 'border-strong border-navy' : 'border border-line',
        className,
      )}
      {...rest}
    />
  )
}

/** カードの見出し（管理画面などで使う h2）。 */
export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-hand text-h2-admin text-navy">{children}</h2>
      {aside}
    </div>
  )
}
