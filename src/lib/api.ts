// API クライアント。トークンのヘッダー付与とエラー形式の変換はここだけで行う。
import { storage } from './storage'

/** API のベースURL。相対パス（/api/v1）と絶対URLの両方に対応する。 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

/** API の origin（/media や /og の URL を作るとき用）。相対パスのときは空文字。 */
export const API_ORIGIN = /^https?:\/\//.test(API_BASE) ? new URL(API_BASE).origin : ''

/** API のエラー。message はそのまま画面に出してよい。 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const NETWORK_ERROR_MESSAGE = '通信できませんでした。もう一度試してください'

/** どのトークンを付けるか（spec.md 2章のヘッダー）。 */
export type AuthSpec = {
  /** 幹事セッション → Authorization: Bearer */
  session?: boolean
  /** 合言葉通過トークン → X-Gate-Token（イベントの slug） */
  gate?: string
  /** 回答の編集トークン → X-Edit-Token（イベントの slug） */
  edit?: string
  /** 共同幹事の管理キー → X-Admin-Key（イベントの slug） */
  admin?: string
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: AuthSpec
  signal?: AbortSignal
}

// --- 開発時だけ「API に接続できません」を出すための状態 ---
type Listener = () => void
let unreachable = false
const listeners = new Set<Listener>()
function setUnreachable(v: boolean) {
  if (unreachable === v) return
  unreachable = v
  listeners.forEach((l) => l())
}
export const apiReachability = {
  get: () => unreachable,
  subscribe: (l: Listener) => {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

function buildHeaders(auth: AuthSpec | undefined, hasBody: boolean): Headers {
  const h = new Headers({ Accept: 'application/json' })
  if (hasBody) h.set('Content-Type', 'application/json')
  if (auth?.session) {
    const t = storage.getSession()
    if (t) h.set('Authorization', `Bearer ${t}`)
  }
  if (auth?.gate) {
    const t = storage.getGate(auth.gate)
    if (t) h.set('X-Gate-Token', t)
  }
  if (auth?.edit) {
    const e = storage.getEdit(auth.edit)
    if (e) h.set('X-Edit-Token', e.token)
  }
  if (auth?.admin) {
    const k = storage.getAdmin(auth.admin)
    if (k) h.set('X-Admin-Key', k)
  }
  return h
}

/** API を呼ぶ。2xx 以外は ApiError を投げる。204 は undefined を返す。 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const hasBody = opts.body !== undefined
  let res: Response
  try {
    res = await fetch(API_BASE + path, {
      method: opts.method ?? 'GET',
      headers: buildHeaders(opts.auth, hasBody),
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    setUnreachable(true)
    throw new ApiError(0, 'network', NETWORK_ERROR_MESSAGE)
  }

  const isJSON = (res.headers.get('Content-Type') || '').includes('application/json')
  // プロキシが backend に届かないとき（Vite は 5xx を JSON 以外で返す）
  if (!isJSON && res.status >= 500) {
    setUnreachable(true)
    throw new ApiError(res.status, 'network', NETWORK_ERROR_MESSAGE)
  }
  setUnreachable(false)

  if (res.status === 204) return undefined as T
  const data: unknown = isJSON ? await res.json().catch(() => null) : null
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(res.status, err?.code ?? 'unknown', err?.message ?? NETWORK_ERROR_MESSAGE)
  }
  return data as T
}

/** 開発時の起動チェック。存在しないパスを叩き、backend のエラーJSONが返れば届いている。 */
export async function pingApi(): Promise<void> {
  try {
    await api('/__ping')
  } catch {
    // ApiError（404 など）なら届いている。届かなければ setUnreachable 済み
  }
}

/** multipart の送信（写真アップロード用）。進捗を出すため XMLHttpRequest を使う。 */
export function upload<T>(
  path: string,
  form: FormData,
  auth: AuthSpec,
  onProgress?: (ratio: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', API_BASE + path)
    buildHeaders(auth, false).forEach((v, k) => xhr.setRequestHeader(k, v))
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onerror = () => reject(new ApiError(0, 'network', NETWORK_ERROR_MESSAGE))
    xhr.onload = () => {
      let data: unknown = null
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        data = null
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T)
        return
      }
      const err = (data as { error?: { code?: string; message?: string } } | null)?.error
      reject(new ApiError(xhr.status, err?.code ?? 'unknown', err?.message ?? NETWORK_ERROR_MESSAGE))
    }
    xhr.send(form)
  })
}

/** 認証つきで画像を取り、blob URL にする（管理画面の承認待ちなど、<img> ではヘッダーを付けられないもの用）。 */
export async function fetchBlobUrl(path: string, auth: AuthSpec, signal?: AbortSignal): Promise<string> {
  const res = await fetch(apiUrl(path), { headers: buildHeaders(auth, false), signal })
  if (!res.ok) throw new ApiError(res.status, 'media', '画像を読み込めませんでした')
  return URL.createObjectURL(await res.blob())
}

/** members の画像の URL（<img> 用に通過トークンをクエリで付ける）。 */
export function memberMediaUrl(path: string, slug: string): string {
  const gate = storage.getGate(slug)
  return apiUrl(path) + (gate ? `?gate=${encodeURIComponent(gate)}` : '')
}

/** /media や /og など、API と同じ origin の URL を作る。 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return API_ORIGIN + path
}
