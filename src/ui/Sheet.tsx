import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { DeleteIcon } from './icons'

/** 下へこれ以上ずらして離したら「閉じたい」とみなす（px） */
const SWIPE_CLOSE_PX = 80

/**
 * 下から出るシート（スマホ）／中央のモーダル（幅640px以上）。ネイティブの dialog 要素なので、
 * フォーカスは中に閉じ込められる。見出しと閉じるボタンは上に固定し、中身だけスクロールする。
 *
 * 閉じ方は4つ（閉じるボタン・背景のタップ・Esc・見出しを下へスワイプ）。どれも onClose を呼ぶだけで、
 * 実際に閉じるかは親が open で決める（未保存の確認を挟めるようにするため）。
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  /** 閉じたいとき（4つの閉じ方のどれか）。閉じるなら親が open を false にする */
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const swipe = useRef<{ startY: number; id: number } | null>(null)
  const [dragY, setDragY] = useState(0)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  // 見出しを下へスワイプ（タッチとペンだけ。マウスは閉じるボタンか背景のクリックで）
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('button')) return
    swipe.current = { startY: e.clientY, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (swipe.current?.id !== e.pointerId) return
    setDragY(Math.max(0, e.clientY - swipe.current.startY))
  }
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (swipe.current?.id !== e.pointerId) return
    const dy = e.clientY - swipe.current.startY
    swipe.current = null
    setDragY(0) // 閉じなかったとき（未保存の確認でやめたとき）は元の位置に戻る
    if (dy > SWIPE_CLOSE_PX) onClose()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Esc。ブラウザに閉じさせず、親に任せる。中の確認ダイアログの Esc（React では伝わってくる）は無視する
        if (e.target !== e.currentTarget) return
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // 背景（::backdrop）のタップは dialog 自身へのクリックとして届く
        if (e.target === e.currentTarget) onClose()
      }}
      style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-card border border-b-0 border-line bg-paper p-0 text-ink backdrop:bg-scrim/60 sm:m-auto sm:max-h-[calc(100dvh-48px)] sm:max-w-content sm:rounded-card sm:border-b"
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            className="relative flex touch-none items-center justify-between gap-2 border-b border-line bg-card pb-1 pl-gutter pr-1.5 pt-2 sm:py-1"
          >
            {/* スワイプで閉じられることを示すつまみ（スマホだけ） */}
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1.5 h-1 w-9 -translate-x-1/2 rounded-tag bg-line sm:hidden"
            />
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
