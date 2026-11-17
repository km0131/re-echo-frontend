import { useEffect, useId, useRef, type ReactNode } from 'react'
import { DeleteIcon } from './icons'

/**
 * 下から出るシート（スマホ）／中央のモーダル（幅640px以上）。ネイティブの dialog 要素なので、
 * フォーカスは中に閉じ込められ、Esc で閉じる。見出しと閉じるボタンは上に固定し、中身だけスクロールする。
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-card border border-b-0 border-line bg-paper p-0 text-ink backdrop:bg-scrim/60 sm:m-auto sm:max-h-[calc(100dvh-48px)] sm:max-w-content sm:rounded-card sm:border-b"
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-card py-1 pl-gutter pr-1.5">
            <h2 id={titleId} className="min-w-0 truncate font-hand text-h2-admin text-navy">
              {title}
            </h2>
            <button
              type="button"
              aria-label="閉じる"
              onClick={onClose}
              className="inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-field text-muted hover:text-navy"
            >
              <DeleteIcon size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pb-[calc(24px+env(safe-area-inset-bottom))] pt-4">
            {children}
          </div>
        </div>
      )}
    </dialog>
  )
}
