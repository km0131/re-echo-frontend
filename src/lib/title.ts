import { useEffect } from 'react'

/** <title> を「出欠帳｜{名前}」にする */
export function useTitle(name: string | undefined) {
  useEffect(() => {
    document.title = name ? `出欠帳｜${name}` : '出欠帳'
  }, [name])
}
