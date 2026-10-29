import { useEffect } from 'react'
import { Link, Navigate } from 'react-router'
import { Page, PageTitle } from '../../components/Page'
import { METHOD_LABEL, useMe, useMyEvents, useSessionGuard } from '../../lib/admin'
import { cx } from '../../lib/cx'
import { daysUntil, formatDateTime, monthsSince } from '../../lib/date'
import { storage } from '../../lib/storage'
import type { EventListItem } from '../../lib/types'
import { ButtonLink, ClockIcon, EmptyState, ErrorNotice, PersonIcon, PlusIcon, Skeleton, Tag } from '../../ui'

/** ダッシュボード（design.md 3.7） */
export default function DashboardPage() {
  if (!storage.getSession()) return <Navigate to="/login" replace />
  return <Dashboard />
}

function Dashboard() {
  const me = useMe()
  const events = useMyEvents()
  const guard = useSessionGuard()

  useEffect(() => {
    document.title = '出欠帳｜わたしのイベント'
  }, [])
  useEffect(() => {
    if (me.error) guard(me.error)
    if (events.error) guard(events.error)
  }, [me.error, events.error, guard])

  const prev = me.data?.previousLogin
  return (
    <Page className="flex flex-col gap-section pb-10">
      <div className="flex h-14 items-center justify-between">
        <span className="font-hand text-[22px] text-navy">出欠帳</span>
        <Link
          to="/settings"
          aria-label="アカウント設定"
          className="-mr-2.5 inline-flex h-tap w-tap items-center justify-center rounded-field text-navy hover:bg-highlight"
        >
          <PersonIcon />
        </Link>
      </div>

      {me.data && (
        <p className="-mt-2 flex items-center gap-2 border-y border-dashed border-dash py-2.5 text-note text-muted">
          <ClockIcon size={16} className="shrink-0" />
          {prev
            ? `前回のログイン：${formatDateTime(prev.at)} ・ ${METHOD_LABEL[prev.method] ?? prev.method} ・ ${prev.device}`
            : '前回のログイン：はじめてのログインです'}
        </p>
      )}

      <PageTitle aside={events.data && <span className="text-note text-muted">{events.data.length}件</span>}>
        わたしのイベント
      </PageTitle>

      {events.error && <ErrorNotice message={events.error.message} onRetry={() => void events.refetch()} />}
      {events.isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-24" />
        </div>
      )}
      {events.data && events.data.length === 0 && (
        <EmptyState title="まだイベントがありません" note="下のボタンから最初のイベントをつくろう" />
      )}
      {events.data && events.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {events.data.map((e) => (
            <EventCard key={e.slug} event={e} />
          ))}
        </ul>
      )}

      <ButtonLink to="/events/new" variant="dashed">
        <PlusIcon size={18} /> 新しいイベントをつくる
      </ButtonLink>
    </Page>
  )
}

function EventCard({ event: e }: { event: EventListItem }) {
  const open = e.status === 'open'
  const ended = e.status === 'ended'
  const meta: string[] = []
  if (open) {
    meta.push(e.classSize ? `回答 ${e.responseCount} / ${e.classSize}人` : `回答 ${e.responseCount}人`)
    meta.push(`候補 ${e.candidateCount}日`)
    if (e.pendingPhotoCount > 0) meta.push(`承認待ち写真 ${e.pendingPhotoCount}`)
  } else if (e.status === 'confirmed' && e.confirmed) {
    meta.push(e.confirmed.label)
    const left = daysUntil(e.confirmed.startsAt)
    if (left > 0) meta.push(`あと${left}日`)
    else if (left === 0) meta.push('今日')
  } else if (ended) {
    const m = monthsSince(e.endsOn)
    if (e.photoCount > 0) meta.push(`写真 ${e.photoCount}枚`)
    meta.push(m > 0 ? `終了から${m}か月` : '終了しました')
  }
  return (
    <li>
      <Link
        to={`/e/${e.slug}/admin`}
        className={cx(
          'flex flex-col gap-2 rounded-card bg-card p-4 transition-colors hover:bg-paper',
          open ? 'border-strong border-navy' : 'border border-line',
          ended && 'opacity-75',
        )}
      >
        <div>
          {open && <Tag>回答受付中</Tag>}
          {e.status === 'confirmed' && <Tag variant="sepia">日程確定</Tag>}
          {ended && <Tag variant="off">終了</Tag>}
        </div>
        <p className="text-title font-bold text-ink">{e.title}</p>
        <p className="text-note text-muted">{meta.join(' ・ ')}</p>
        {e.deletionSuggested && (
          <p className="text-note text-maybe-ink">
            終了から1年たちました。もう使わなければ、管理画面から削除できます
          </p>
        )}
        {open && e.classSize && (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-highlight"
            role="progressbar"
            aria-label="回答率"
            aria-valuemin={0}
            aria-valuemax={e.classSize}
            aria-valuenow={e.responseCount}
          >
            <div
              className="h-full rounded-full bg-yes"
              style={{ width: `${Math.min(100, (e.responseCount / e.classSize) * 100)}%` }}
            />
          </div>
        )}
      </Link>
    </li>
  )
}
