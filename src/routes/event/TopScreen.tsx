import { useEffect } from 'react'
import { Link } from 'react-router'
import { Page } from '../../components/Page'
import { useEventDetail } from '../../lib/participant'
import { storage } from '../../lib/storage'
import { useEventStream } from '../../lib/stream'
import { ButtonLink, BottomBar, ErrorNotice, Skeleton } from '../../ui'
import { BestDays } from './BestDays'
import { Comments } from './Comments'
import { PhotoLink } from './PhotoLink'
import { ConfirmedCard } from './ConfirmedCard'
import { EventHeader } from './EventHeader'
import { ResponseMatrix } from './ResponseMatrix'
import { ApiError } from '../../lib/api'

/** イベントトップ（design.md 3.2）。セクションごとに部品を分け、フェーズ2・3の要素を後から差し込む。 */
export function TopScreen({ slug, onGateLost }: { slug: string; onGateLost: () => void }) {
  const detail = useEventDetail(slug)
  // 誰かが回答したら自動で更新する（SSE）
  useEventStream(slug, !detail.error)
  const answered = !!storage.getEdit(slug)

  useEffect(() => {
    if (detail.error instanceof ApiError && detail.error.code === 'gate_required') onGateLost()
  }, [detail.error, onGateLost])

  useEffect(() => {
    if (detail.data) document.title = `出欠帳｜${detail.data.title}`
  }, [detail.data])

  if (detail.isPending) {
    return (
      <div className="mx-auto w-full sm:max-w-content">
        <Skeleton className="h-[230px] rounded-none" />
        <Page className="flex flex-col gap-section py-section">
          <Skeleton className="h-16" />
          <Skeleton className="h-48" />
        </Page>
      </div>
    )
  }

  if (detail.error || !detail.data) {
    return (
      <Page className="py-10">
        <ErrorNotice message={detail.error?.message} onRetry={() => void detail.refetch()} />
      </Page>
    )
  }

  const d = detail.data
  return (
    <div className="mx-auto w-full sm:max-w-content">
      <EventHeader slug={slug} title={d.title} year={d.year} />
      <Page className="flex flex-col gap-section py-section">
        {d.description && (
          <p className="whitespace-pre-wrap break-words text-body text-ink">{d.description}</p>
        )}
        {d.confirmed && <ConfirmedCard confirmed={d.confirmed} />}
        {!d.confirmed && <BestDays best={d.best} candidates={d.candidates} />}

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-hand text-h2 text-navy">みんなの回答</h2>
            {d.responses.length > 0 && (
              <span className="text-note text-muted">{d.responses.length}人が回答</span>
            )}
          </div>
          <ResponseMatrix
            candidates={d.candidates}
            responses={d.responses}
            highlightId={d.confirmed?.candidateId ?? d.best[0]}
          />
          {/* このスマホで未回答でも、別のスマホで回答した人は名前＋PINで直せる（design.md 4章） */}
          {!answered && d.responses.some((r) => r.hasPin) && (
            <Link
              to={`/e/${slug}/edit`}
              className="inline-flex min-h-tap items-center self-start px-1 text-label text-muted underline underline-offset-4 hover:text-navy"
            >
              別のスマホで回答した人は、こちらから回答を直す
            </Link>
          )}
        </section>

        <Comments responses={d.responses} />

        <PhotoLink slug={slug} />
      </Page>
      <BottomBar>
        <ButtonLink to={`/e/${slug}/answer`}>{answered ? '回答を直す' : '回答する'}</ButtonLink>
      </BottomBar>
    </div>
  )
}
