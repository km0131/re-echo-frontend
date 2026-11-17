import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ToastContext } from '../lib/toast'
import { DeleteIcon, InfoIcon } from './icons'

const SHOW_MS = 6000

/**
 * 通信エラーのトースト。Notice（お知らせ帯）と同じ見た目で、画面の下に1つだけ出す。
 * 6秒で消える。読み上げは role="alert"。動きは fade-in だけ（reduced-motion では止まる）。
 * シートやダイアログ（top layer に出る dialog）が開いているときは、その中に出す。外に出すと下に隠れ、操作もできないため。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; host: Element } | null>(null)
  const show = useCallback((message: string) => {
    // いちばん手前の開いている dialog（入れ子なら内側）。なければ body
    const dialogs = document.querySelectorAll('dialog[open]')
    const host = dialogs.length > 0 ? dialogs[dialogs.length - 1] : document.body
    setToast({ id: Date.now(), message, host })
  }, [])
  const api = useMemo(() => ({ show }), [show])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), SHOW_MS)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-gutter pb-[calc(16px+env(safe-area-inset-bottom))]">
            <div
              role="alert"
              key={toast.id}
              className="pointer-events-auto mx-auto flex w-full items-start gap-2 rounded-field border border-line bg-highlight py-1 pl-3.5 pr-1 text-note text-maybe-ink shadow-note motion-safe:animate-fade-in sm:max-w-content"
            >
              <span className="mt-3 shrink-0">
                <InfoIcon size={16} />
              </span>
              <p className="min-w-0 flex-1 py-2.5">{toast.message}</p>
              <button
                type="button"
                aria-label="お知らせを閉じる"
                onClick={() => setToast(null)}
                className="inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-field text-muted hover:text-navy"
              >
                <DeleteIcon size={16} />
              </button>
            </div>
          </div>,
          toast.host,
        )}
    </ToastContext.Provider>
  )
}
