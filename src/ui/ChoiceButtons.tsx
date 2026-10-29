import { useRef, type KeyboardEvent } from 'react'
import { cx } from '../lib/cx'
import { CHOICES, type Choice } from './styles'

const selected: Record<Choice, string> = {
  yes: 'border-yes bg-yes text-card',
  maybe: 'border-maybe bg-maybe text-card',
  no: 'border-no bg-no text-card',
}

/**
 * ◯△✕ の3択。3つで1つの radiogroup。矢印キーで選択を移動できる。
 * 色だけで区別しないよう、記号は必ず表示する。
 */
export function ChoiceButtons({
  value,
  onChange,
  label,
  invalid,
}: {
  value: Choice | undefined
  onChange: (v: Choice) => void
  /** スクリーンリーダー用（例「12/29（火）19:00〜」） */
  label: string
  invalid?: boolean
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const current = CHOICES.findIndex((c) => c.value === value)
  // 未選択のときは先頭にフォーカスが入るようにする
  const focusIndex = current >= 0 ? current : 0

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % CHOICES.length
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i + CHOICES.length - 1) % CHOICES.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = CHOICES.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(CHOICES[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      className="flex shrink-0 gap-1.5"
    >
      {CHOICES.map((c, i) => {
        const on = value === c.value
        return (
          <button
            key={c.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${c.mark} ${c.label}`}
            tabIndex={i === focusIndex ? 0 : -1}
            onClick={() => onChange(c.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'h-tap w-12 rounded-field border-strong text-lead font-bold transition-colors',
              on ? selected[c.value] : 'border-field bg-card text-off hover:border-navy',
            )}
          >
            {c.mark}
          </button>
        )
      })}
    </div>
  )
}

/** 集計の書き方「◯18 △4 ✕2」（記号だけ色付き、数字は ink） */
export function ChoiceCounts({
  counts,
  showNo = true,
  className,
}: {
  counts: { yes: number; maybe: number; no: number }
  showNo?: boolean
  className?: string
}) {
  return (
    <span className={cx('whitespace-nowrap tabular-nums text-ink', className)}>
      <span className="text-yes">◯</span>
      {counts.yes} <span className="text-maybe">△</span>
      {counts.maybe}
      {showNo && (
        <>
          {' '}
          <span className="text-no">✕</span>
          {counts.no}
        </>
      )}
    </span>
  )
}

const markColor: Record<Choice, string> = { yes: 'text-yes', maybe: 'text-maybe', no: 'text-no' }

/** 表のセルなどに置く記号1つ。 */
export function ChoiceMark({ choice }: { choice: Choice | undefined }) {
  if (!choice) return <span className="text-off">－</span>
  const c = CHOICES.find((x) => x.value === choice)!
  return (
    <span className={cx('font-bold', markColor[choice])} aria-label={c.label}>
      {c.mark}
    </span>
  )
}
