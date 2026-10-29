import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react'
import { cx } from '../lib/cx'

const fieldBase =
  'w-full rounded-field border-strong bg-card px-3.5 text-input text-ink placeholder:text-off focus:border-navy focus:outline-none'

function borderFor(value: unknown, invalid?: boolean) {
  if (invalid) return 'border-maybe'
  return value !== undefined && value !== '' ? 'border-navy' : 'border-field'
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
  ref?: Ref<HTMLInputElement>
}

/** 1行の入力欄。未入力は枠 field、フォーカス中・入力済みは navy。文字は16px（iOSのズーム防止）。 */
export function TextInput({ className, invalid, value, ...rest }: TextInputProps) {
  return (
    <input
      className={cx(fieldBase, 'h-[52px]', borderFor(value, invalid), className)}
      value={value}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; hand?: boolean }

/** 複数行の入力欄。ひとことコメントは hand で手書き風フォントにする。 */
export function TextArea({ className, invalid, value, hand, rows = 3, ...rest }: TextAreaProps) {
  return (
    <textarea
      rows={rows}
      className={cx(
        fieldBase,
        'py-3 leading-relaxed',
        hand && 'font-hand',
        borderFor(value, invalid),
        className,
      )}
      value={value}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

type PinInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
}

/** 4桁のPIN。数字以外は入らない。 */
export function PinInput({ value, onChange, invalid, className, ...rest }: PinInputProps) {
  return (
    <input
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={4}
      autoComplete="off"
      className={cx(
        'h-[50px] w-[140px] rounded-field border-strong bg-card pl-[.5em] text-center text-pin tracking-pin text-ink focus:border-navy focus:outline-none',
        borderFor(value, invalid),
        className,
      )}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

/** ラベル＋入力欄＋補足・エラーのまとまり。 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: (id: string, describedBy: string | undefined) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-medium text-ink">
        {label}
      </label>
      {children(id, describedBy)}
      {error && (
        <p id={errId} className="text-note text-maybe-ink" role="alert">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-note text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}
