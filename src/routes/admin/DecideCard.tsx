import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminKeys, useSessionGuard } from '../../lib/admin'
import { api } from '../../lib/api'
import { cx } from '../../lib/cx'
import type { AdminEvent } from '../../lib/types'
import { Button, Card, CardTitle, ChoiceCounts, Dialog, EmptyState, ErrorNotice } from '../../ui'

/** 日程を決める（design.md 3.8）。上位3件をラジオで選び、1位の行は highlight。 */
export function DecideCard({ event: d }: { event: AdminEvent }) {
  const qc = useQueryClient()
  const guard = useSessionGuard()
  const [picked, setPicked] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [undoOpen, setUndoOpen] = useState(false)
  const selected = picked ?? d.best[0] ?? null

  const mutate = useMutation({
    mutationFn: (candidateId: string | null) =>
      api<AdminEvent>(`/events/${d.slug}/confirm`, {
        method: candidateId ? 'POST' : 'DELETE',
        body: candidateId ? { candidateId } : undefined,
        auth: { session: true, admin: d.slug },
      }),
    onSuccess: (res) => {
      setError(null)
      setUndoOpen(false)
      qc.setQueryData(adminKeys.event(d.slug), res)
      void qc.invalidateQueries({ queryKey: adminKeys.events })
      void qc.invalidateQueries({ queryKey: ['event', d.slug] })
    },
    onError: (e) => {
      setUndoOpen(false)
      if (!guard(e)) setError(e.message)
    },
  })

  if (d.confirmed) {
    return (
      <Card>
        <CardTitle>日程を決める</CardTitle>
        <div className="rounded-btn bg-highlight px-3.5 py-3">
          <p className="text-tiny text-muted">決定した日</p>
          <p className="text-lead font-bold text-navy">{d.confirmed.label}</p>
          {d.confirmed.daysLeft > 0 && (
            <p className="text-note text-muted">開催まであと{d.confirmed.daysLeft}日</p>
          )}
        </div>
        {error && <ErrorNotice message={error} />}
        <Button variant="secondary" onClick={() => setUndoOpen(true)}>
          決定を取り消す
        </Button>
        <Dialog
          open={undoOpen}
          title="決定を取り消しますか？"
          confirmLabel="取り消す"
          busy={mutate.isPending}
          onClose={() => setUndoOpen(false)}
          onConfirm={() => mutate.mutate(null)}
        >
          <p>参加者の画面は「日程調整中」に戻ります。</p>
        </Dialog>
      </Card>
    )
  }

  const rows = d.best.map((id) => d.candidates.find((c) => c.id === id)).filter((c) => !!c)
  return (
    <Card>
      <CardTitle>日程を決める</CardTitle>
      {rows.length === 0 ? (
        <EmptyState title="まだ回答がありません" note="回答が集まると、いい感じの日がここに出ます" />
      ) : (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">決定する日</legend>
          {rows.map((c, i) => (
            <label
              key={c.id}
              className={cx(
                'flex min-h-tap cursor-pointer items-center gap-3 rounded-field px-3 py-2',
                i === 0 && 'bg-highlight',
              )}
            >
              <input
                type="radio"
                name="decide"
                value={c.id}
                checked={selected === c.id}
                onChange={() => setPicked(c.id)}
                className="h-5 w-5 shrink-0 accent-navy"
              />
              <span className={cx('flex-1 text-body', i === 0 && 'font-bold')}>{c.label}</span>
              {c.counts && <ChoiceCounts counts={c.counts} showNo={false} className="text-label" />}
            </label>
          ))}
        </fieldset>
      )}
      {error && <ErrorNotice message={error} />}
      <Button disabled={!selected || mutate.isPending} onClick={() => selected && mutate.mutate(selected)}>
        この日に決定する
      </Button>
    </Card>
  )
}
