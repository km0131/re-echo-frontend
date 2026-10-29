import { useCallback, useState } from 'react'
import { useParams } from 'react-router'
import { storage } from '../../lib/storage'
import { GateScreen } from './GateScreen'
import { TopScreen } from './TopScreen'

/** /e/:slug … 通過トークンがなければ合言葉ゲート、あればイベントトップ */
export default function EventPage() {
  const { slug = '' } = useParams()
  const [gate, setGate] = useState(() => storage.getGate(slug))
  const onGateLost = useCallback(() => {
    storage.setGate(slug, null)
    setGate(null)
  }, [slug])

  if (!gate) return <GateScreen key={slug} slug={slug} onPassed={setGate} />
  return <TopScreen key={slug} slug={slug} onGateLost={onGateLost} />
}
