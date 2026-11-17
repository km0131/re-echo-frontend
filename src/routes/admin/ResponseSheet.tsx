import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { CandidateChoices } from '../../components/ResponseFields'
import { choicesToSend, missingCandidates, surveyToSend, surveyToState } from '../../lib/responseForm'
import { SurveyQuestionField } from '../../components/SurveyQuestionField'
import { useSessionGuard } from '../../lib/admin'
import { adminResponsesApi, randomPin, useRefreshAfterResponseChange } from '../../lib/adminResponses'
import { ApiError } from '../../lib/api'
import { formatFullDateTime } from '../../lib/date'
import { isNetworkError, useToast } from '../../lib/toast'
import type { AdminEvent, AdminResponseItem, SurveyAnswer } from '../../lib/types'
import {
  Button,
  Dialog,
  ErrorNotice,
  Field,
  Notice,
  PinInput,
  Sheet,
  SmallButton,
  TextArea,
  TextInput,
  type Choice,
} from '../../ui'

type Target = AdminResponseItem | 'new' | null

/** 回答の編集・代理追加のシート（修正03）。中身は回答フォームと同じ部品を使う。 */
export function ResponseSheet({
  event: d,
  target,
  onClose,
}: {
  event: AdminEvent
  target: Target
  onClose: () => void
}) {
  // PIN を再設定した直後だけ、新しい PIN を表示する（閉じたら二度と出さない）
  const [revealed, setRevealed] = useState<{ pin: string; revoked: boolean } | null>(null)
  // フォームに保存していない変更があるか（フォームが知らせる）。あれば閉じる前に確認する
  const dirty = useRef(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const close = () => {
    dirty.current = false
    setConfirmClose(false)
    setRevealed(null)
    onClose()
  }
  // 閉じるボタン・背景のタップ・Esc・下へのスワイプ
  const requestClose = () => (dirty.current ? setConfirmClose(true) : close())
  const title =
    target === 'new' ? '代理で回答を追加' : revealed ? '新しいPIN' : target ? `${target.name}さんの回答` : ''
  return (
    <>
      <Sheet open={target !== null} title={title} onClose={requestClose}>
        {target !== null &&
          (revealed ? (
            <PinReveal
              pin={revealed.pin}
              revoked={revealed.revoked}
              name={target === 'new' ? '' : target.name}
              onClose={close}
            />
          ) : (
            <ResponseForm
              key={target === 'new' ? 'new' : target.id}
              event={d}
              target={target}
              dirtyRef={dirty}
              onDone={close}
              onPinReset={(pin, revoked) => {
                dirty.current = false
                setRevealed({ pin, revoked })
              }}
            />
          ))}
      </Sheet>
      {/* シートの外に置く（中に置くと、この確認の Esc やクリックがシートにも伝わるため） */}
      <Dialog
        open={confirmClose}
        title="保存していない変更があります。閉じますか？"
        confirmLabel="閉じる"
        cancelLabel="閉じない"
        caution
        onClose={() => setConfirmClose(false)}
        onConfirm={close}
      >
        <p>閉じると、入力した内容は消えます。</p>
      </Dialog>
    </>
  )
}

function ResponseForm({
  event: d,
  target,
  dirtyRef,
  onDone,
  onPinReset,
}: {
  event: AdminEvent
  target: AdminResponseItem | 'new'
  dirtyRef: RefObject<boolean>
  onDone: () => void
  onPinReset: (pin: string, revoked: boolean) => void
}) {
  const isNew = target === 'new'
  const initial = isNew ? null : target
  const guard = useSessionGuard()
  const toast = useToast()
  const refresh = useRefreshAfterResponseChange(d.slug)

  const [name, setName] = useState(initial?.name ?? '')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [choices, setChoices] = useState<Record<string, Choice>>(initial?.choices ?? {})
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>(() => surveyToState(initial?.survey))
  const [pin, setPin] = useState('') // 代理で追加するときだけ（任意）
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [nameError, setNameError] = useState<string | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const [pinDraft, setPinDraft] = useState(false) // PIN の再設定フォームに入力中か

  // 開いたときの値と比べて、変わっていれば「保存していない変更あり」
  const [initialSnapshot] = useState(() =>
    JSON.stringify([
      initial?.name ?? '',
      initial?.comment ?? '',
      initial?.choices ?? {},
      surveyToSend(d.survey, surveyToState(initial?.survey)),
      '',
    ]),
  )
  const isDirty =
    pinDraft ||
    JSON.stringify([name, comment, choices, surveyToSend(d.survey, answers), pin]) !== initialSnapshot
  useEffect(() => {
    dirtyRef.current = isDirty
  }, [dirtyRef, isDirty])
  // 変更があるときだけ、タブを閉じる・再読み込みでブラウザ標準の確認を出す。シートを閉じれば（このフォームが消えれば）外れる
  useEffect(() => {
    if (!isDirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // 古いブラウザ向け
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])
  // 名前のエラーはシートの上のほうにあるので、見えるところまで戻してフォーカスする
  const nameErrorAt = (message: string) => {
    setNameError(message)
    requestAnimationFrame(() => {
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      nameRef.current?.focus({ preventScroll: true })
    })
  }

  /** エラーの出し分け：名前・PIN は入力欄の下、通信エラーはトースト、それ以外はフォームの下 */
  const showError = (e: Error) => {
    if (guard(e)) return
    if (isNetworkError(e)) return toast.show(e.message)
    if (e instanceof ApiError && e.code === 'name_taken') return nameErrorAt(e.message)
    if (e instanceof ApiError && e.code === 'pin_invalid') return setPinError(e.message)
    setFormError(e.message)
  }

  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: name.trim(),
        comment: comment.trim(),
        choices: choicesToSend(d.candidates, choices),
        survey: surveyToSend(d.survey, answers),
      }
      return isNew
        ? adminResponsesApi.create(d.slug, { ...input, ...(pin ? { pin } : {}) })
        : adminResponsesApi.update(d.slug, target.id, input)
    },
    onSuccess: () => {
      refresh()
      onDone()
    },
    onError: showError,
  })

  const remove = useMutation({
    mutationFn: () => adminResponsesApi.remove(d.slug, (target as AdminResponseItem).id),
    onSuccess: () => {
      setConfirmDelete(false)
      refresh()
      onDone()
    },
    onError: (e) => {
      setConfirmDelete(false)
      showError(e)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setNameError(null)
    const miss = missingCandidates(d.candidates, choices)
    setMissing(new Set(miss))
    if (!name.trim()) return nameErrorAt('なまえを入れてください')
    if (isNew && pin !== '' && !/^\d{4}$/.test(pin)) return setPinError('PINは数字4桁にしてください')
    setPinError(null)
    if (miss.length > 0) {
      rowRefs.current[miss[0]]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return setFormError('まだ ◯△✕ がついていない日があります')
    }
    save.mutate()
  }

  return (
    <div className="flex flex-col gap-section">
      <form onSubmit={submit} noValidate className="flex flex-col gap-section">
        {initial?.updatedBy === 'admin' && (
          <Notice>最後に幹事が編集しました（{formatFullDateTime(initial.updatedAt)}）</Notice>
        )}
        <Field label="なまえ（みんなに見えます）" error={nameError}>
          {(id, desc) => (
            <TextInput
              id={id}
              ref={nameRef}
              aria-describedby={desc}
              value={name}
              maxLength={20}
              autoComplete="off"
              placeholder="例）あおい"
              invalid={!!nameError}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(null)
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
              onChange={(e) => setComment(e.target.value)}
            />
          )}
        </Field>

        {isNew && (
          <Field
            label="4桁のPIN（任意）"
            hint="決めておくと、本人が自分のスマホから直せます。本人に伝えてください"
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
        )}

        {formError && <ErrorNotice message={formError} />}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? '保存しています…' : isNew ? 'この内容で追加' : 'この内容で保存'}
        </Button>
      </form>

      {initial && (
        <>
          <PinSection
            slug={d.slug}
            response={initial}
            onReset={onPinReset}
            onDraftChange={setPinDraft}
            showError={showError}
          />
          <section className="flex flex-col gap-2 border-t border-line pt-section-sm">
            <h3 className="text-label font-medium">回答の削除</h3>
            <div>
              <SmallButton variant="caution" onClick={() => setConfirmDelete(true)}>
                この回答を削除
              </SmallButton>
            </div>
          </section>
          <Dialog
            open={confirmDelete}
            title="回答を削除しますか？"
            confirmLabel="削除する"
            caution
            busy={remove.isPending}
            onClose={() => setConfirmDelete(false)}
            onConfirm={() => remove.mutate()}
          >
            <p>
              「{initial.name}」さんの回答（◯△✕・アンケート・ひとこと）を削除します。
              <strong className="font-medium text-maybe-ink">元に戻せません。</strong>
            </p>
          </Dialog>
        </>
      )}
    </div>
  )
}

type PinMode = 'random' | 'manual' | 'delete'

/** PIN の再設定（幹事は PIN を見られないので、作り直すか消すだけ） */
function PinSection({
  slug,
  response: r,
  onReset,
  onDraftChange,
  showError,
}: {
  slug: string
  response: AdminResponseItem
  onReset: (pin: string, revoked: boolean) => void
  /** PIN を入力中か（未保存の確認に使う） */
  onDraftChange: (draft: boolean) => void
  showError: (e: Error) => void
}) {
  const refresh = useRefreshAfterResponseChange(slug)
  const [open, setOpenState] = useState(false)
  const [mode, setModeState] = useState<PinMode>('random')
  const [pin, setPinState] = useState('')
  // 入力中かどうかは、変えた操作のその場で親に知らせる
  const report = (o: boolean, m: PinMode, p: string) => onDraftChange(o && m === 'manual' && p !== '')
  const setOpen = (o: boolean) => {
    setOpenState(o)
    report(o, mode, pin)
  }
  const setMode = (m: PinMode) => {
    setModeState(m)
    report(open, m, pin)
  }
  const setPin = (p: string) => {
    setPinState(p)
    report(open, mode, p)
  }
  const [revoke, setRevoke] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)

  const apply = useMutation({
    mutationFn: async () => {
      const next = mode === 'delete' ? null : mode === 'random' ? randomPin() : pin
      await adminResponsesApi.setPin(slug, r.id, next, revoke)
      return next
    },
    onSuccess: (next) => {
      refresh()
      if (next === null) {
        setDeleted(true)
        setOpen(false)
        return
      }
      onReset(next, revoke)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'pin_invalid') return setPinError(e.message)
      showError(e)
    },
  })

  const hasPin = r.hasPin && !deleted
  const modes: { value: PinMode; label: string }[] = [
    { value: 'random', label: 'ランダムに作る' },
    { value: 'manual', label: '入力する' },
    ...(hasPin ? [{ value: 'delete' as const, label: 'PINを削除' }] : []),
  ]

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-section-sm" aria-labelledby="pin-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="pin-heading" className="text-label font-medium">
            PIN
          </h3>
          <p className="text-note text-muted">{hasPin ? '設定済み（幹事にも見えません）' : '未設定'}</p>
        </div>
        {!open && (
          <SmallButton className="shrink-0" onClick={() => setOpen(true)}>
            PINを再設定
          </SmallButton>
        )}
      </div>
      {deleted && <Notice>PINを削除しました</Notice>}

      {open && (
        <form
          noValidate
          className="flex flex-col gap-3 rounded-card border border-line bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (mode === 'manual' && !/^\d{4}$/.test(pin)) return setPinError('PINは数字4桁にしてください')
            setPinError(null)
            apply.mutate()
          }}
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-label font-medium">新しいPIN</legend>
            {modes.map((m) => (
              <label key={m.value} className="flex min-h-tap cursor-pointer items-center gap-2.5 text-body">
                <input
                  type="radio"
                  name="pin-mode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => {
                    setMode(m.value)
                    setPinError(null)
                  }}
                  className="size-5 accent-navy"
                />
                {m.label}
              </label>
            ))}
          </fieldset>

          {mode === 'manual' && (
            <Field label="4桁のPIN" error={pinError}>
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
          )}
          {mode !== 'manual' && pinError && (
            <p className="text-note text-maybe-ink" role="alert">
              {pinError}
            </p>
          )}

          <label className="flex min-h-tap cursor-pointer items-start gap-2.5 py-1 text-body">
            <input
              type="checkbox"
              checked={revoke}
              onChange={(e) => setRevoke(e.target.checked)}
              className="mt-1 size-5 shrink-0 accent-navy"
              aria-describedby="revoke-hint"
            />
            <span>
              この人の他の端末からの編集も無効にする
              <span id="revoke-hint" className="block text-note text-muted">
                なりすましが心配なときに。本人も、新しいPINで入り直すまで直せなくなります
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <SmallButton
              type="submit"
              variant={mode === 'delete' ? 'caution' : 'primary'}
              disabled={apply.isPending}
            >
              {apply.isPending ? '保存しています…' : mode === 'delete' ? 'PINを削除する' : 'PINを再設定する'}
            </SmallButton>
            <SmallButton onClick={() => setOpen(false)}>やめる</SmallButton>
          </div>
        </form>
      )}
    </section>
  )
}

/** 再設定した PIN を1回だけ大きく見せる */
function PinReveal({
  pin,
  revoked,
  name,
  onClose,
}: {
  pin: string
  revoked: boolean
  name: string
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-section-sm">
      <p className="text-body">{name}さんの新しいPINです。</p>
      <p className="rounded-card border-strong border-navy bg-card py-5 pl-[.5em] text-center text-countdown font-bold tabular-nums tracking-pin text-navy">
        {pin}
      </p>
      <Notice>
        LINEで本人に伝えてください。この画面を閉じると、もう表示できません。
        {revoked && <span className="block">前の端末からの編集は無効にしました。</span>}
      </Notice>
      <CopyButton text={pin} variant="primary" label="PINをコピー" className="self-start" />
      <Button variant="secondary" onClick={onClose}>
        閉じる
      </Button>
    </div>
  )
}
