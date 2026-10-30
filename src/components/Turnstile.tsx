import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { loadTurnstile, TURNSTILE_SITE_KEY, type TurnstileAction, type TurnstileApi } from '../lib/turnstile'

export type TurnstileHandle = { reset: () => void }

/**
 * Cloudflare Turnstile のウィジェット（spec.md 15.2）。
 * ふだんは何も出ず（interaction-only）、怪しいときだけチェックボックスが出る。出たときだけ場所を取る。
 */
export function Turnstile({
  action,
  onToken,
  ref,
}: {
  action: TurnstileAction
  /** トークンが取れたら文字列、切れた・失敗したら null */
  onToken: (token: string | null) => void
  ref?: Ref<TurnstileHandle>
}) {
  const box = useRef<HTMLDivElement>(null)
  const api = useRef<{ t: TurnstileApi; id: string } | null>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  // render のコールバックからいつも最新の onToken を呼ぶ
  const onTokenRef = useRef(onToken)
  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  // 依存を空にして、同じ handle を渡し続ける（毎回作り直すとコールバック ref が呼ばれ続けて止まらない）
  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        if (api.current) api.current.t.reset(api.current.id)
      },
    }),
    [],
  )

  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then((t) => {
        if (cancelled || !box.current) return
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const id = t.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          appearance: 'interaction-only',
          theme: dark ? 'dark' : 'light',
          language: 'ja',
          'refresh-expired': 'auto',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
          'before-interactive-callback': () => setVisible(true),
          'after-interactive-callback': () => setVisible(false),
        })
        api.current = { t, id }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (api.current) api.current.t.remove(api.current.id)
      api.current = null
    }
  }, [action])

  return (
    // チェックボックスが出たときは、方眼の上に白い紙を1枚置いたように余白を取る（枠や影は足さない）
    <div className={visible ? 'flex justify-center rounded-card bg-card px-3 py-4' : undefined}>
      <div ref={box} />
      {failed && (
        <p className="text-note text-maybe-ink" role="alert">
          確認サービスを読みこめませんでした。ページを読みこみ直してください
        </p>
      )}
    </div>
  )
}
