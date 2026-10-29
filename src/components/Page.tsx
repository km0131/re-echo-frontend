import type { ReactNode } from 'react'
import { cx } from '../lib/cx'

/**
 * 画面の外枠。スマホは全幅、640px以上は最大480pxで中央寄せ（背景の方眼は全幅）。
 * 左右余白は18px（ゲート・ログインは wide で28px）。
 */
export function Page({
  children,
  wide,
  className,
}: {
  children: ReactNode
  wide?: boolean
  className?: string
}) {
  return (
    <main className={cx('mx-auto w-full sm:max-w-content', wide ? 'px-gutter-wide' : 'px-gutter', className)}>
      {children}
    </main>
  )
}

/** 画面タイトル（h1）。 */
export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h1 className="font-hand text-h1 text-navy">{children}</h1>
      {aside}
    </div>
  )
}
