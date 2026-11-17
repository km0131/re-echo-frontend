import { useState } from 'react'
import { useAdminResponses } from '../../lib/adminResponses'
import { formatDateTime } from '../../lib/date'
import type { AdminEvent, AdminResponseItem } from '../../lib/types'
import { Button, CHOICES, EmptyState, ErrorNotice, NextIcon, PlusIcon, Skeleton, Tag } from '../../ui'
import { ResponseSheet } from './ResponseSheet'

const MARK_COLOR = { yes: 'text-yes', maybe: 'text-maybe', no: 'text-no' } as const

/** 「回答」タブ（修正03）。全員の回答をカードで並べ、タップで編集シートを開く。 */
export function ResponsesTab({ event: d }: { event: AdminEvent }) {
  const list = useAdminResponses(d.slug)
  // null：閉じている／'new'：代理で追加／それ以外：その回答を編集
  const [target, setTarget] = useState<AdminResponseItem | 'new' | null>(null)

  return (
    <div className="flex flex-col gap-section-sm">
      <div className="flex flex-col gap-1.5">
        <Button variant="dashed" onClick={() => setTarget('new')}>
          <PlusIcon size={18} />
          代理で回答を追加
        </Button>
        <p className="text-note text-muted">電話やLINEで聞いた回答を、代わりに入れられます</p>
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="読み込み中">
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-[104px]" />
        </div>
      ) : list.error ? (
        <ErrorNotice message={list.error.message} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title="まだ回答がありません" note="「代理で回答を追加」から入れることもできます" />
      ) : (
        <section aria-labelledby="responses-heading" className="flex flex-col gap-2">
          <h2 id="responses-heading" className="flex items-baseline justify-between">
            <span className="font-hand text-h2-admin text-navy">みんなの回答</span>
            <span className="text-note text-muted">{list.data.length}人</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {list.data.map((r) => (
              <li key={r.id}>
                <ResponseRow
                  response={r}
                  candidateIds={d.candidates.map((c) => c.id)}
                  onOpen={() => setTarget(r)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ResponseSheet event={d} target={target} onClose={() => setTarget(null)} />
    </div>
  )
}

function ResponseRow({
  response: r,
  candidateIds,
  onOpen,
}: {
  response: AdminResponseItem
  candidateIds: string[]
  onOpen: () => void
}) {
  const counts = { yes: 0, maybe: 0, no: 0 }
  for (const id of candidateIds) {
    const c = r.choices[id]
    if (c) counts[c]++
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded-card border border-line bg-card px-4 py-3 text-left hover:border-navy"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 break-all text-title font-medium text-ink">{r.name}</span>
          {r.updatedBy === 'admin' && <Tag variant="sepia">幹事が編集</Tag>}
        </div>
        <p className="flex flex-wrap items-center gap-x-3 text-label tabular-nums text-ink">
          <span aria-label={`◯${counts.yes} △${counts.maybe} ✕${counts.no}`} className="flex gap-2">
            {CHOICES.map((c) => (
              <span key={c.value} aria-hidden="true">
                <span className={MARK_COLOR[c.value]}>{c.mark}</span>
                {counts[c.value]}
              </span>
            ))}
          </span>
          <span className="text-note text-muted">{r.hasPin ? 'PINあり' : 'PINなし'}</span>
        </p>
        {r.comment && <p className="truncate font-hand text-body text-sepia-ink">{r.comment}</p>}
        <p className="text-tiny text-muted">最終更新 {formatDateTime(r.updatedAt)}</p>
      </div>
      <NextIcon size={20} className="shrink-0 text-muted" />
    </button>
  )
}
