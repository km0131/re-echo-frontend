import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { adminKeys } from '../../lib/admin'
import { api } from '../../lib/api'
import { cx } from '../../lib/cx'
import { fromTokyoInputs } from '../../lib/date'
import type { AdminCandidate, AdminEvent } from '../../lib/types'
import { Card, CardTitle, DeleteIcon, Dialog, DragIcon, ErrorNotice, SmallButton, TextInput } from '../../ui'

const LONG_PRESS_MS = 350

/** 候補日の一覧。ドラッグ（スマホは長押し）で並べ替え、行内で追加、確認つきで削除。 */
export function CandidatesCard({ slug, candidates }: { slug: string; candidates: AdminCandidate[] }) {
  const qc = useQueryClient()
  // 並べ替え中・保存中だけ手元の並びを持ち、それ以外はサーバーの内容をそのまま使う
  const [local, setItems] = useState<AdminCandidate[] | null>(null)
  const items = local ?? candidates
  const [dragId, setDragId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('19:00')
  const [removing, setRemoving] = useState<AdminCandidate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const press = useRef<{ timer?: number; startY: number; id: string; pointerId: number } | null>(null)

  const save = useMutation({
    mutationFn: (list: { id?: string; startsAt: string }[]) =>
      api<{ candidates: AdminCandidate[] }>(`/events/${slug}/candidates`, {
        method: 'PUT',
        body: { candidates: list },
        auth: { session: true, admin: slug },
      }),
    onSuccess: (res) => {
      setError(null)
      setItems(null)
      qc.setQueryData<AdminEvent>(adminKeys.event(slug), (old) =>
        old ? { ...old, candidates: res.candidates } : old,
      )
      void qc.invalidateQueries({ queryKey: adminKeys.event(slug) })
      void qc.invalidateQueries({ queryKey: ['event', slug] })
    },
    onError: (e) => {
      setError(e.message)
      setItems(null)
    },
  })

  const commit = (list: AdminCandidate[]) =>
    save.mutate(list.map((c) => ({ id: c.id, startsAt: c.startsAt })))

  const sameOrder = (a: AdminCandidate[], b: AdminCandidate[]) => a.every((c, i) => c.id === b[i]?.id)

  // --- ドラッグ ---
  const startDrag = (id: string, pointerId: number, target: Element) => {
    setDragId(id)
    try {
      target.setPointerCapture(pointerId)
    } catch {
      // 取れなくても続ける
    }
    navigator.vibrate?.(10)
  }

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    const target = e.currentTarget
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return
      startDrag(id, e.pointerId, target)
      return
    }
    // スマホは長押しで開始
    const pointerId = e.pointerId
    press.current = {
      id,
      pointerId,
      startY: e.clientY,
      timer: window.setTimeout(() => startDrag(id, pointerId, target), LONG_PRESS_MS),
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!dragId) {
      if (press.current && Math.abs(e.clientY - press.current.startY) > 8) {
        clearTimeout(press.current.timer)
        press.current = null
      }
      return
    }
    e.preventDefault()
    const from = items.findIndex((c) => c.id === dragId)
    let to = from
    items.forEach((c, i) => {
      const r = rowRefs.current[c.id]?.getBoundingClientRect()
      if (!r) return
      const mid = r.top + r.height / 2
      if (i < from && e.clientY < mid) to = Math.min(to, i)
      if (i > from && e.clientY > mid) to = Math.max(to, i)
    })
    if (to !== from) {
      const next = [...items]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      setItems(next)
    }
  }

  const endDrag = () => {
    if (press.current) {
      clearTimeout(press.current.timer)
      press.current = null
    }
    if (!dragId) return
    setDragId(null)
    if (!sameOrder(items, candidates)) commit(items)
    else setItems(null)
  }

  // キーボードでも並べ替えられるように（↑↓）
  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    if (!d) return
    e.preventDefault()
    const to = index + d
    if (to < 0 || to >= items.length) return
    const next = [...items]
    ;[next[index], next[to]] = [next[to], next[index]]
    setItems(next)
    commit(next)
    requestAnimationFrame(() => rowRefs.current[next[to].id]?.querySelector('button')?.focus())
  }

  const add = () => {
    const iso = fromTokyoInputs(date, time)
    if (!iso) {
      setError('日付と時刻を入れてください')
      return
    }
    save.mutate([...items.map((c) => ({ id: c.id, startsAt: c.startsAt })), { startsAt: iso }], {
      onSuccess: () => {
        setAdding(false)
        setDate('')
      },
    })
  }

  return (
    <Card>
      <CardTitle aside={<span className="text-note text-muted">{items.length}日</span>}>候補日</CardTitle>
      <p className="text-note text-muted">左のつまみをドラッグ（スマホは長押し）して並べ替えられます</p>
      <ul className="flex flex-col">
        {items.map((c, i) => (
          <li
            key={c.id}
            ref={(el) => {
              rowRefs.current[c.id] = el
            }}
            className={cx(
              'flex items-center gap-1 border-b border-line-soft last:border-0',
              dragId === c.id && 'relative z-10 rounded-field bg-highlight',
            )}
          >
            <button
              type="button"
              aria-label={`${c.label} を並べ替える（↑↓キー）`}
              onPointerDown={(e) => onPointerDown(e, c.id)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={(e) => onHandleKey(e, i)}
              onContextMenu={(e) => e.preventDefault()}
              className="-ml-2 inline-flex h-tap w-tap shrink-0 cursor-grab touch-none select-none items-center justify-center text-off active:cursor-grabbing"
            >
              <DragIcon size={20} />
            </button>
            <span className="flex-1 select-none text-body">{c.label}</span>
            <button
              type="button"
              aria-label={`${c.label} を削除`}
              disabled={items.length <= 1}
              onClick={() => setRemoving(c)}
              className="-mr-2 inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-field text-muted hover:bg-highlight disabled:opacity-30"
            >
              <DeleteIcon size={20} />
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="flex flex-col gap-2 rounded-field border border-dashed border-dash p-3">
          <div className="flex gap-2">
            <TextInput
              type="date"
              aria-label="追加する日付"
              value={date}
              className="min-w-0 flex-[3] px-2.5"
              onChange={(e) => setDate(e.target.value)}
            />
            <TextInput
              type="time"
              aria-label="追加する時刻"
              value={time}
              step={300}
              className="min-w-0 flex-[2] px-2.5"
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <SmallButton variant="primary" onClick={add} disabled={save.isPending}>
              追加する
            </SmallButton>
            <SmallButton onClick={() => setAdding(false)}>やめる</SmallButton>
          </div>
        </div>
      ) : (
        <div>
          <SmallButton variant="dashed" onClick={() => setAdding(true)}>
            ＋ 候補日を追加
          </SmallButton>
        </div>
      )}
      {error && <ErrorNotice message={error} />}

      <Dialog
        open={!!removing}
        title="候補日を削除しますか？"
        confirmLabel="削除する"
        caution
        busy={save.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          const next = items.filter((c) => c.id !== removing?.id)
          setRemoving(null)
          setItems(next)
          commit(next)
        }}
      >
        <p>
          {removing?.label} を消します。
          <strong className="font-bold">この日へのみんなの ◯△✕ も消えます。</strong>
        </p>
      </Dialog>
    </Card>
  )
}
