// 部品の見本ページ（開発時だけ /dev/ui で開ける。本番ビルドには含めない）
import { useState, type ReactNode } from 'react'
import { Page, PageTitle } from '../components/Page'
import {
  BackIcon,
  BottomBar,
  Button,
  CameraIcon,
  Card,
  CardTitle,
  ChipRow,
  ChoiceButtons,
  ChoiceCounts,
  ClockIcon,
  CopyIcon,
  DeleteIcon,
  DragIcon,
  EmptyState,
  ErrorNotice,
  Field,
  FilterChip,
  InfoIcon,
  NextIcon,
  Notice,
  PersonIcon,
  PhotoBox,
  Pill,
  PillGroup,
  PinInput,
  PlusIcon,
  Polaroid,
  RestoreIcon,
  Skeleton,
  SmallButton,
  SpinIcon,
  StickyNote,
  Tabs,
  Tag,
  TextArea,
  TextInput,
  TopBar,
  UploadIcon,
  type Choice,
} from '../ui'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-hand text-h2 text-navy">{title}</h2>
      {children}
    </section>
  )
}

export default function DevUI() {
  const [choices, setChoices] = useState<Record<number, Choice | undefined>>({
    1: 'yes',
    2: 'maybe',
    3: 'no',
  })
  const [name, setName] = useState('')
  const [pin, setPin] = useState('12')
  const [pills, setPills] = useState<string[]>(['〜5,000円'])
  const [chip, setChip] = useState('すべて')
  const [tab, setTab] = useState<'settings' | 'survey' | 'photos'>('settings')

  return (
    <Page className="flex flex-col gap-section pb-6">
      <TopBar title="3年2組 年末同窓会" aside={<Tag>幹事モード</Tag>} />
      <PageTitle aside={<span className="text-note text-muted">/dev/ui</span>}>部品の見本</PageTitle>

      <Section title="ボタン">
        <Button>この内容で保存</Button>
        <Button variant="secondary">写真をもっと見る</Button>
        <Button variant="dashed">
          <PlusIcon size={18} /> 新しいイベントをつくる
        </Button>
        <Button disabled>押せない状態</Button>
        <div className="flex flex-wrap gap-2">
          <SmallButton variant="primary">
            <CopyIcon size={16} /> URLをコピー
          </SmallButton>
          <SmallButton>変更</SmallButton>
          <SmallButton variant="caution">再発行</SmallButton>
          <SmallButton variant="dashed">＋ 候補日を追加</SmallButton>
        </div>
      </Section>

      <Section title="入力欄">
        <Field label="なまえ（みんなに見えます）" hint="未入力は枠が field 色、入力済みは navy">
          {(id, d) => (
            <TextInput
              id={id}
              aria-describedby={d}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例）あおい"
            />
          )}
        </Field>
        <Field label="入力済み">{(id) => <TextInput id={id} value="けんと" readOnly />}</Field>
        <Field label="エラー" error="その名前はもう使われています">
          {(id, d) => <TextInput id={id} aria-describedby={d} value="あおい" invalid readOnly />}
        </Field>
        <Field label="ひとこと（任意）">
          {(id) => <TextArea id={id} hand value="久しぶり！楽しみ" readOnly />}
        </Field>
        <Field label="4桁のPIN" hint="別のスマホから直すときに使います">
          {(id, d) => <PinInput id={id} aria-describedby={d} value={pin} onChange={setPin} />}
        </Field>
      </Section>

      <Section title="◯△✕">
        <Card>
          {[
            [0, '未選択'],
            [1, '◯ を選択'],
            [2, '△ を選択'],
            [3, '✕ を選択'],
          ].map(([i, label]) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-b border-line-soft pb-3 last:border-0 last:pb-0"
            >
              <span className="text-body font-medium">{label}</span>
              <ChoiceButtons
                label={String(label)}
                value={choices[i as number]}
                onChange={(v) => setChoices((c) => ({ ...c, [i as number]: v }))}
              />
            </div>
          ))}
        </Card>
        <p className="text-body">
          集計：
          <ChoiceCounts counts={{ yes: 18, maybe: 4, no: 2 }} />
        </p>
      </Section>

      <Section title="ピルとチップ">
        <PillGroup label="予算はどれくらい？">
          {['〜3,000円', '〜5,000円', '〜8,000円', 'おまかせ'].map((p) => (
            <Pill
              key={p}
              selected={pills.includes(p)}
              onClick={() => setPills((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))}
            >
              {p}
            </Pill>
          ))}
        </PillGroup>
        <ChipRow>
          {['すべて', '新しい順', '自分の投稿'].map((c) => (
            <FilterChip key={c} selected={chip === c} onClick={() => setChip(c)}>
              {c}
            </FilterChip>
          ))}
        </ChipRow>
      </Section>

      <Section title="カード・タグ・お知らせ">
        <Card emphasis>
          <div className="flex items-center gap-2">
            <Tag>回答受付中</Tag>
            <Tag variant="sepia">日程確定</Tag>
            <Tag variant="off">終了</Tag>
          </div>
          <p className="text-title font-bold">3年2組 年末同窓会</p>
        </Card>
        <Card>
          <CardTitle>候補日</CardTitle>
          <p className="text-body">普通のカード（影なし、枠1px line）</p>
        </Card>
        <Notice>前回の回答を読み込みました。直して保存できます</Notice>
        <ErrorNotice onRetry={() => undefined} />
      </Section>

      <Section title="ポラロイド・テープ・付箋">
        <div className="flex justify-center py-4">
          <Polaroid tilt="-rotate-3" tape caption="あの頃の放課後" className="w-[268px]">
            <PhotoBox alt="" className="h-[244px] w-[244px]" />
          </Polaroid>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {['-rotate-2', 'rotate-[1.5deg]', 'rotate-1', '-rotate-[1.5deg]'].map((t, i) => (
            <Polaroid key={t} tilt={t} caption="文化祭の準備" captionClass="text-[14px]">
              <PhotoBox alt="" index={i + 1} />
            </Polaroid>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <StickyNote text="久しぶり！絶対行きます" name="あおい" index={0} />
          <StickyNote text="年末は実家なので30日がうれしい" name="みさき" index={1} />
        </div>
      </Section>

      <Section title="タブ">
        <Tabs
          label="管理"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'settings', label: '設定' },
            { key: 'survey', label: 'アンケート' },
            { key: 'photos', label: '写真', badge: 3 },
          ]}
        />
      </Section>

      <Section title="アイコン">
        <div className="flex flex-wrap gap-3 text-navy">
          {[
            BackIcon,
            NextIcon,
            ClockIcon,
            PersonIcon,
            CopyIcon,
            UploadIcon,
            DragIcon,
            DeleteIcon,
            RestoreIcon,
            InfoIcon,
            PlusIcon,
            CameraIcon,
            SpinIcon,
          ].map((I, i) => (
            <I key={i} />
          ))}
        </div>
      </Section>

      <Section title="読み込み中・空">
        <Skeleton />
        <EmptyState title="まだ写真がありません" note="最初の1枚を投稿してみよう" />
      </Section>

      <BottomBar>
        <Button>回答する</Button>
      </BottomBar>
    </Page>
  )
}
