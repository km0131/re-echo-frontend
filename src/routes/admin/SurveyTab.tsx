import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { adminKeys, useSessionGuard } from '../../lib/admin'
import { api } from '../../lib/api'
import { SURVEY_TEMPLATES } from '../../lib/surveyTemplates'
import type { AdminEvent, SurveyQuestionInput, SurveyType } from '../../lib/types'
import {
  Button,
  Card,
  CardTitle,
  DeleteIcon,
  EmptyState,
  ErrorNotice,
  Notice,
  Pill,
  PillGroup,
  SmallButton,
  TextInput,
} from '../../ui'

type Draft = SurveyQuestionInput & { key: string }

const TYPE_LABEL: Record<SurveyType, string> = { single: '1つ選ぶ', multi: 'いくつでも', text: '自由に書く' }

function toDrafts(d: AdminEvent): Draft[] {
  return d.survey.map((q) => ({
    key: q.id,
    id: q.id,
    text: q.text,
    type: q.type,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  }))
}

/** アンケートタブ：設問の編集と集計。 */
export function SurveyTab({ event: d }: { event: AdminEvent }) {
  return (
    <>
      <SurveyEditor event={d} />
      <SurveyResults event={d} />
    </>
  )
}

function SurveyEditor({ event: d }: { event: AdminEvent }) {
  const qc = useQueryClient()
  const guard = useSessionGuard()
  const seq = useRef(0)
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(d))
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const newKey = () => `new-${seq.current++}`

  const change = (fn: (ds: Draft[]) => Draft[]) => {
    setDrafts(fn)
    setDirty(true)
    setSaved(false)
  }
  const patch = (key: string, p: Partial<Draft>) =>
    change((ds) => ds.map((q) => (q.key === key ? { ...q, ...p } : q)))
  const move = (i: number, dir: -1 | 1) =>
    change((ds) => {
      const j = i + dir
      if (j < 0 || j >= ds.length) return ds
      const next = [...ds]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const save = useMutation({
    mutationFn: () =>
      api<AdminEvent>(`/events/${d.slug}/survey`, {
        method: 'PUT',
        body: { questions: drafts.map(({ key: _key, ...q }) => q) },
        auth: { session: true, admin: d.slug },
      }),
    onSuccess: (res) => {
      qc.setQueryData(adminKeys.event(d.slug), res)
      void qc.invalidateQueries({ queryKey: ['event', d.slug] })
      setDrafts(toDrafts(res))
      setDirty(false)
      setSaved(true)
      setError(null)
    },
    onError: (e) => {
      if (!guard(e)) setError(e.message)
    },
  })

  return (
    <Card>
      <CardTitle>設問</CardTitle>
      <p className="text-note text-muted">回答フォームに出る追加の質問です。答えるかどうかは任意です。</p>
      <div className="flex flex-wrap gap-2">
        {SURVEY_TEMPLATES.map((t) => (
          <SmallButton
            key={t.key}
            variant="dashed"
            onClick={() =>
              change((ds) => [...ds, { ...t.question, options: [...t.question.options], key: newKey() }])
            }
          >
            ＋ {t.label}
          </SmallButton>
        ))}
        <SmallButton
          variant="dashed"
          onClick={() =>
            change((ds) => [
              ...ds,
              { key: newKey(), text: '', type: 'single', options: [{ text: '' }, { text: '' }] },
            ])
          }
        >
          ＋ 設問をつくる
        </SmallButton>
      </div>

      {drafts.length === 0 && <EmptyState title="設問はまだありません" note="上のボタンから足せます" />}

      <ol className="flex flex-col gap-3">
        {drafts.map((q, i) => (
          <li key={q.key} className="flex flex-col gap-2.5 rounded-btn border border-line bg-paper p-3">
            <div className="flex items-center gap-1">
              <span className="text-label font-medium text-muted">Q{i + 1}</span>
              <div className="ml-auto flex">
                <SmallButton
                  aria-label="上へ"
                  className="h-tap px-3"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                >
                  ↑
                </SmallButton>
                <SmallButton
                  aria-label="下へ"
                  className="ml-1 h-tap px-3"
                  onClick={() => move(i, 1)}
                  disabled={i === drafts.length - 1}
                >
                  ↓
                </SmallButton>
                <button
                  type="button"
                  aria-label={`Q${i + 1} を削除`}
                  onClick={() => change((ds) => ds.filter((x) => x.key !== q.key))}
                  className="ml-1 inline-flex h-tap w-tap items-center justify-center rounded-field text-muted hover:bg-highlight"
                >
                  <DeleteIcon size={20} />
                </button>
              </div>
            </div>
            <TextInput
              aria-label={`Q${i + 1} の質問`}
              placeholder="例）予算はどれくらい？"
              value={q.text}
              maxLength={60}
              onChange={(e) => patch(q.key, { text: e.target.value })}
            />
            <PillGroup label="答え方">
              {(['single', 'multi', 'text'] as SurveyType[]).map((t) => (
                <Pill
                  key={t}
                  selected={q.type === t}
                  onClick={() =>
                    patch(q.key, {
                      type: t,
                      options:
                        t === 'text' ? [] : q.options.length >= 2 ? q.options : [{ text: '' }, { text: '' }],
                    })
                  }
                >
                  {TYPE_LABEL[t]}
                </Pill>
              ))}
            </PillGroup>
            {q.type !== 'text' && (
              <ul className="flex flex-col gap-2">
                {q.options.map((o, j) => (
                  <li key={o.id ?? `o-${j}`} className="flex items-center gap-1">
                    <TextInput
                      aria-label={`Q${i + 1} の選択肢${j + 1}`}
                      placeholder={`選択肢${j + 1}`}
                      value={o.text}
                      maxLength={60}
                      onChange={(e) =>
                        patch(q.key, {
                          options: q.options.map((x, k) => (k === j ? { ...x, text: e.target.value } : x)),
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label={`選択肢${j + 1}を削除`}
                      disabled={q.options.length <= 2}
                      onClick={() => patch(q.key, { options: q.options.filter((_, k) => k !== j) })}
                      className="inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-field text-muted hover:bg-highlight disabled:opacity-30"
                    >
                      <DeleteIcon size={18} />
                    </button>
                  </li>
                ))}
                <li>
                  <SmallButton
                    variant="dashed"
                    disabled={q.options.length >= 10}
                    onClick={() => patch(q.key, { options: [...q.options, { text: '' }] })}
                  >
                    ＋ 選択肢を追加
                  </SmallButton>
                </li>
              </ul>
            )}
          </li>
        ))}
      </ol>

      {d.survey.length > 0 && dirty && (
        <p className="text-note text-maybe-ink">消した設問・選択肢への回答は、保存すると消えます。</p>
      )}
      {error && <ErrorNotice message={error} />}
      {saved && <Notice>保存しました</Notice>}
      <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
        {save.isPending ? '保存しています…' : 'アンケートを保存'}
      </Button>
    </Card>
  )
}

function SurveyResults({ event: d }: { event: AdminEvent }) {
  if (d.survey.length === 0) return null
  return (
    <Card>
      <CardTitle aside={<span className="text-note text-muted">回答 {d.responseCount}人</span>}>
        集計
      </CardTitle>
      {d.survey.map((q) => {
        const max = Math.max(1, d.responseCount)
        return (
          <section
            key={q.id}
            className="flex flex-col gap-2 border-b border-line-soft pb-3 last:border-0 last:pb-0"
          >
            <h3 className="text-label font-medium">
              {q.text}
              <span className="ml-1.5 text-note font-normal text-muted">{q.answeredCount}人が回答</span>
            </h3>
            {q.type === 'text' ? (
              q.answers.length === 0 ? (
                <p className="text-note text-muted">まだありません</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {q.answers.map((a, i) => (
                    <li key={i} className="text-body">
                      <span className="break-words">{a.text}</span>
                      <span className="ml-1.5 text-tiny text-muted">― {a.name}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <ul className="flex flex-col gap-1.5">
                {q.options.map((o) => (
                  <li key={o.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                    <span className="text-body">{o.text}</span>
                    <span className="text-label tabular-nums">{o.count}人</span>
                    <div
                      className="col-span-2 h-1.5 overflow-hidden rounded-full bg-highlight"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full bg-yes"
                        style={{ width: `${(o.count / max) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </Card>
  )
}
