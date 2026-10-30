import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Page } from '../../components/Page'
import { api, ApiError, apiUrl } from '../../lib/api'
import { usePublicEvent } from '../../lib/participant'
import { storage } from '../../lib/storage'
import { isImeEnter } from '../../lib/text'
import { useTurnstileToken } from '../../lib/useTurnstileToken'
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

  const ts = useTurnstileToken('gate')
  const gate = useMutation({
    // 前後の空白だけ取って送る。全角・半角やカタカナ・ひらがなはサーバーがそろえる（spec.md 14.1）
    mutationFn: () =>
      api<GateResult>(`/events/${slug}/gate`, {
        method: 'POST',
        body: { passphrase: passphrase.trim() },
        auth: { turnstile: ts.token },
      }),
    onSettled: ts.reset,
    onSuccess: (res) => {
      storage.setGate(slug, res.gateToken)
      void qc.invalidateQueries({ queryKey: ['event', slug] })
      onPassed(res.gateToken)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'passphrase_invalid')
        setError('ちがうみたい。ひらがな・カタカナ、全角・半角はどちらでも大丈夫です')
      else if (e instanceof ApiError && e.code === 'too_many_attempts')
        setError('少し時間をおいてもう一度試してください')
      else setError(e.message)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!passphrase.trim()) {
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
        {info.data?.passphraseQuestion && <ChalkQuestion text={info.data.passphraseQuestion} />}
        <Field label={info.data?.passphraseQuestion ? '答え' : '合言葉を入れてね'} error={error}>
          {(id, d) => (
            // type="password" だと iOS Safari などで日本語入力が使えないので text にする（合言葉はクラスで共有するもの）
            <TextInput
              id={id}
              aria-describedby={d}
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder={info.data?.passphraseQuestion ? '' : '例）担任の先生のあだ名'}
              value={passphrase}
              invalid={!!error}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => {
                // 変換を確定する Enter では送らない
                if (e.key === 'Enter' && isImeEnter(e)) e.preventDefault()
              }}
            />
          )}
        </Field>
        {ts.element}
        <Button type="submit" disabled={gate.isPending || !ts.ready}>
          {gate.isPending ? 'たしかめています…' : ts.ready ? 'ひらく' : '確認中…'}
        </Button>
        <p className="text-center text-note text-muted">一度入ればこの端末では次回から省略されます</p>
      </form>
    </Page>
  )
}

/** 合言葉の質問。黒板にチョークで書いた問題文のように見せる */
function ChalkQuestion({ text }: { text: string }) {
  return (
    <div className="rounded-field border-4 border-kraft bg-board px-4 py-3.5">
      <p className="break-words font-hand text-lead text-chalk">
        <span className="mr-2 text-h2 leading-none text-chalk-yellow" aria-hidden="true">
          Q.
        </span>
        <span className="sr-only">質問：</span>
        {text}
      </p>
    </div>
  )
}
