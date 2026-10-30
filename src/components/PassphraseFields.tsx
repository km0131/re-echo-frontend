import { MAX_ANSWERS, MAX_ANSWER_LEN, MAX_QUESTION_LEN, newAnswer, type AnswerRow } from '../lib/passphrase'
import { charCount, passphraseLength } from '../lib/text'
import { DeleteIcon, Field, SmallButton, TextInput } from '../ui'

/** 合言葉の質問（任意） */
export function QuestionField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="合言葉の質問（任意）" hint="合言葉の画面に出ます。答えのヒントにならない聞き方に">
      {(id, d) => (
        <TextInput
          id={id}
          aria-describedby={d}
          value={value}
          placeholder="例）担任の先生の名前は？"
          autoComplete="off"
          invalid={charCount(value.trim()) > MAX_QUESTION_LEN}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}

/** 合言葉の答え（1〜5個）。表記ゆれを別の答えとして足せる */
export function AnswersEditor({
  answers,
  onChange,
}: {
  answers: AnswerRow[]
  onChange: (v: AnswerRow[]) => void
}) {
  const set = (key: number, value: string) =>
    onChange(answers.map((a) => (a.key === key ? { key, value } : a)))

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-label font-medium text-ink">答え</legend>
      <ul className="flex flex-col gap-2">
        {answers.map((a, i) => {
          const len = passphraseLength(a.value)
          return (
            <li key={a.key} className="flex items-center gap-2">
              <TextInput
                aria-label={`答え${i + 1}`}
                value={a.value}
                placeholder={i === 0 ? '例）田中先生' : '例）たなかせんせい'}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                invalid={len > MAX_ANSWER_LEN}
                onChange={(e) => set(a.key, e.target.value)}
              />
              {answers.length > 1 && (
                <button
                  type="button"
                  aria-label={`答え${i + 1}を消す`}
                  onClick={() => onChange(answers.filter((x) => x.key !== a.key))}
                  className="inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-field text-muted hover:text-ink"
                >
                  <DeleteIcon size={18} />
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {answers.length < MAX_ANSWERS && (
        <div>
          <SmallButton variant="dashed" onClick={() => onChange([...answers, newAnswer()])}>
            ＋ 別の答えを追加
          </SmallButton>
        </div>
      )}
      <p className="text-note text-muted">
        ひらがな・カタカナ、全角・半角、スペースの違いは自動で同じとみなします。漢字とかなの違いは別の答えとして足してください（
        {MAX_ANSWERS}つまで）
      </p>
    </fieldset>
  )
}
