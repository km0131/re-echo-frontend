# フロントエンド 修正02：Cloudflare Turnstile

始める前に：
- `docs/spec-fix02.md` を `docs/spec.md` の末尾に「12. 修正02」として追記しておくこと。
- backend の F2-3 が終わり、「フロントへの連絡事項」を spec.md に反映してから始めること。
- 修正01（FF1-1〜FF1-3）が終わっていること。

---

## ステップ FF2-1：Turnstile ウィジェット

```
docs/spec.md 12.2 に沿って、Cloudflare Turnstile を入れてください。

やること：
1. スクリプトの読み込み
   - https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit を、Turnstile を使う画面に入ったときだけ動的に読み込む（全ページで読み込まない）
   - 新規ライブラリ（react-turnstile など）は入れず、src/lib/turnstile.ts と src/components/Turnstile.tsx を自作する
     （理由：必要なのは render・reset・remove だけで、外部パッケージを増やすほどではないため）
2. <Turnstile action="gate" onToken={...} /> 部品
   - turnstile.render で explicit に描画。options：sitekey=VITE_TURNSTILE_SITE_KEY、action、appearance="interaction-only"、
     theme はサイトのテーマ（light／dark）に合わせる、language="ja"、refresh-expired="auto"
   - アンマウント時に turnstile.remove
   - 呼び出し側から reset できるよう ref で reset() を公開
   - チェックボックスが出たときだけ高さを取り、出ていないときは余白を作らない
3. 使い方を1つの形にそろえる：src/lib/useTurnstileToken.ts
   - { token, ready, reset, element } を返すフック
   - 送信ボタンは token が取れるまで「確認中…」で無効化（interaction-only なので通常は一瞬）
   - 送信後は成功・失敗にかかわらず reset() する（トークンは1回きり）
4. src/lib/api.ts
   - リクエストごとに turnstileToken を渡せるようにし、あれば X-Turnstile-Token ヘッダーを付ける
   - turnstile_required・turnstile_failed を受けたら、ウィジェットを reset して spec.md のメッセージを出す
5. 付ける場所（spec.md 12.2 の表と同じ action 名）
   - ログイン（login）、合言葉ゲート（gate）、回答フォームの新規送信（answer。更新のときは不要）、
     別端末から編集の名前＋PIN（recover）、写真投稿（upload。幹事としての投稿では不要）、コメントの「貼る」（comment）
   - ウィジェットは送信ボタンのすぐ上。方眼背景の上に白い紙を1枚置いたように、ウィジェットの周りに余白を取る（枠や影は足さない）
6. CSP
   - public/_headers（Cloudflare Pages）の CSP に script-src と frame-src で https://challenges.cloudflare.com を追加
   - CLAUDE.md の「外部スクリプト禁止」に「例外：Cloudflare Turnstile」を1行追記
7. 環境変数
   - .env.development に VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA（常に成功）
   - 本番の値は Cloudflare Pages の環境変数に設定する手順を README に書く（Turnstile のウィジェット設定で、ホスト名に chosei.ドメイン を登録することも）
   - make preview でもテスト用キーで動くこと

完了条件：
1. テスト用キー「常に成功」で、6つの操作がすべて通る
2. サイトキーを 3x00000000000000000000FF（必ずチェックボックス）に変えると、送信ボタンの上にチェックボックスが出て、
   チェックするまで送信できない。390px 幅のスクリーンショット
3. backend のシークレットを「常に失敗」にすると、ゲートで「確認がうまくいきませんでした…」が出て、もう一度送り直せる
4. 同じ画面で2回続けて送信しても、2回目が turnstile_failed にならない（reset できている）
5. Turnstile を使わない画面（トップ、ギャラリー一覧など）で api.js が読み込まれていない（Network タブで確認）
6. npm run build、npm run lint が通る
```
