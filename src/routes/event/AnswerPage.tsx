import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Page, PageTitle } from '../../components/Page'
import { api, ApiError } from '../../lib/api'
import { participantKeys, useEventDetail, useGateGuard, useMyResponse } from '../../lib/participant'
import { storage } from '../../lib/storage'
import { useTurnstileToken } from '../../lib/useTurnstileToken'
import { useTitle } from '../../lib/title'
import type { CreateResponseResult, ResponseInput, ResponseItem, SurveyAnswer } from '../../lib/types'
import { CandidateChoices } from '../../components/ResponseFields'
import { choicesToSend, missingCandidates, surveyToSend, surveyToState } from '../../lib/responseForm'
import { SurveyQuestionField } from '../../components/SurveyQuestionField'
import {
  Button,
  ErrorNotice,
  Field,
  Notice,
  PageSkeleton,
  PinInput,
  TextArea,
  TextInput,
  TopBar,
  type Choice,
} from '../../ui'

/** 回答フォーム（design.md 3.3） */
export default function AnswerPage() {
  const { slug = '' } = useParams()
  if (!storage.getGate(slug)) return <Navigate to={`/e/${slug}`} replace />
  return <AnswerForm slug={slug} />
}

function AnswerForm({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const guard = useGateGuard(slug)
  const detail = useEventDetail(slug)
  const mine = useMyResponse(slug)
  useTitle(detail.data ? `出欠を書く（${detail.data.title}）` : undefined)
  const editing = !!mine.data

  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [nameTaken, setNameTaken] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({})
  const restored = useRef(false)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // 前回の回答を復元する（1回だけ）
  useEffect(() => {
    if (restored.current || !mine.data) return
    restored.current = true
    setName(mine.data.name)
    setComment(mine.data.comment)
    setChoices(mine.data.choices)
    setAnswers(surveyToState(mine.data.survey))
  }, [mine.data])

  useEffect(() => {
    if (detail.error) guard(detail.error)
  }, [detail.error, guard])

  // 回答の新規作成だけ Turnstile を通す（更新は編集トークンがあるので要らない）
  const ts = useTurnstileToken('answer', !editing)
  const save = useMutation({
    mutationFn: async (input: ResponseInput) => {
      const edit = storage.getEdit(slug)
      if (editing && edit) {
        await api<ResponseItem>(`/events/${slug}/responses/${edit.responseId}`, {
          method: 'PUT',
          body: input,
          auth: { gate: slug, edit: slug },
        })
        return edit.responseId
      }
      const res = await api<CreateResponseResult>(`/events/${slug}/responses`, {
        method: 'POST',
        body: input,
        auth: { gate: slug, turnstile: ts.token },
      })
      storage.setEdit(slug, { responseId: res.id, token: res.editToken })
      return res.id
    },
    onSuccess: (id, input) => {
      void qc.invalidateQueries({ queryKey: participantKeys.detail(slug) })
      void qc.invalidateQueries({ queryKey: participantKeys.myResponse(slug, id) })
      navigate(`/e/${slug}/answer/done`, { state: { name: input.name } })
    },
    onSettled: ts.reset,
    onError: (e) => {
      if (guard(e)) return
      if (e instanceof ApiError && e.code === 'name_taken') {
        setNameError(e.message)
        setNameTaken(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (e instanceof ApiError && e.code === 'pin_invalid') {
        setPinError(e.message)
        return
      }
      if (
        e instanceof ApiError &&
        ['candidate_not_found', 'question_not_found', 'option_not_found'].includes(e.code)
      )
        void detail.refetch()
      setFormError(e.message)
    },
  })

  if (detail.isPending || (mine.isPending && mine.fetchStatus !== 'idle')) {
    return (
      <Page>
        <PageSkeleton />
      </Page>
    )
  }
  if (!detail.data) {
    return (
      <Page className="py-10">
        <ErrorNotice message={detail.error?.message} onRetry={() => void detail.refetch()} />
      </Page>
    )
  }
  const d = detail.data

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setNameError(null)
    const miss = missingCandidates(d.candidates, choices)
    setMissing(new Set(miss))
    if (!name.trim()) {
      setNameError('なまえを入れてください')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (pin !== '' && !/^\d{4}$/.test(pin)) {
      setPinError('PINは数字4桁にしてください')
      return
    }
    setPinError(null)
    if (miss.length > 0) {
      const el = rowRefs.current[miss[0]]
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.querySelector<HTMLButtonElement>('[role="radio"]')?.focus({ preventScroll: true })
      setFormError('まだ ◯△✕ がついていない日があります')
      return
    }
    save.mutate({
      name: name.trim(),
      comment: comment.trim(),
      choices: choicesToSend(d.candidates, choices),
      survey: surveyToSend(d.survey, answers),
      ...(pin ? { pin } : {}),
    })
  }

  return (
    <Page className="pb-10">
      <TopBar title={d.title} backTo={`/e/${slug}`} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-section">
        <PageTitle>出欠を書く</PageTitle>
        {editing && <Notice>前回の回答を読み込みました。直して保存できます</Notice>}

        <Field
          label="なまえ（みんなに見えます）"
          error={
            nameError && (
              <>
                {nameError}
                {nameTaken && (
                  <Link to={`/e/${slug}/edit`} className="ml-1 font-medium underline underline-offset-4">
                    別のスマホで回答した場合はこちら
                  </Link>
                )}
              </>
            )
          }
        >
          {(id, desc) => (
            <TextInput
              id={id}
              aria-describedby={desc}
              value={name}
              maxLength={20}
              autoComplete="nickname"
              placeholder="例）あおい"
              invalid={!!nameError}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(null)
                setNameTaken(false)
              }}
            />
          )}
        </Field>

        <CandidateChoices
          candidates={d.candidates}
          choices={choices}
          missing={missing}
          rowRefs={rowRefs}
          onChange={(id, v) => setChoices((s) => ({ ...s, [id]: v }))}
        />

        {d.survey.map((q) => (
          <SurveyQuestionField
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={(a) => setAnswers((s) => ({ ...s, [q.id]: a }))}
          />
        ))}

        <Field label="ひとこと（任意）">
          {(id) => (
            <TextArea
              id={id}
              hand
              value={comment}
              maxLength={200}
              placeholder="例）久しぶり！楽しみにしてます"
              onChange={(e) => setComment(e.target.value)}
            />
          )}
        </Field>

        <Field
          label="4桁のPIN（任意）"
          hint={
            editing ? (
              <>
                {mine.data?.hasPin ? '変更する場合のみ入力。' : ''}別のスマホから直すときに使います
                <Link
                  to={`/e/${slug}/pin`}
                  className="ml-1 font-medium text-navy underline underline-offset-4"
                >
                  PINを変更
                </Link>
              </>
            ) : (
              '別のスマホから直すときに使います'
            )
          }
          error={pinError}
        >
          {(id, desc) => (
            <PinInput
              id={id}
              aria-describedby={desc}
              value={pin}
              invalid={!!pinError}
              onChange={(v) => {
                setPin(v)
                setPinError(null)
              }}
            />
          )}
        </Field>

        {formError && <ErrorNotice message={formError} />}
        {ts.element}
        <Button type="submit" disabled={save.isPending || !ts.ready}>
          {save.isPending ? '保存しています…' : ts.ready ? 'この内容で保存' : '確認中…'}
        </Button>
      </form>
    </Page>
  )
}
