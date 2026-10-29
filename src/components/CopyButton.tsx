import { useEffect, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { CopyIcon, SmallButton } from '../ui'

/** コピーボタン。コピー後2秒間「コピーしました」に変わる（トーストは使わない）。 */
export function CopyButton({
  text,
  label = 'コピー',
  variant = 'outline',
  className,
}: {
  text: string | (() => Promise<string>)
  label?: string
  variant?: 'outline' | 'primary'
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'done' | 'fail'>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const t = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(t)
  }, [state])
  return (
    <SmallButton
      variant={variant}
      className={className}
      aria-live="polite"
      onClick={async () => {
        try {
          const value = typeof text === 'string' ? text : await text()
          setState((await copyText(value)) ? 'done' : 'fail')
        } catch {
          setState('fail')
        }
      }}
    >
      <CopyIcon size={16} />
      {state === 'done' ? 'コピーしました' : state === 'fail' ? 'コピーできませんでした' : label}
    </SmallButton>
  )
}
