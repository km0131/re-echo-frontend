import { cx } from '../lib/cx'
import { TextButton } from './Button'
import { Notice } from './Notice'

/** 読み込み中のプレースホルダー。スピナーは使わず、カードの形をふわっと明滅させる。 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx('rounded-card bg-highlight motion-safe:animate-breathe', className ?? 'h-24')}
    />
  )
}

/** 画面1つ分の読み込み中表示。 */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-section py-6" role="status" aria-label="読み込み中">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-28" />
      <Skeleton className="h-40" />
    </div>
  )
}

/** 通信エラー。画面上部に出す。 */
export function ErrorNotice({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Notice tone="error">
      <span>{message ?? '通信できませんでした。もう一度試してください'}</span>
      {onRetry && (
        <TextButton onClick={onRetry} className="ml-1 min-h-0 py-0 text-note text-maybe-ink">
          再読み込み
        </TextButton>
      )}
    </Notice>
  )
}

/** 空の状態。手書き風の一言＋補足。イラストは入れない。 */
export function EmptyState({ title, note }: { title: string; note?: string }) {
  return (
    <div className="py-6 text-center">
      <p className="font-hand text-lead text-navy">{title}</p>
      {note && <p className="mt-1 text-note text-muted">{note}</p>}
    </div>
  )
}
