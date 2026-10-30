import { useCallback, useRef, useState } from 'react'
import { Turnstile, type TurnstileHandle } from '../components/Turnstile'
import { TURNSTILE_SITE_KEY, type TurnstileAction } from './turnstile'

/**
 * Turnstile の使い方を1つの形にそろえる（spec.md 15.2）。
 * - element を送信ボタンのすぐ上に置く
 * - ready になるまで送信ボタンは「確認中…」で押せない（interaction-only なので通常は一瞬）
 * - 送信が終わったら成功・失敗にかかわらず reset()（トークンは1回きり）
 * enabled が false（幹事としての投稿・回答の更新など）か、サイトキーが無ければ何もしない。
 */
export function useTurnstileToken(action: TurnstileAction, enabled = true) {
  const active = enabled && TURNSTILE_SITE_KEY !== ''
  const [token, setToken] = useState<string | null>(null)
  const tokenRef = useRef<string | null>(null)
  const waiters = useRef<((t: string) => void)[]>([])
  // ウィジェットの reset はコールバック ref で受け取る（描画中に ref を読まないように）
  const [widget, setWidget] = useState<TurnstileHandle | null>(null)

  const onToken = useCallback((t: string | null) => {
    tokenRef.current = t
    setToken(t)
    if (t) waiters.current.splice(0).forEach((w) => w(t))
  }, [])

  const reset = useCallback(() => {
    tokenRef.current = null
    setToken(null)
    widget?.reset()
  }, [widget])

  /** 次のトークンを待つ（写真を1枚ずつ送るときに、1枚ごとに新しいトークンを使うため） */
  const nextToken = useCallback((): Promise<string | undefined> => {
    if (!active) return Promise.resolve(undefined)
    if (tokenRef.current) return Promise.resolve(tokenRef.current)
    return new Promise((resolve) => waiters.current.push(resolve))
  }, [active])

  return {
    token: active ? token : null,
    ready: !active || token !== null,
    reset,
    nextToken,
    element: active ? <Turnstile action={action} onToken={onToken} ref={setWidget} /> : null,
  }
}
