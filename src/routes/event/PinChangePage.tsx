import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router'
import { Page, PageTitle } from '../../components/Page'
import { api, ApiError } from '../../lib/api'
import { participantKeys, useEventDetail, useGateGuard, useMyResponse } from '../../lib/participant'
import { storage } from '../../lib/storage'
import { useTitle } from '../../lib/title'
import {
  Button,
  ButtonLink,
  ErrorNotice,
  Field,
  Notice,
  PageSkeleton,
  PinInput,
  TextButton,
  TopBar,
} from '../../ui'

/**
 * 自分の PIN の設定・変更（修正03）。この端末の編集トークンで本人と分かるので、今の PIN は聞かない。
 * PIN が未設定なら「設定」、設定済みなら「変更」と呼ぶ（API は同じ）。
 */
export default function PinChangePage() {
  const { slug = '' } = useParams()
  if (!storage.getGate(slug) || !storage.getEdit(slug)) return <Navigate to={`/e/${slug}`} replace />
  return <PinChange slug={slug} />
}

type Step = 'enter' | 'confirm' | 'done'

function PinChange({ slug }: { slug: string }) {
  const qc = useQueryClient()
  const guard = useGateGuard(slug)
  const detail = useEventDetail(slug)
  const mine = useMyResponse(slug)
  // 「設定」か「変更」かは今の状態で決め、保存するときに固定する（保存すると hasPin が変わるため、完了画面で切り替えない）
  const [fixedVerb, setFixedVerb] = useState<'設定' | '変更' | null>(null)
  const verb = fixedVerb ?? (mine.data ? (mine.data.hasPin ? '変更' : '設定') : null)
  useTitle(verb ? `PINを${verb}` : undefined)
  const [step, setStep] = useState<Step>('enter')
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'confirm') confirmRef.current?.focus()
  }, [step])

  const save = useMutation({
    mutationFn: () =>
      api<void>(`/events/${slug}/responses/me/pin`, {
        method: 'PUT',
        body: { pin },
        auth: { gate: slug, edit: slug },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: participantKeys.detail(slug) })
      const edit = storage.getEdit(slug)
      if (edit) void qc.invalidateQueries({ queryKey: participantKeys.myResponse(slug, edit.responseId) })
      setStep('done')
    },
    onError: (e) => {
      if (guard(e)) return
      if (e instanceof ApiError && e.code === 'pin_invalid') {
        setStep('enter')
        setAgain('')
        return setError(e.message)
      }
      // 通信エラーなどはフォームの下に出す（参加者の画面ではトーストを使わない。design.md 5章）
      setFormError(e.message)
    },
  })

  const next = (e: FormEvent) => {
    e.preventDefault()
    if (step === 'enter') {
      if (!/^\d{4}$/.test(pin)) return setError('PINは数字4桁で入れてください')
      setError(null)
      setStep('confirm')
      return
    }
    if (again !== pin) {
      setAgain('')
      return setError('1回目と同じ4桁を入れてください')
    }
    setError(null)
    setFormError(null)
    setFixedVerb(verb)
    save.mutate()
  }

  if (verb === null) {
    return (
      <Page>
        {mine.error ? (
          <div className="py-10">
            <ErrorNotice message={mine.error.message} onRetry={() => void mine.refetch()} />
          </div>
        ) : (
          <PageSkeleton />
        )}
      </Page>
    )
  }

  return (
    <Page className="pb-10">
      <TopBar title={detail.data?.title ?? ''} backTo={`/e/${slug}/answer`} />
      <div className="flex flex-col gap-section">
        <PageTitle>PINを{verb}</PageTitle>
        {step === 'done' ? (
          <>
            <Notice>
              {verb === '設定'
                ? 'PINを設定しました。別のスマホからは、なまえとこのPINで直せます'
                : 'PINを変えました。別のスマホからは、なまえと新しいPINで直せます'}
            </Notice>
            <ButtonLink to={`/e/${slug}`}>みんなの回答を見る</ButtonLink>
          </>
        ) : (
          <form onSubmit={next} noValidate className="flex flex-col gap-section">
            <p className="-mt-3 text-body text-muted">
              別のスマホから回答を直すときに使う4桁です。
              {verb === '変更' && '今のPINは入れなくてかまいません。'}
            </p>
            {step === 'enter' ? (
              <Field label={verb === '設定' ? 'PIN（数字4桁）' : '新しいPIN（数字4桁）'} error={error}>
                {(id, desc) => (
                  <PinInput
                    id={id}
                    aria-describedby={desc}
                    value={pin}
                    invalid={!!error}
                    onChange={(v) => {
                      setPin(v)
                      setError(null)
                    }}
                  />
                )}
              </Field>
            ) : (
              <Field label="確認のため、もう一度" hint="1回目と同じ4桁を入れてください" error={error}>
                {(id, desc) => (
                  <PinInput
                    id={id}
                    ref={confirmRef}
                    aria-describedby={desc}
                    value={again}
                    invalid={!!error}
                    onChange={(v) => {
                      setAgain(v)
                      setError(null)
                    }}
                  />
                )}
              </Field>
            )}
            {formError && <ErrorNotice message={formError} />}
            <Button type="submit" disabled={save.isPending}>
              {step === 'enter' ? '次へ' : save.isPending ? '保存しています…' : 'このPINにする'}
            </Button>
            {step === 'confirm' && (
              <TextButton
                className="self-center"
                onClick={() => {
                  setStep('enter')
                  setAgain('')
                  setError(null)
                }}
              >
                1回目からやり直す
              </TextButton>
            )}
          </form>
        )}
      </div>
    </Page>
  )
}
