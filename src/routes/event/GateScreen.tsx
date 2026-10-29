import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Page } from '../../components/Page'
import { api, ApiError, apiUrl } from '../../lib/api'
import { usePublicEvent } from '../../lib/participant'
import { storage } from '../../lib/storage'
import type { GateResult } from '../../lib/types'
import { useTitle } from '../../lib/title'
import { Button, EmptyState, ErrorNotice, Field, PhotoBox, Polaroid, Skeleton, TextInput } from '../../ui'

/** 合言葉ゲート（design.md 3.1） */
export function GateScreen({ slug, onPassed }: { slug: string; onPassed: (token: string) => void }) {
  const info = usePublicEvent(slug)
  useTitle(info.data?.title)
  const qc = useQueryClient()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)

  const gate = useMutation({
    mutationFn: () => api<GateResult>(`/events/${slug}/gate`, { method: 'POST', body: { passphrase } }),
    onSuccess: (res) => {
      storage.setGate(slug, res.gateToken)
      void qc.invalidateQueries({ queryKey: ['event', slug] })
      onPassed(res.gateToken)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'passphrase_invalid') setError('合言葉がちがいます')
      else if (e instanceof ApiError && e.code === 'too_many_attempts')
        setError('少し時間をおいてもう一度試してください')
      else setError(e.message)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!passphrase) {
      setError('合言葉を入れてください')
      return
    }
    setError(null)
    gate.mutate()
  }

  if (info.error instanceof ApiError && info.error.status === 404) {
    return (
      <Page wide className="py-24">
        <EmptyState title="イベントが見つかりません" note="URLをもう一度確かめてください" />
      </Page>
    )
  }

  return (
    <Page wide className="flex flex-col items-center gap-7 pb-12 pt-14 text-center">
      {info.error && <ErrorNotice onRetry={() => void info.refetch()} />}
      <Polaroid tilt="-rotate-3" tape caption={info.data?.gateCaption} className="w-[268px]" bottom="pb-11">
        <PhotoBox
          src={info.data?.publicPhotoUrl ? apiUrl(info.data.publicPhotoUrl) : null}
          alt={info.data?.gateCaption ?? ''}
          index={0}
          loading="eager"
          className="h-[244px] w-[244px]"
        />
      </Polaroid>

      <div className="flex w-full flex-col items-center gap-2">
        {info.data ? (
          <>
            <p className="text-note tracking-catch text-sepia">CLASS REUNION {info.data.year}</p>
            <h1 className="font-hand text-gate text-navy">{info.data.title}</h1>
          </>
        ) : (
          <Skeleton className="h-16 w-4/5" />
        )}
        <p className="text-body text-muted">クラスのみんなだけが入れるページです</p>
      </div>

      <form onSubmit={submit} className="flex w-full flex-col gap-3 text-left" noValidate>
        <Field label="合言葉" error={error}>
          {(id, d) => (
            <TextInput
              id={id}
              aria-describedby={d}
              type="password"
              autoComplete="off"
              enterKeyHint="go"
              placeholder="例）担任の先生のあだ名"
              value={passphrase}
              invalid={!!error}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" disabled={gate.isPending}>
          {gate.isPending ? 'たしかめています…' : 'ひらく'}
        </Button>
        <p className="text-center text-note text-muted">一度入ればこの端末では次回から省略されます</p>
      </form>
    </Page>
  )
}
