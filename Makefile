# 出欠帳フロントの動作チェック。先に backend で make up しておく。
# make が使えない場合の docker compose コマンドは README を参照。
COMPOSE := docker compose

.PHONY: up up-direct down logs check preview ip clean

up: ## 動作チェック用に起動（proxy モード）→ http://localhost:5173
	$(COMPOSE) up --build web

up-direct: ## direct モード（ブラウザから backend を直接呼ぶ。CORS の確認用）
	VITE_API_BASE_URL=http://localhost:8080/api/v1 $(COMPOSE) up --build web

down: ## 停止
	$(COMPOSE) --profile preview down

logs: ## ログを追う
	$(COMPOSE) logs -f web

check: ## ビルドとリントとテスト（コンテナ内）
	$(COMPOSE) run --rm --no-deps web sh -c "npm install && npm run build -- --outDir /tmp/check-dist && npm run lint && npm test"

preview: ## 本番と同じビルド＋Pages Functions → http://localhost:8788
	$(COMPOSE) --profile preview up --build preview

ip: ## スマホから開くための URL を表示
	@ip=$$( (ipconfig getifaddr en0 2>/dev/null) || (hostname -I 2>/dev/null | awk '{print $$1}') ); \
	echo "同じ Wi-Fi のスマホで開く: http://$$ip:5173"; \
	echo "WSL2 の場合は Windows 側の IP（PowerShell で ipconfig）を使い、ポート転送が必要です（README 参照）"

clean: ## コンテナと node_modules ボリュームを削除
	$(COMPOSE) --profile preview down -v --remove-orphans
