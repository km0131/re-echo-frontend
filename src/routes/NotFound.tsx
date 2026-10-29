import { Page } from '../components/Page'
import { EmptyState } from '../ui'

export default function NotFound() {
  return (
    <Page className="py-24">
      <EmptyState title="ページが見つかりません" note="URLをもう一度確かめてください" />
    </Page>
  )
}
