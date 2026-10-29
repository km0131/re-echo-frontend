import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { CopyButton } from '../../components/CopyButton'
import { Page, PageTitle } from '../../components/Page'
import { adminKeys, useSessionGuard } from '../../lib/admin'
import { api } from '../../lib/api'
import { fromTokyoInputs } from '../../lib/date'
import { storage } from '../../lib/storage'
import { SURVEY_TEMPLATES } from '../../lib/surveyTemplates'
import type { CreateEventInput, CreateEventResult } from '../../lib/types'
import {
  Button,
  ButtonLink,
  Card,
  CardTitle,
  DeleteIcon,
  ErrorNotice,
  Field,
  Notice,
  Pill,
  PillGroup,
  SmallButton,
  TextArea,
  TextInput,
  TopBar,
} from '../../ui'

type Draft = { key: number; date: string; time: string }

/** イベント作成（design.md 4章） */
export default function NewEventPage() {
  const [created, setCreated] = useState<CreateEventResult | null>(null)
  if (!storage.getSession()) return <Navigate to="/login" replace />
  return created ? <Created result={created} /> : <NewEventForm onCreated={setCreated} />
}

function NewEventForm({ onCreated }: { onCreated: (r: CreateEventResult) => void }) {
  const qc = useQueryClient()
  const guard = useSessionGuard()
  const nextKey = useRef(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [gateCaption, setGateCaption] = useState('あの頃の放課後')
  const [classSize, setClassSize] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([{ key: 0, date: '', time: '19:00' }])
  const [passphrase, setPassphrase] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<string[]>([])

  useEffect(() => {
    document.title = '出欠帳｜イベントをつくる'
  }, [])

  const create = useMutation({
    mutationFn: async (input: CreateEventInput) => {
      const res = await api<CreateEventResult>('/events', {
        method: 'POST',
        body: input,
        auth: { session: true },
      })
      // この端末では共同幹事用URLをあとからコピーできるよう、管理キーを保存しておく
      storage.setAdmin(res.slug, res.adminKey)
      const questions = SURVEY_TEMPLATES.filter((t) => templates.includes(t.key)).map((t) => t.question)
      if (questions.length > 0) {
        await api(`/events/${res.slug}/survey`, {
          method: 'PUT',
          body: { questions },
          auth: { session: true, admin: res.slug },
        })
      }
      return res
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: adminKeys.events })
      onCreated(res)
      window.scrollTo({ top: 0 })
    },
    onError: (e) => {
      if (!guard(e)) setError(e.message)
    },
  })

  const update = (key: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim()) return setError('イベント名を入れてください')
    const candidates: { startsAt: string }[] = []
    for (const d of drafts) {
      const iso = fromTokyoInputs(d.date, d.time)
      if (!iso) return setError('候補日の日付と時刻を入れてください')
      candidates.push({ startsAt: iso })
    }
    if (candidates.length === 0) return setError('候補日を1つ以上入れてください')
    if (!passphrase.trim()) return setError('合言葉を入れてください')
    if (!endsOn) return setError('終了日を入れてください')
    const size = classSize.trim() === '' ? null : Number(classSize)
    if (size !== null && (!Number.isInteger(size) || size < 1))
      return setError('クラスの人数は数字で入れてください')
    create.mutate({
      title: title.trim(),
      description: description.trim(),
      gateCaption: gateCaption.trim(),
      classSize: size,
      passphrase: passphrase.trim(),
      endsOn,
      candidates,
    })
  }

  return (
    <Page className="pb-10">
      <TopBar backTo="/dashboard" />
      <form onSubmit={submit} noValidate className="flex flex-col gap-section">
        <PageTitle>イベントをつくる</PageTitle>

        <Card>
          <CardTitle>基本</CardTitle>
          <Field label="イベント名">
            {(id) => (
              <TextInput
                id={id}
                value={title}
                maxLength={100}
                placeholder="例）3年2組 年末同窓会"
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <Field label="説明文（任意）">
            {(id) => (
              <TextArea
                id={id}
                rows={4}
                value={description}
                maxLength={2000}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          <Field label="ゲート写真のキャプション" hint="合言葉の画面のポラロイドに書く一言">
            {(id, d) => (
              <TextInput
                id={id}
                aria-describedby={d}
                value={gateCaption}
                maxLength={40}
                onChange={(e) => setGateCaption(e.target.value)}
              />
            )}
          </Field>
          <Field label="クラスの人数（任意）" hint="入れるとダッシュボードに回答率が出ます">
            {(id, d) => (
              <TextInput
                id={id}
                aria-describedby={d}
                inputMode="numeric"
                value={classSize}
                className="w-32"
                onChange={(e) => setClassSize(e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
        </Card>

        <Card>
          <CardTitle>候補日</CardTitle>
          <ul className="flex flex-col gap-2">
            {drafts.map((d, i) => (
              <li key={d.key} className="flex items-center gap-2">
                <TextInput
                  type="date"
                  aria-label={`候補日${i + 1}の日付`}
                  value={d.date}
                  className="min-w-0 flex-[3] px-2.5"
                  onChange={(e) => update(d.key, { date: e.target.value })}
                />
                <TextInput
                  type="time"
                  aria-label={`候補日${i + 1}の時刻`}
                  value={d.time}
                  step={300}
                  className="min-w-0 flex-[2] px-2.5"
                  onChange={(e) => update(d.key, { time: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={`候補日${i + 1}を削除`}
                  disabled={drafts.length === 1}
                  onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}
                  className="inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-field text-muted hover:bg-highlight disabled:opacity-30"
                >
                  <DeleteIcon size={20} />
                </button>
              </li>
            ))}
          </ul>
          <div>
            <SmallButton
              variant="dashed"
              onClick={() => {
                const last = drafts[drafts.length - 1]
                setDrafts((ds) => [...ds, { key: nextKey.current++, date: '', time: last?.time ?? '19:00' }])
              }}
            >
              ＋ 候補日を追加
            </SmallButton>
          </div>
        </Card>

        <Card>
          <CardTitle>合言葉</CardTitle>
          <Field label="合言葉" hint="クラスのみんなだけが分かる言葉に。LINE では URL と別に伝えます">
            {(id, d) => (
              <TextInput
                id={id}
                aria-describedby={d}
                value={passphrase}
                maxLength={64}
                autoComplete="off"
                onChange={(e) => setPassphrase(e.target.value)}
              />
            )}
          </Field>
          <Field label="終了日" hint="この日を過ぎると「終了」になります。合言葉はこの30日後まで有効です">
            {(id, d) => (
              <TextInput
                id={id}
                aria-describedby={d}
                type="date"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
              />
            )}
          </Field>
        </Card>

        <Card>
          <CardTitle>アンケート（任意）</CardTitle>
          <p className="text-note text-muted">
            回答フォームに追加の質問を出せます。あとから管理画面で変えられます。
          </p>
          <PillGroup label="テンプレート">
            {SURVEY_TEMPLATES.map((t) => (
              <Pill
                key={t.key}
                selected={templates.includes(t.key)}
                onClick={() =>
                  setTemplates((s) => (s.includes(t.key) ? s.filter((x) => x !== t.key) : [...s, t.key]))
                }
              >
                ＋ {t.label}
              </Pill>
            ))}
          </PillGroup>
        </Card>

        {error && <ErrorNotice message={error} />}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'つくっています…' : 'つくる'}
        </Button>
      </form>
    </Page>
  )
}

function Created({ result }: { result: CreateEventResult }) {
  return (
    <Page className="flex flex-col gap-section pb-10">
      <TopBar backTo="/dashboard" />
      <PageTitle>できました</PageTitle>
      <Notice>管理URLは今しか表示されません。共同幹事に渡す場合は、いまコピーしておいてください</Notice>

      <Card emphasis>
        <h2 className="text-label font-medium">共有URL（みんなに送る）</h2>
        <p className="break-all rounded-field border border-line bg-paper px-3 py-2.5 text-body">
          {result.shareUrl}
        </p>
        <div>
          <CopyButton text={result.shareUrl} variant="primary" label="URLをコピー" />
        </div>
      </Card>

      <Card>
        <h2 className="text-label font-medium">共同幹事用URL</h2>
        <p className="break-all rounded-field border border-line bg-paper px-3 py-2.5 text-body">
          {result.adminUrl}
        </p>
        <div>
          <CopyButton text={result.adminUrl} />
        </div>
      </Card>

      <ButtonLink to={`/e/${result.slug}/admin`}>管理画面へ</ButtonLink>
      <Link
        to="/dashboard"
        className="mx-auto inline-flex min-h-tap items-center text-label text-muted underline underline-offset-4"
      >
        ダッシュボードへ戻る
      </Link>
    </Page>
  )
}
