import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router'
import { Page, PageTitle } from '../../components/Page'
import { api, ApiError } from '../../lib/api'
import { participantKeys, useEventDetail, useGateGuard } from '../../lib/participant'
import { storage } from '../../lib/storage'
import { useTitle } from '../../lib/title'
import { isNetworkError, useToast } from '../../lib/toast'
import { Button, ButtonLink, Field, Notice, PinInput, TextButton, TopBar } from '../../ui'

/** 自分の PIN の変更（修正03）。この端末の編集トークンで本人と分かるので、今の PIN は聞かない。 */
export default function PinChangePage() {
  const { slug = '' } = useParams()
  if (!storage.getGate(slug) || !storage.getEdit(slug)) return <Navigate to={`/e/${slug}`} replace />
  return <PinChange slug={slug} />
}

type Step = 'enter' | 'confirm' | 'done'

function PinChange({ slug }: { slug: string }) {
  const qc = useQueryClient()
  const guard = useGateGuard(slug)
  const toast = useToast()
  const detail = useEventDetail(slug)
  useTitle('PINを変更')
  const [step, setStep] = useState<Step>('enter')
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
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
      if (isNetworkError(e)) return toast.show(e.message)
      if (e instanceof ApiError && e.code === 'pin_invalid') {
        setStep('enter')
        setAgain('')
        return setError(e.message)
      }
      setError(e.message)
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
    save.mutate()
  }

  return (
    <Page className="pb-10">
      <TopBar title={detail.data?.title ?? ''} backTo={`/e/${slug}/answer`} />
      <div className="flex flex-col gap-section">
        <PageTitle>PINを変更</PageTitle>
        {step === 'done' ? (
          <>
            <Notice>PINを変えました。別のスマホからは、なまえと新しいPINで直せます</Notice>
            <ButtonLink to={`/e/${slug}`}>みんなの回答を見る</ButtonLink>
          </>
        ) : (
          <form onSubmit={next} noValidate className="flex flex-col gap-section">
            <p className="-mt-3 text-body text-muted">
              別のスマホから回答を直すときに使う4桁です。今のPINは入れなくてかまいません。
            </p>
            {step === 'enter' ? (
              <Field label="新しいPIN（数字4桁）" error={error}>
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
