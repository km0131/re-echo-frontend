import { useEffect, useSyncExternalStore } from 'react'
import { apiReachability, pingApi } from '../lib/api'

// 開発時だけ、backend に届かないことを画面上部に出す
export function ApiStatusBanner() {
  const unreachable = useSyncExternalStore(apiReachability.subscribe, apiReachability.get)
  useEffect(() => {
    if (import.meta.env.DEV) void pingApi()
  }, [])
  if (!import.meta.env.DEV || !unreachable) return null
  return (
    <div role="alert" className="bg-highlight px-gutter py-2.5 text-note text-maybe-ink">
      API に接続できません。backend で make up してください
    </div>
  )
}
