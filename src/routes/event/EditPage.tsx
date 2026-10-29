import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Page, PageTitle } from '../../components/Page'
import { api, ApiError } from '../../lib/api'
import { participantKeys, useEventDetail, useGateGuard } from '../../lib/participant'
import { storage } from '../../lib/storage'
import { useTitle } from '../../lib/title'
import type { CreateResponseResult } from '../../lib/types'
import { Button, EmptyState, ErrorNotice, Field, PageSkeleton, PinInput, TopBar } from '../../ui'

/** 別の端末から編集（design.md 4章）。名前＋PINで編集トークンを取り直す。 */
export default function EditPage() {
  const { slug = '' } = useParams()
  if (!storage.getGate(slug)) return <Navigate to={`/e/${slug}`} replace />
  return <EditForm slug={slug} />
}

function EditForm({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const guard = useGateGuard(slug)
  const detail = useEventDetail(slug)
  useTitle(detail.data ? `回答を直す（${detail.data.title}）` : undefined)
  const [responseName, setResponseName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (detail.error) guard(detail.error)
  }, [detail.error, guard])

  const recover = useMutation({
    mutationFn: () =>
      api<CreateResponseResult>(`/events/${slug}/responses/recover`, {
        method: 'POST',
        body: { name: responseName, pin },
        auth: { gate: slug },
      }),
    onSuccess: (res) => {
      storage.setEdit(slug, { responseId: res.id, token: res.editToken })
      void qc.invalidateQueries({ queryKey: participantKeys.myResponse(slug, res.id) })
      navigate(`/e/${slug}/answer`, { replace: true })
    },
    onError: (e) => {
      if (guard(e)) return
      if (e instanceof ApiError && e.code === 'pin_locked')
        setError('15分ほどおいてからもう一度試してください')
      else setError(e.message)
      setPin('')
    },
  })

  if (detail.isPending) {
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
  const withPin = detail.data.responses.filter((r) => r.hasPin)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!responseName) return setError('なまえを選んでください')
    if (!/^\d{4}$/.test(pin)) return setError('PINは数字4桁で入れてください')
    setError(null)
    recover.mutate()
  }

  return (
    <Page className="pb-10">
      <TopBar title={detail.data.title} backTo={`/e/${slug}`} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-section">
        <PageTitle>回答を直す</PageTitle>
        <p className="-mt-3 text-body text-muted">
          前に回答したときの「なまえ」と「4桁のPIN」で、このスマホからも直せるようになります。
        </p>

        {withPin.length === 0 ? (
          <EmptyState
            title="PINを設定した人がいません"
            note="PINを設定していない場合は、幹事に連絡してください"
          />
        ) : (
          <>
            <Field label="なまえ">
              {(id) => (
                <select
                  id={id}
                  value={responseName}
                  onChange={(e) => setResponseName(e.target.value)}
                  className={`h-[52px] w-full rounded-field border-strong bg-card px-3 text-input text-ink focus:border-navy focus:outline-none ${responseName ? 'border-navy' : 'border-field'}`}
                >
                  <option value="">えらんでください</option>
                  {withPin.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="4桁のPIN">{(id) => <PinInput id={id} value={pin} onChange={setPin} />}</Field>
            {error && <ErrorNotice message={error} />}
            <Button type="submit" disabled={recover.isPending}>
              {recover.isPending ? 'たしかめています…' : 'ひらく'}
            </Button>
            <p className="text-note text-muted">
              PINを設定していない人は名前が出てきません。その場合は幹事に連絡してください。
            </p>
          </>
        )}
      </form>
    </Page>
  )
}
