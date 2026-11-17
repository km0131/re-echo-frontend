// 部品で共有するクラス名（Fast Refresh のため、コンポーネントとは別ファイルに置く）
import { cx } from '../lib/cx'

export type Variant = 'primary' | 'secondary' | 'dashed' | 'caution'

const buttonBase =
  'inline-flex w-full items-center justify-center gap-2 px-4 text-input font-bold tracking-button transition-colors disabled:cursor-not-allowed disabled:opacity-60'

const variants: Record<Variant, string> = {
  primary: 'h-[54px] rounded-btn bg-navy text-paper hover:bg-navy-deep active:bg-navy-deep',
  // 取り消せない操作の実行ボタン（確認ダイアログの「削除する」など）。主ボタンと同じ形で、色だけ maybe-ink
  caution: 'h-[54px] rounded-btn bg-maybe-ink text-paper hover:bg-maybe active:bg-maybe',
  secondary: 'h-[52px] rounded-btn border-strong border-navy bg-card text-navy hover:bg-highlight',
  dashed:
    'h-[52px] rounded-btn border-strong border-dashed border-navy bg-transparent text-navy hover:bg-card',
}

export function buttonClass(variant: Variant = 'primary', className?: string) {
  return cx(buttonBase, variants[variant], className)
}

/** 傾き。design.md の「-3deg〜+2deg」から選ぶ。 */
export const TILTS = ['-rotate-3', '-rotate-2', '-rotate-1', 'rotate-1', 'rotate-2'] as const
export type Tilt = (typeof TILTS)[number] | 'rotate-0' | string

/** 写真が読み込まれる前の下地の色（photo-1〜5 を順番に） */
export const PHOTO_BG = ['bg-photo-1', 'bg-photo-2', 'bg-photo-3', 'bg-photo-4', 'bg-photo-5'] as const

export type Choice = 'yes' | 'maybe' | 'no'

export const CHOICES: { value: Choice; mark: string; label: string }[] = [
  { value: 'yes', mark: '◯', label: '行ける' },
  { value: 'maybe', mark: '△', label: 'たぶん行ける' },
  { value: 'no', mark: '✕', label: '行けない' },
]
