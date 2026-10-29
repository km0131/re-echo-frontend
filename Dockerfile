# 動作チェック用（本番の Cloudflare Pages では使わない）。dev と preview で同じイメージを使う。
FROM node:22-bookworm-slim AS dev
# wrangler（workerd）が TLS の証明書を必要とするため ca-certificates を入れる
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
EXPOSE 5173 8788
CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0 --port 5173 --strictPort"]
