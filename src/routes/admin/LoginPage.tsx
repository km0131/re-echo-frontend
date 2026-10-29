import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Page } from '../../components/Page'
import { api, ApiError } from '../../lib/api'
import { storage } from '../../lib/storage'
import type { LoginResult } from '../../lib/types'
import { Button, ErrorNotice, Field, Tag, TextInput } from '../../ui'

/** 幹事ログイン（design.md 3.6） */
export default function LoginPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = '出欠帳｜幹事ログイン'
  }, [])

  const login = useMutation({
    mutationFn: () =>
      api<LoginResult>('/auth/login', { method: 'POST', body: { loginId: loginId.trim(), password } }),
    onSuccess: (res) => {
      storage.setSession(res.token)
      qc.clear()
      navigate('/dashboard', { replace: true })
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'login_failed') setError('IDかパスワードがちがいます')
      else setError(e.message)
    },
  })

  if (storage.getSession()) return <Navigate to="/dashboard" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!loginId.trim() || !password) {
      setError('IDとパスワードを入れてください')
      return
    }
    setError(null)
    login.mutate()
  }

  return (
    <Page wide className="flex min-h-dvh flex-col pb-10 pt-[120px]">
      <div>
        <Tag variant="sepia">幹事専用</Tag>
      </div>
      <h1 className="mt-3 font-hand text-logo text-navy">出欠帳</h1>
      <p className="mt-1 text-body text-muted">イベントの作成と管理はログインしてから</p>

      <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-4">
        {error && <ErrorNotice message={error} />}
        <Field label="ID">
          {(id) => (
            <TextInput
              id={id}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
          )}
        </Field>
        <Field label="パスワード">
          {(id) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" disabled={login.isPending} className="mt-2">
          {login.isPending ? 'ログインしています…' : 'ログイン'}
        </Button>
      </form>

      <p className="mt-auto pt-12 text-note text-muted">
        共同幹事の方は、受け取った管理用URLからそのまま入れます
      </p>
    </Page>
  )
}
