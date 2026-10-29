import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; children: ReactNode }

// 押せる範囲（button）は44px、見た目のピル（span）は design.md の高さにする
const hit = 'group inline-flex h-tap shrink-0 items-center focus-visible:outline-none'

/** 選択式のピル（アンケートの選択肢など）。見た目は高さ40px。折り返し並び。 */
export function Pill({ selected, className, type = 'button', children, ...rest }: Props) {
  return (
    <button type={type} aria-pressed={selected} className={cx(hit, className)} {...rest}>
      <span
        className={cx(
          'inline-flex h-10 items-center rounded-pill border px-3.5 text-body transition-colors group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-navy',
          selected
            ? 'border-navy bg-navy text-paper'
            : 'border-field bg-card text-ink group-hover:border-navy',
          'group-disabled:opacity-40',
        )}
      >
        {children}
      </span>
    </button>
  )
}

/** 絞り込みのチップ（ギャラリーなど）。見た目は高さ36px。横スクロールの中に並べる。 */
export function FilterChip({ selected, className, type = 'button', children, ...rest }: Props) {
  return (
    <button type={type} aria-pressed={selected} className={cx(hit, className)} {...rest}>
      <span
        className={cx(
          'inline-flex h-9 items-center rounded-chip border px-3.5 text-label transition-colors group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-navy',
          selected
            ? 'border-navy bg-navy text-paper'
            : 'border-field bg-card text-ink group-hover:border-navy',
        )}
      >
        {children}
      </span>
    </button>
  )
}

/** ピルの並び。押せる範囲が44pxあるので、行の間は詰めて見た目の間隔を8px程度にする。 */
export function PillGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div role="group" aria-label={label} className="-my-0.5 flex flex-wrap gap-x-2 gap-y-0">
      {children}
    </div>
  )
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="-mx-gutter flex gap-2 overflow-x-auto px-gutter">{children}</div>
}
