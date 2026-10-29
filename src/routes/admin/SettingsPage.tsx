import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Page, PageTitle } from '../../components/Page'
import { METHOD_LABEL, useLoginEvents, useSessionGuard } from '../../lib/admin'
import { api } from '../../lib/api'
import { cx } from '../../lib/cx'
import { formatFullDateTime } from '../../lib/date'
import { storage } from '../../lib/storage'
import {
  Button,
  Card,
  CardTitle,
  Dialog,
  ErrorNotice,
  Field,
  Notice,
  Skeleton,
  SmallButton,
  TextButton,
  TextInput,
  TopBar,
} from '../../ui'

/** アカウント設定（design.md 4章） */
export default function SettingsPage() {
  if (!storage.getSession()) return <Navigate to="/login" replace />
  return <Settings />
}

function Settings() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const guard = useSessionGuard()
  const events = useLoginEvents()

  useEffect(() => {
    document.title = '出欠帳｜アカウント'
  }, [])
  useEffect(() => {
    if (events.error) guard(events.error)
  }, [events.error, guard])

  const logout = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST', auth: { session: true } }),
    onSettled: () => {
      storage.setSession(null)
      qc.clear()
      navigate('/login', { replace: true })
    },
  })

  return (
    <Page className="flex flex-col gap-section pb-10">
      <TopBar backTo="/dashboard" />
      <PageTitle>アカウント</PageTitle>
      <PasswordCard />

      <Card>
        <CardTitle>ログイン履歴</CardTitle>
        {events.isPending && <Skeleton className="h-32" />}
        {events.error && <ErrorNotice message={events.error.message} onRetry={() => void events.refetch()} />}
        {events.data && (
          <ul className="flex flex-col">
            {events.data.map((e, i) => (
              <li
                key={i}
                className={cx(
                  'grid grid-cols-[1fr_auto] gap-x-3 border-b border-line-soft py-2 text-note last:border-0',
                  !e.success && 'text-maybe-ink',
                )}
              >
                <span className="tabular-nums">{formatFullDateTime(e.at)}</span>
                <span className="text-right">{e.success ? '成功' : '失敗'}</span>
                <span className={cx('col-span-2', e.success ? 'text-muted' : '')}>
                  {METHOD_LABEL[e.method] ?? e.method} ・ {e.device}
                  {e.ip ? ` ・ ${e.ip}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RevokeCard />

      <div className="text-center">
        <TextButton onClick={() => logout.mutate()} disabled={logout.isPending}>
          ログアウト
        </TextButton>
      </div>
    </Page>
  )
}

function PasswordCard() {
  const guard = useSessionGuard()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const change = useMutation({
    mutationFn: () =>
      api('/me/password', {
        method: 'PUT',
        body: { currentPassword: current, newPassword: next },
        auth: { session: true },
      }),
    onSuccess: () => {
      setDone(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    },
    onError: (e) => {
      if (!guard(e)) setError(e.message)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setDone(false)
    if (next.length < 8) return setError('新しいパスワードは8文字以上にしてください')
    if (next !== confirm) return setError('確認用のパスワードが一致しません')
    setError(null)
    change.mutate()
  }

  return (
    <Card>
      <CardTitle>パスワード変更</CardTitle>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field label="現在のパスワード">
          {(id) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          )}
        </Field>
        <Field label="新しいパスワード" hint="8文字以上">
          {(id, d) => (
            <TextInput
              id={id}
              aria-describedby={d}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          )}
        </Field>
        <Field label="新しいパスワード（確認）">
          {(id) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
        </Field>
        {error && <ErrorNotice message={error} />}
        {done && <Notice>パスワードを変更しました。ほかの端末はログアウトされました</Notice>}
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? '変更しています…' : '変更する'}
        </Button>
      </form>
    </Card>
  )
}

function RevokeCard() {
  const guard = useSessionGuard()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const revoke = useMutation({
    mutationFn: () => api<{ revoked: number }>('/me/sessions', { method: 'DELETE', auth: { session: true } }),
    onSuccess: (r) => {
      setOpen(false)
      setResult(
        r.revoked > 0
          ? `${r.revoked}台の端末をログアウトしました`
          : 'ほかにログイン中の端末はありませんでした',
      )
    },
    onError: (e) => {
      setOpen(false)
      if (!guard(e)) setResult(e.message)
    },
  })
  return (
    <Card>
      <CardTitle>他の全端末からログアウト</CardTitle>
      <p className="text-note text-muted">いま使っているこの端末以外のログインをすべて終わらせます。</p>
      {result && <Notice>{result}</Notice>}
      <div>
        <SmallButton variant="caution" onClick={() => setOpen(true)}>
          ログアウトさせる
        </SmallButton>
      </div>
      <Dialog
        open={open}
        title="他の端末をログアウトしますか？"
        confirmLabel="ログアウトさせる"
        caution
        busy={revoke.isPending}
        onConfirm={() => revoke.mutate()}
        onClose={() => setOpen(false)}
      >
        <p>この端末以外でログインしている場合、もう一度ログインが必要になります。</p>
      </Dialog>
    </Card>
  )
}
