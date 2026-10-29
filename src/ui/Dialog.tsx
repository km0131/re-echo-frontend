import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from './Button'

/** 確認ダイアログ（ネイティブの dialog 要素。Esc で閉じる） */
export function Dialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'やめる',
  onConfirm,
  onClose,
  busy,
  caution,
}: {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onClose: () => void
  busy?: boolean
  caution?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="m-auto w-[calc(100%-36px)] max-w-[400px] rounded-card border border-line bg-card p-0 text-ink backdrop:bg-scrim/60"
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          onConfirm()
        }}
      >
        <h2 className="font-hand text-h2-admin text-navy">{title}</h2>
        {children && <div className="flex flex-col gap-3 text-body">{children}</div>}
        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            disabled={busy}
            className={caution ? 'bg-maybe-ink hover:bg-maybe' : undefined}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
