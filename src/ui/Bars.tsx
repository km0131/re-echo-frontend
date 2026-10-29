import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { BackIcon } from './icons'

/** 上部のバー。左に戻るボタン（44×44px）、右にイベント名。 */
export function TopBar({
  title,
  backTo,
  onBack,
  aside,
  hideBack,
}: {
  title?: ReactNode
  backTo?: string
  onBack?: () => void
  aside?: ReactNode
  hideBack?: boolean
}) {
  const navigate = useNavigate()
  return (
    <div className="flex h-14 items-center gap-2">
      {!hideBack && (
        <button
          type="button"
          aria-label="戻る"
          onClick={() => (onBack ? onBack() : backTo ? navigate(backTo) : navigate(-1))}
          className="-ml-2.5 inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-field text-navy hover:bg-highlight"
        >
          <BackIcon />
        </button>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-2">
        {title && <p className="truncate text-label text-muted">{title}</p>}
        {aside}
      </div>
    </div>
  )
}

/** 画面下に固定する CTA の帯。中身の下に spacer を入れて重ならないようにする。 */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden="true" className="h-28" />
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bar px-gutter pb-[calc(24px+env(safe-area-inset-bottom))] pt-3.5 backdrop-blur-sm">
        <div className="mx-auto w-full sm:max-w-content">{children}</div>
      </div>
    </>
  )
}
