// Cloudflare Turnstile の api.js を、使う画面に入ったときだけ読み込む（spec.md 15.2）。
// 必要なのは render・reset・remove だけなので、外部パッケージは使わない。

export type TurnstileAction = 'login' | 'gate' | 'answer' | 'recover' | 'upload' | 'comment'

export type TurnstileOptions = {
  sitekey: string
  action: TurnstileAction
  appearance: 'always' | 'execute' | 'interaction-only'
  theme: 'light' | 'dark' | 'auto'
  language: string
  'refresh-expired': 'auto' | 'manual' | 'never'
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
  'before-interactive-callback': () => void
  'after-interactive-callback': () => void
}

export type TurnstileApi = {
  render: (el: HTMLElement, options: TurnstileOptions) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** サイトキー。空なら Turnstile を使わない（テストなど） */
export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

let loading: Promise<TurnstileApi> | null = null

/** api.js を1回だけ読み込む。失敗したら次に呼ばれたときにやり直す */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_URL
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')))
    s.onerror = () => {
      loading = null
      s.remove()
      reject(new Error('turnstile'))
    }
    document.head.appendChild(s)
  })
  return loading
}
