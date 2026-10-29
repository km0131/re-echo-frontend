# フロントエンド フェーズ1：MVP

`---` で区切られた1ブロックが1回分のプロンプトです。上から順にコピーして貼り付けてください。
API が必要なステップは、backend の対応するステップが終わってから進めてください（`00_README.md` の進行表）。

---

## ステップ F1-1：リポジトリの土台

```
CLAUDE.md、docs/design.md、docs/spec.md を読んでから、フロントの土台を作ってください。

やること：
1. React + TypeScript + Vite + Tailwind CSS のプロジェクト
2. tailwind.config.ts に docs/design.md 1章のトークン（色・フォント・文字サイズ・角丸）をすべて定義する。色は CSS変数経由にし、あとでダークモードに差し替えられるようにする
3. index.html：lang="ja"、Google Fonts（Zen Kurenaido と Noto Sans JP 400/500/700）、noindex
4. body に方眼ノートの背景（design.md 1.5）
5. 仮のトップページにトークンの見本（色見本、font-hand と font-sans の見出し、主ボタン）
6. リンターとフォーマッター、.gitignore、README.md（概要だけ）

やらないこと：Docker（次のステップ）、部品、画面、API 通信。

完了条件：
1. npm run dev で見本ページが表示され、方眼背景と手書き風の見出しが出ている
2. JSX に色コードの直書きがない（grep で確認）
3. npm run build と npm run lint が通る
```

---

## ステップ F1-2：動作チェック用 Docker

```
docs/docker.md を読んで、ローカルの動作チェック用 Docker 環境を作ってください。本番（Cloudflare Pages）では Docker を使いません。

やること：
1. docs/docker.md 3章のファイルをすべて作る（Dockerfile、compose.yaml、.dockerignore、vite.config.ts の server 設定、.env.example、Makefile）
2. src/lib/api.ts の最小版：VITE_API_BASE_URL の相対パス（/api/v1）と絶対URLの両方で動く fetch ラッパー。API に届かないときは開発時だけ「API に接続できません。backend で make up してください」を画面上部に出す
3. README.md に「Dockerでの動作チェック」の節（backend を先に起動すること、proxy と direct の違い、スマホ確認、ファイアウォールの注意、make が使えない場合の docker compose コマンド）
4. preview プロファイルは、まだ functions/ がないので「ビルドして wrangler で配信する」ところまででよい

注意：
- ベースイメージはマルチアーキテクチャ対応の公式イメージだけ
- このステップ以降、すべての動作確認はこの Docker 環境で行う

完了条件：docs/docker.md 7章の 1〜6 をすべて確認し、結果を報告する（スマホ確認は私が行う）
```

---

## ステップ F1-3：基本部品・APIクライアント・ルーティング

```
docs/design.md の1章・2章をもとに、フロントの土台を作ってください。画面はまだ作りません。

やること：
1. src/ui/ に design.md 2章の基本部品をすべて作る：Button（主・副・点線）、SmallButton、TextInput、PinInput、ChoiceButtons、Pill、FilterChip、Card、Polaroid、Tape、StickyNote、Tag、Notice、TopBar、BottomBar、Tabs、線アイコン一式（戻る、次へ、時計、人、コピー、アップロード、ドラッグハンドル、削除、復元）
   - ChoiceButtons はキーボード操作（矢印キー）と aria を正しく。◯△✕ は記号を必ず表示
   - 入力欄は 16px 以上、押せる部分は 44px 以上
2. src/lib/api.ts を仕上げる：トークン種別（session / gate / edit / admin）に応じて spec.md 2章のヘッダーを付ける。エラー形式を ApiError に変換。401 gate_required ならゲートに戻せるように
3. src/lib/storage.ts：CLAUDE.md 4章の LocalStorage キー（try/catch 付き）
4. src/lib/date.ts：Asia/Tokyo での表示（「12/29（火）19:00〜」「10/26 22:14」）と日数計算。テストを書く（ブラウザのタイムゾーンを UTC にしても正しいこと）
5. React Router のルート定義（docs/spec.md 4章の全パス）。未実装の画面は「準備中」
6. TanStack Query の設定
7. /dev/ui に部品の見本ページ（本番ビルドでは出さない）。Polaroid や ChoiceButtons の各状態を並べる
8. 幅640px以上では内容を最大480pxで中央寄せ（design.md 6章）
9. 読み込み中・エラー・空の状態の部品（design.md 5章。スピナーは使わない）

完了条件：
1. /dev/ui で全部品が表示され、ChoiceButtons の未選択・◯・△・✕ の色が design.md と一致する
2. JSX に色コードの直書きがない
3. 幅360pxで横スクロールが出ない
4. make check が通る
```

---

## ステップ F1-4：参加者の画面

```
docs/design.md の3.1〜3.4章に沿って、参加者の画面を作ってください。backend の B1-6 まで終わっている前提です（backend で make seed したイベントを使って確認する）。

フェーズ2・3の要素（いい感じの日、確定カード、アンケート、PIN、写真リンク、紙吹雪、ミニギャラリー）は今は出しません。ただし後から差し込めるように、セクションごとにコンポーネントを分けてください。

やること：
1. /e/:slug：通過トークンがなければ合言葉ゲート（3.1）、あればイベントトップ（3.2）
2. イベントトップ：ヘッダー（写真の代わりに photo 色の下地）、説明文、みんなの回答（マトリクス表。行＝候補日で左列 sticky、列＝名前で横スクロール）、ひとこと（StickyNote）、BottomBar（回答済みなら「回答を直す」）
3. /e/:slug/answer：回答フォーム（3.3）。editToken があれば前回の回答を読み込み Notice を出して PUT。なければ POST。未入力の候補日と名前重複エラーの扱いは 3.3 のとおり
4. /e/:slug/answer/done：「ありがとう！」と名前、「みんなの回答を見る」
5. 読み込み中・エラー・空の状態は design.md 5章のとおり

完了条件：
1. 別のブラウザ（シークレット）2つで別々の名前で回答し、両方の結果が表に出る
2. 同じブラウザでもう一度開くと回答が復元され、直して保存できる
3. backend 側で合言葉を変えると、参加者はゲートに戻される
4. 幅390pxのスクリーンショットを design.md の画面と並べて、違いを箇条書きで報告（違いがあれば直す）
```

---

## ステップ F1-5：幹事の画面

```
docs/design.md の3.6〜3.8章と4章に沿って、幹事の画面を作ってください。backend の B1-6 まで終わっている前提です。

やること：
1. /login（3.6）：成功で /dashboard へ。ログイン済みなら /dashboard へ飛ばす
2. /dashboard（3.7）：前回のログイン帯、イベントカード（受付中・確定・終了）、「＋ 新しいイベントをつくる」
3. /events/new（4章）：作成後、共有URLと共同幹事用URLを「今しか表示されません」の Notice 付きで表示し、それぞれコピーできる
4. /e/:slug/admin（3.8）：フェーズ1は「設定」タブのみ。みんなに知らせる（URLをコピー）、候補日（追加・削除・ドラッグ並べ替え。スマホは長押し）、合言葉と管理URL（確認ダイアログ付き）
   - ?key= 付きで開かれたら管理キーを保存し、URL から key を消す（history.replaceState）
   - 共同幹事モードでは戻るボタンと再発行ボタンを出さない
5. /settings（4章）：パスワード変更、ログイン履歴、他の全端末からログアウト、ログアウト
6. セッション切れ（401）なら /login へ

完了条件：
1. ログイン→イベント作成→共有URLを別ブラウザで開いて回答→ダッシュボードの回答数が増える、の一連が通る
2. 共同幹事用URLを別ブラウザで開くと管理画面に入れ、再発行ボタンが出ない
3. 候補日を並べ替えると参加者側の表の順番も変わる
4. 各画面の幅390pxスクリーンショットを design.md と見比べた報告
```

---

## ステップ F1-6：Cloudflare Pages へのデプロイ

```
フェーズ1を Cloudflare Pages に出せるようにしてください。

やること：
1. public/_headers：CSP（CLAUDE.md 6章）、X-Content-Type-Options、Referrer-Policy、参加者ページの X-Robots-Tag: noindex
2. SPA のルーティングがリロードしても 404 にならないことを確認（Pages の SPA フォールバック）
3. README に Pages の設定手順（ビルドコマンド、出力ディレクトリ、環境変数 VITE_API_BASE_URL=https://chosei-api.ドメイン/api/v1、カスタムドメイン）
4. make up-direct と make preview で、本番と同じ「別オリジン」の状態で全画面が動くことを確認（backend の CORS 設定が正しいかの確認も兼ねる）

完了条件：
1. make preview で、ログイン・イベント作成・回答が通る
2. CSP 違反がブラウザのコンソールに出ていない
3. 本番URLでの動作確認手順（私が行う）
```
