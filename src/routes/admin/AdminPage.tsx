import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { CopyButton } from '../../components/CopyButton'
import { AnswersEditor, QuestionField } from '../../components/PassphraseFields'
import { Page, PageTitle } from '../../components/Page'
import { adminKeys, useAdminEvent, useSessionGuard } from '../../lib/admin'
import { useAdminPhotos } from '../../lib/photos'
import { api, ApiError } from '../../lib/api'
import {
  answersToSend,
  checkAnswers,
  MAX_QUESTION_LEN,
  newAnswer,
  type AnswerRow,
} from '../../lib/passphrase'
import { charCount } from '../../lib/text'
import { storage } from '../../lib/storage'
import type { AdminEvent } from '../../lib/types'
import {
  ButtonLink,
  Card,
  CardTitle,
  Dialog,
  EmptyState,
  ErrorNotice,
  Notice,
  PageSkeleton,
  SmallButton,
  Tabs,
  Tag,
  TopBar,
} from '../../ui'
import { CandidatesCard } from './CandidatesCard'
import { DecideCard } from './DecideCard'
import { PhotosTab } from './PhotosTab'
import { SurveyTab } from './SurveyTab'

/** イベント管理（design.md 3.8）。フェーズ1は「設定」タブのみ。 */
export default function AdminPage() {
  const { slug = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const keyInUrl = params.get('key')

  // ?key= で開かれたら管理キーを保存し、URL から消す
  useEffect(() => {
    if (!keyInUrl) return
    storage.setAdmin(slug, keyInUrl)
    const next = new URLSearchParams(params)
    next.delete('key')
    setParams(next, { replace: true })
  }, [keyInUrl, params, setParams, slug])

  if (keyInUrl) return <PageSkeleton />
  return <Admin slug={slug} />
}

type AdminTab = 'settings' | 'survey' | 'photos'

function Admin({ slug }: { slug: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const adminPhotos = useAdminPhotos(slug)
  const pendingCount = adminPhotos.data?.filter((p) => p.status === 'pending').length ?? 0
  const ev = useAdminEvent(slug)
  const [params, setParams] = useSearchParams()
  const guard = useSessionGuard()

  useEffect(() => {
    if (ev.data) document.title = `出欠帳｜${ev.data.title}（管理）`
  }, [ev.data])
  useEffect(() => {
    // 管理キーがなくセッションが切れていればログインへ
    if (ev.error && !storage.getAdmin(slug)) guard(ev.error)
  }, [ev.error, guard, slug])

  if (ev.isPending) {
    return (
      <Page>
        <PageSkeleton />
      </Page>
    )
  }
  if (ev.error || !ev.data) {
    const e = ev.error
    const denied = e instanceof ApiError && ['admin_required', 'forbidden', 'unauthorized'].includes(e.code)
    return (
      <Page className="py-24">
        {e instanceof ApiError && e.status === 404 ? (
          <EmptyState title="イベントが見つかりません" note="URLをもう一度確かめてください" />
        ) : denied ? (
          <EmptyState title="管理画面に入れません" note={e.message} />
        ) : (
          <ErrorNotice message={e?.message} onRetry={() => void ev.refetch()} />
        )}
      </Page>
    )
  }

  const d = ev.data
  const owner = d.role === 'owner'
  // 写真タブは /e/:slug/admin/photos
  const tab: AdminTab = location.pathname.endsWith('/photos')
    ? 'photos'
    : params.get('tab') === 'survey'
      ? 'survey'
      : 'settings'
  const setTab = (t: AdminTab) => {
    if (t === 'photos') navigate(`/e/${slug}/admin/photos`, { replace: true })
    else if (tab === 'photos')
      navigate(`/e/${slug}/admin${t === 'survey' ? '?tab=survey' : ''}`, { replace: true })
    else setParams(t === 'settings' ? {} : { tab: t }, { replace: true })
  }
  return (
    <Page className="flex flex-col gap-section-sm pb-10">
      <TopBar backTo="/dashboard" hideBack={!owner} aside={<Tag>幹事モード</Tag>} />
      <PageTitle>{d.title}</PageTitle>
      <Tabs
        label="管理メニュー"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'settings', label: '設定' },
          { key: 'survey', label: 'アンケート' },
          { key: 'photos', label: '写真', badge: pendingCount },
        ]}
      />
      {tab === 'settings' && (
        <>
          <ShareCard event={d} />
          <DecideCard event={d} />
          <CandidatesCard slug={slug} candidates={d.candidates} />
          <SecretsCard event={d} />
          {owner && <DeleteCard event={d} />}
          <ButtonLink to={`/e/${slug}`} variant="secondary">
            参加者の画面を見る
          </ButtonLink>
        </>
      )}
      {tab === 'survey' && <SurveyTab event={d} />}
      {tab === 'photos' && <PhotosTab event={d} />}
    </Page>
  )
}

function ShareCard({ event: d }: { event: AdminEvent }) {
  // iOS の Safari はタップの中でしかコピーできないため、文面は先に取っておく
  const share = useQuery({
    queryKey: [...adminKeys.event(d.slug), 'share-text', d.responseCount, d.confirmed?.candidateId],
    queryFn: ({ signal }) =>
      api<{ text: string }>(`/events/${d.slug}/share-text`, {
        auth: { session: true, admin: d.slug },
        signal,
      }),
    select: (r) => r.text,
  })
  return (
    <Card emphasis>
      <CardTitle aside={<span className="text-note text-muted">回答 {d.responseCount}人</span>}>
        みんなに知らせる
      </CardTitle>
      <p className="break-all rounded-field border border-line bg-paper px-3 py-2.5 text-body">
        {d.shareUrl}
      </p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={share.data ?? d.shareUrl} variant="primary" label="LINE用の文をコピー" />
        <CopyButton text={d.shareUrl} label="URLだけ" />
      </div>
      <p className="text-note text-muted">
        集計の途中経過とURLがまとめてコピーされます。合言葉は別に伝えてください
      </p>
    </Card>
  )
}

function SecretsCard({ event: d }: { event: AdminEvent }) {
  const qc = useQueryClient()
  const guard = useSessionGuard()
  const owner = d.role === 'owner'
  const [dialog, setDialog] = useState<'passphrase' | 'rotate' | null>(null)
  const [answers, setAnswers] = useState<AnswerRow[]>(() => [newAnswer()])
  const [answerError, setAnswerError] = useState<string | null>(null)
  const [question, setQuestion] = useState(d.passphraseQuestion ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adminKey, setAdminKey] = useState(() => storage.getAdmin(d.slug))
  const adminUrl = adminKey ? `${d.shareUrl}/admin?key=${adminKey}` : null

  // 質問だけの変更は、みんなの通過トークンを失効させないので確認なしで保存する
  const saveQuestion = useMutation({
    mutationFn: () =>
      api<AdminEvent>(`/events/${d.slug}/admin`, {
        method: 'PATCH',
        body: { passphraseQuestion: question.trim() || null },
        auth: { session: true, admin: d.slug },
      }),
    onSuccess: (res) => {
      qc.setQueryData(adminKeys.event(d.slug), res)
      setQuestion(res.passphraseQuestion ?? '')
      setError(null)
      setMessage(res.passphraseQuestion ? '質問を保存しました' : '質問を消しました')
    },
    onError: (e) => {
      if (!guard(e)) setError(e.message)
    },
  })
  const questionChanged = question.trim() !== (d.passphraseQuestion ?? '')

  const changePassphrase = useMutation({
    mutationFn: () =>
      api(`/events/${d.slug}/passphrase`, {
        method: 'PUT',
        body: { passphrases: answersToSend(answers) },
        auth: { session: true, admin: d.slug },
      }),
    onSuccess: () => {
      setDialog(null)
      setAnswers([newAnswer()])
      setError(null)
      setMessage('合言葉の答えを変えました。みんなには新しい合言葉を伝えてください')
      void qc.invalidateQueries({ queryKey: adminKeys.event(d.slug) })
      // 幹事自身の参加者画面の通過トークンも無効になる
      storage.setGate(d.slug, null)
      void qc.invalidateQueries({ queryKey: ['event', d.slug] })
    },
    onError: (e) => {
      // 「同じ答えが重なっています」などは、ダイアログを開いたまま出して直せるようにする
      if (!guard(e)) setAnswerError(e.message)
    },
  })

  const rotate = useMutation({
    mutationFn: () =>
      api<{ adminKey: string; adminUrl: string }>(`/events/${d.slug}/admin-key/rotate`, {
        method: 'POST',
        auth: { session: true },
      }),
    onSuccess: (r) => {
      setDialog(null)
      storage.setAdmin(d.slug, r.adminKey)
      setAdminKey(r.adminKey)
      setError(null)
      setMessage('共同幹事用URLを作り直しました。古いURLはもう使えません')
      void qc.invalidateQueries({ queryKey: adminKeys.event(d.slug) })
    },
    onError: (e) => {
      setDialog(null)
      if (!guard(e)) setError(e.message)
    },
  })

  return (
    <Card>
      <CardTitle>合言葉と管理URL</CardTitle>
      {message && <Notice>{message}</Notice>}
      {error && <ErrorNotice message={error} />}

      <form
        className="flex flex-col gap-2 border-b border-line-soft pb-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (charCount(question.trim()) > MAX_QUESTION_LEN)
            return setError(`質問は${MAX_QUESTION_LEN}文字以内にしてください`)
          saveQuestion.mutate()
        }}
      >
        <QuestionField value={question} onChange={setQuestion} />
        {questionChanged && (
          <div>
            <SmallButton type="submit" disabled={saveQuestion.isPending}>
              {saveQuestion.isPending ? '保存しています…' : '質問を保存'}
            </SmallButton>
          </div>
        )}
      </form>

      <div className="flex items-center justify-between gap-3 border-b border-line-soft pb-3">
        <div>
          <p className="text-label font-medium">答え：{d.passphraseCount}つ登録済み</p>
          <p className="text-note text-muted">答えは見られません。変えるときは入れ直します</p>
        </div>
        <SmallButton
          className="shrink-0"
          onClick={() => {
            setAnswers([newAnswer()])
            setAnswerError(null)
            setDialog('passphrase')
          }}
        >
          答えを変更
        </SmallButton>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-label font-medium">共同幹事用URL</p>
        {adminUrl ? (
          <p className="break-all rounded-field border border-line bg-paper px-3 py-2.5 text-note">
            {adminUrl}
          </p>
        ) : (
          <p className="text-note text-muted">
            この端末には保存されていません。{owner ? '「再発行」すると新しいURLをコピーできます' : ''}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {adminUrl && <CopyButton text={adminUrl} />}
          {owner && (
            <SmallButton variant="caution" onClick={() => setDialog('rotate')}>
              再発行
            </SmallButton>
          )}
        </div>
      </div>

      <Dialog
        open={dialog === 'passphrase'}
        title="合言葉の答えを変えますか？"
        confirmLabel="この答えにする"
        busy={changePassphrase.isPending}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          const err = checkAnswers(answers)
          setAnswerError(err)
          if (!err) changePassphrase.mutate()
        }}
      >
        <p>変更すると、みんなもう一度合言葉を入れ直すことになります。</p>
        <AnswersEditor answers={answers} onChange={setAnswers} />
        {answerError && (
          <p className="text-note text-maybe-ink" role="alert">
            {answerError}
          </p>
        )}
      </Dialog>

      <Dialog
        open={dialog === 'rotate'}
        title="共同幹事用URLを再発行しますか？"
        confirmLabel="再発行する"
        caution
        busy={rotate.isPending}
        onClose={() => setDialog(null)}
        onConfirm={() => rotate.mutate()}
      >
        <p>今のURLはすぐに使えなくなります。共同幹事には新しいURLを渡してください。</p>
      </Dialog>
    </Card>
  )
}

/** イベントの削除（オーナーのみ）。写真や回答もすべて消える。 */
function DeleteCard({ event: d }: { event: AdminEvent }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const guard = useSessionGuard()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const remove = useMutation({
    mutationFn: () => api(`/events/${d.slug}`, { method: 'DELETE', auth: { session: true } }),
    onSuccess: () => {
      storage.setAdmin(d.slug, null)
      void qc.invalidateQueries({ queryKey: adminKeys.events })
      navigate('/dashboard', { replace: true })
    },
    onError: (e) => {
      setOpen(false)
      if (!guard(e)) setError(e.message)
    },
  })
  return (
    <Card>
      <CardTitle>イベントを削除</CardTitle>
      <p className="text-note text-muted">回答・アンケート・写真もすべて消え、元には戻せません。</p>
      {error && <ErrorNotice message={error} />}
      <div>
        <SmallButton variant="caution" onClick={() => setOpen(true)}>
          このイベントを削除
        </SmallButton>
      </div>
      <Dialog
        open={open}
        title="本当に削除しますか？"
        confirmLabel="削除する"
        caution
        busy={remove.isPending}
        onClose={() => setOpen(false)}
        onConfirm={() => remove.mutate()}
      >
        <p>
          「{d.title}」と、{d.responseCount}人分の回答、写真をすべて消します。
        </p>
      </Dialog>
    </Card>
  )
}
