# 仕様追記：修正01（合言葉・写真タイトル・写真コメント）

この章は `docs/spec.md` の末尾に「11. 修正01」として追記する。backend と frontend の両方に同じ内容を置く。食い違ったら backend 側が正。

---

## 11.1 合言葉

### 何が変わるか
| 項目 | 変更前 | 変更後 |
| --- | --- | --- |
| 使える文字 | 実質、英数字のみ | 日本語（ひらがな・カタカナ・漢字）、記号、絵文字も可 |
| 長さ | （未定義） | 正規化後に 1〜50 文字（バイト数ではなく文字数で数える） |
| 質問 | なし | 任意で1つ設定できる（例：「担任の先生の名前は？」） |
| 答えの数 | 1つ | 1〜5個（表記ゆれを別解として登録できる） |

### 正規化（判定の前に、入力と登録値の両方に同じ処理をかける）
1. Unicode NFKC（全角英数→半角、半角カナ→全角カナ など）
2. 空白をすべて除去（半角・全角スペース、タブ、改行）
3. 英字を小文字に
4. カタカナをひらがなに（ァ〜ヶ → ぁ〜ゖ。長音「ー」はそのまま）

例：`タナカ　先生` → `たなか先生`、`ＤＥＭＯ` → `demo`

漢字とかなの読みの違い（「田中」と「たなか」）は正規化では吸収しない。必要なら幹事が別解として登録する。

### 画面での扱い
- 合言葉の入力欄は `type="text"`（`type="password"` は日本語入力を使えないブラウザがあるため使わない）。
- 合言葉はクラス全員で共有するものなので、パスワードほど隠す必要はない。

## 11.2 写真のタイトル
- 投稿時に1枚ごとに任意で設定できる。最大 40 文字。
- 後から編集できるのは、投稿した本人（E）と幹事（A）。
- `caption`（説明文、最大 200 文字）は従来どおり残す。

## 11.3 写真のコメント
- 合言葉を通過した人なら誰でも書ける（回答していなくてもよい）。
- 名前は任意（最大 20 文字）。空なら画面では「だれか」と表示する。
  - 回答済みの端末では、名前欄に自分の回答名を初期値として入れる（消して匿名にもできる）。
- 本文は 1〜200 文字。改行は可（連続する改行は2つまでに詰める）。
- コメントできるのは、その人が見られる写真（承認済みの members / public）だけ。
- 削除できるのは、書いた本人（コメント削除トークン）と幹事。
- 幹事は管理画面でコメントを非表示にできる。
- 連投対策：IP ごとに 1 分あたり 10 件まで。
- 写真を削除すると、その写真のコメントも消える。

---

## 11.4 API の変更

### 変更
| メソッド | パス | 認証 | 変更内容 |
| --- | --- | --- | --- |
| GET | `/public/events/{slug}` | － | `passphraseQuestion`（string か null）を追加 |
| POST | `/events` | S | `passphraseQuestion`（任意）、`passphrases`（1〜5個の配列）を受け取る。従来の `passphrase`（文字列1つ）も当面は受け付ける |
| GET・PATCH | `/events/{slug}/admin` | A | `passphraseQuestion` の取得・変更（質問だけの変更では通過トークンは失効しない）。`passphraseCount`（登録されている答えの数）を返す。答えそのものは返さない |
| PUT | `/events/{slug}/passphrase` | A | 本文を `{ "passphrases": ["田中先生", "たなかせんせい"] }` に変更（1〜5個）。全件置き換え。`passphrase_version` を +1 して通過トークンを全失効 |
| POST | `/events/{slug}/gate` | － | 本文は従来どおり `{ "passphrase": "..." }`。正規化してから、登録された全ての答えと照合 |
| POST | `/events/{slug}/photos` | G＋E、または A | multipart に `meta` を追加（後述） |
| GET | `/events/{slug}/photos` | G | 各写真に `title`（string か null）と `commentCount` を追加 |
| PATCH | `/events/{slug}/photos/{id}` | A、または投稿者の E | `title` と `caption` は投稿者本人も変更できる。承認・公開範囲・並び順は従来どおり A のみ |

`POST /events/{slug}/photos` の `meta`：
```json
// multipart の "meta" フィールド（JSON文字列）。files と同じ順番、同じ数
[ { "title": "修学旅行の朝", "caption": "" }, { "title": null } ]
```
`meta` が無い場合は、全てタイトルなしとして扱う。

### 追加
| メソッド | パス | 認証 | 内容 |
| --- | --- | --- | --- |
| GET | `/events/{slug}/photos/{id}/comments` | G（幹事は A でも可） | コメント一覧（古い順） |
| POST | `/events/{slug}/photos/{id}/comments` | G | コメント投稿。`X-Edit-Token` があれば回答と紐づける |
| DELETE | `/events/{slug}/photos/{id}/comments/{commentId}` | `X-Comment-Token`、または A | コメント削除 |
| PATCH | `/events/{slug}/photos/{id}/comments/{commentId}` | A | `{ "status": "hidden" \| "visible" }` |

コメント投稿：
```json
// リクエスト
{ "authorName": "たなか", "body": "この日めっちゃ寒かったよね" }   // authorName は省略・null 可

// レスポンス 201
{
  "comment": { "id": "01J…", "authorName": "たなか", "body": "この日めっちゃ寒かったよね",
               "createdAt": "2026-10-29T01:23:45Z", "mine": true },
  "deleteToken": "…"   // この1回だけ返す
}
```

コメント一覧：
```json
{ "comments": [ { "id": "01J…", "authorName": null, "body": "なつかしい", "createdAt": "…", "mine": false } ] }
```
- `mine` は、リクエストの `X-Comment-Tokens`（カンマ区切り、最大50個）に一致するトークンがあれば true。
- 参加者には `status = hidden` のコメントを返さない。幹事（A）には `status` 付きで全件返す。

エラーコード（追加）：
| code | HTTP | message |
| --- | --- | --- |
| `passphrase_invalid_format` | 400 | 合言葉は1〜50文字で入力してください |
| `passphrase_too_many` | 400 | 合言葉の答えは5つまでです |
| `passphrase_duplicate` | 400 | 同じ答えが重なっています |
| `photo_title_too_long` | 400 | タイトルは40文字までです |
| `comment_invalid` | 400 | コメントは1〜200文字で入力してください |
| `comment_name_too_long` | 400 | 名前は20文字までです |
| `comment_rate_limited` | 429 | 少し時間をおいてから書きこんでください |
| `comment_forbidden` | 403 | このコメントは消せません |

### LocalStorage（フロント）
- `chosei:comments:{slug}` … `{ [commentId]: deleteToken }`

## 11.5 テーブル
マイグレーション `0004_fix01.sql` を参照。
- `events.passphrase_question` を追加、`events.passphrase_hash` を削除
- `event_passphrases`（答え。1イベント1〜5行）を追加
- `photos.title` を追加
- `photo_comments` を追加
