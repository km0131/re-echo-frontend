import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cx } from '../lib/cx'
import { buttonClass, type Variant } from './styles'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

/** 主・副・点線のボタン。全幅が基本。 */
export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...rest} />
}

/** ボタンの見た目のリンク。 */
export function ButtonLink({ variant = 'primary', className, ...rest }: LinkProps & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...rest} />
}

type SmallVariant = 'outline' | 'primary' | 'caution' | 'dashed'

const smallVariants: Record<SmallVariant, string> = {
  outline: 'border-strong border-navy bg-card text-navy hover:bg-highlight',
  primary: 'border-strong border-navy bg-navy text-paper hover:bg-navy-deep',
  caution: 'border-strong border-maybe bg-card text-maybe-ink hover:bg-highlight',
  dashed: 'border-strong border-dashed border-navy bg-transparent text-navy hover:bg-card',
}

type SmallButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: SmallVariant }

/** 高さ44pxの小さいボタン。注意系（再発行など）は variant="caution"。 */
export function SmallButton({ variant = 'outline', className, type = 'button', ...rest }: SmallButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex h-tap min-w-tap items-center justify-center gap-1.5 rounded-field px-4 text-label font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        smallVariants[variant],
        className,
      )}
      {...rest}
    />
  )
}

/** 文字だけのボタン（「再読み込み」「ログアウト」など）。押せる範囲は44px確保する。 */
export function TextButton({ className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex min-h-tap items-center px-1 text-label text-muted underline underline-offset-4 hover:text-navy',
        className,
      )}
      {...rest}
    />
  )
}
