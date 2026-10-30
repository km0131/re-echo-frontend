// API の型（docs/spec.md 5章・12章・14章）
import type { Choice } from '../ui/styles'

export type Counts = { yes: number; maybe: number; no: number }

export type PublicEvent = {
  slug: string
  title: string
  gateCaption: string
  /** 合言葉の質問（修正01）。なければ null */
  passphraseQuestion: string | null
  year: number
  publicPhotoUrl: string | null
  ogImageUrl?: string | null
}

export type GateResult = { gateToken: string; expiresAt: string }

export type CandidateSummary = {
  id: string
  startsAt: string
  label: string
  counts: Counts
  score: number
}

export type ConfirmedView = { candidateId: string; startsAt: string; label: string; daysLeft: number }

export type SurveyType = 'single' | 'multi' | 'text'
export type SurveyQuestion = {
  id: string
  text: string
  type: SurveyType
  options: { id: string; text: string; count: number }[]
  answers: { name: string; text: string }[]
  answeredCount: number
}
export type SurveyAnswer = { questionId: string; optionIds?: string[]; text?: string }

export type ResponseItem = {
  id: string
  name: string
  comment: string
  choices: Record<string, Choice>
  hasPin: boolean
  createdAt: string
  updatedAt: string
  survey?: SurveyAnswer[]
}

export type EventDetail = {
  slug: string
  title: string
  description: string
  endsOn: string
  year: number
  candidates: CandidateSummary[]
  responses: ResponseItem[]
  best: string[]
  confirmed: ConfirmedView | null
  survey: SurveyQuestion[]
}

export type ResponseInput = {
  name: string
  comment: string
  choices: Record<string, Choice>
  pin?: string
  survey?: SurveyAnswer[]
}

export type CreateResponseResult = { id: string; editToken: string }

// --- 幹事 ---
export type User = { id: string; loginId: string; displayName: string }
export type LoginResult = { token: string; user: User }
export type PreviousLogin = { at: string; method: string; device: string }
export type Me = { user: User; previousLogin: PreviousLogin | null }
export type LoginEvent = { at: string; method: string; device: string; success: boolean; ip: string | null }

export type EventStatus = 'open' | 'confirmed' | 'ended'
export type ConfirmedInfo = { candidateId: string; startsAt: string; label: string }

export type EventListItem = {
  slug: string
  title: string
  status: EventStatus
  responseCount: number
  candidateCount: number
  pendingPhotoCount: number
  photoCount: number
  deletionSuggested: boolean
  classSize: number | null
  confirmed: ConfirmedInfo | null
  endsOn: string
  createdAt: string
}

export type AdminCandidate = { id: string; startsAt: string; label: string; counts?: Counts; score?: number }

export type AdminEvent = {
  slug: string
  title: string
  description: string
  endsOn: string
  gateCaption: string
  passphraseQuestion: string | null
  /** 登録されている答えの数（答えそのものは返らない） */
  passphraseCount: number
  classSize: number | null
  status: EventStatus
  role: 'owner' | 'coadmin'
  shareUrl: string
  responseCount: number
  photoApproval: 'manual' | 'auto'
  photoLimitPerPerson: number
  photoQuotaMb: number
  candidates: AdminCandidate[]
  best: string[]
  confirmed: ConfirmedView | null
  survey: SurveyQuestion[]
}

export type CreateEventInput = {
  title: string
  description: string
  passphraseQuestion: string | null
  /** 合言葉の答え（1〜5個） */
  passphrases: string[]
  endsOn: string
  gateCaption: string
  classSize: number | null
  candidates: { startsAt: string }[]
}

export type CreateEventResult = { slug: string; adminKey: string; shareUrl: string; adminUrl: string }

export type SurveyQuestionInput = {
  id?: string
  text: string
  type: SurveyType
  options: { id?: string; text: string }[]
}

// --- 写真（フェーズ3） ---
export type PhotoStatus = 'processing' | 'pending' | 'approved' | 'rejected' | 'hidden' | 'failed'
export type Visibility = 'public' | 'members' | 'draft'

export type PhotoItem = {
  id: string
  /** タイトル（修正01）。なければ null */
  title: string | null
  caption: string
  /** 表示中のコメント数 */
  commentCount: number
  width: number
  height: number
  thumbUrl: string | null
  largeUrl: string | null
  uploaderName: string
  mine: boolean
  status: PhotoStatus
  visibility: Visibility
  createdAt: string
}

export type PhotoList = {
  photos: PhotoItem[]
  answered: boolean
  limits: { perPerson: number; used: number; remaining: number } | null
}

export type AdminPhoto = PhotoItem & {
  byParticipant: boolean
  sortOrder: number
  bytes: number
  hideRequests: { reason: string; createdAt: string; resolvedAt: string | null }[]
}

// --- 写真のコメント（修正01） ---
export type PhotoComment = {
  id: string
  /** 名前（任意）。null なら画面では「だれか」 */
  authorName: string | null
  body: string
  createdAt: string
  mine: boolean
  /** 幹事向けの一覧だけに付く */
  status?: 'visible' | 'hidden'
}
export type CreateCommentResult = { comment: PhotoComment; deleteToken: string }
