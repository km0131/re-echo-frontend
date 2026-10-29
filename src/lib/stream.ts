// SSE（/events/{slug}/stream）で変更を受け取り、TanStack Query の該当クエリを取り直す
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { API_BASE } from './api'
import { participantKeys } from './participant'
import { photoKeys } from './photos'
import { storage } from './storage'

const RECONNECT_MS = 5000

/** イベントトップを開いているあいだ、変更の通知を受け取る。タブが隠れているあいだは切断する。 */
export function useEventStream(slug: string, enabled = true) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return
    let es: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const refreshAll = () => {
      void qc.invalidateQueries({ queryKey: participantKeys.detail(slug) })
      void qc.invalidateQueries({ queryKey: photoKeys.list(slug) })
    }

    const open = () => {
      if (stopped || document.visibilityState === 'hidden') return
      const gate = storage.getGate(slug)
      if (!gate) return
      es = new EventSource(`${API_BASE}/events/${slug}/stream?gate=${encodeURIComponent(gate)}`)
      es.addEventListener('changed', (e) => {
        let kind = ''
        try {
          kind = (JSON.parse((e as MessageEvent).data) as { kind?: string }).kind ?? ''
        } catch {
          // 中身が読めなくても取り直す
        }
        if (kind === 'photos') void qc.invalidateQueries({ queryKey: photoKeys.list(slug) })
        else void qc.invalidateQueries({ queryKey: participantKeys.detail(slug) })
      })
      es.onerror = () => {
        // 通常の切断は EventSource が自分でつなぎ直す。閉じてしまった（401 など）ときだけ、こちらでやり直す
        if (es?.readyState === EventSource.CLOSED) {
          es = null
          clearTimeout(retry)
          retry = setTimeout(() => {
            refreshAll() // 合言葉が変わっていればここで gate_required になり、ゲートに戻る
            open()
          }, RECONNECT_MS)
        }
      }
    }
    const close = () => {
      clearTimeout(retry)
      es?.close()
      es = null
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        close()
      } else if (!es) {
        refreshAll() // 隠れていたあいだの変更を取り直す
        open()
      }
    }

    open()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisibility)
      close()
    }
  }, [slug, enabled, qc])
}
