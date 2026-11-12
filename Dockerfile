FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates clamav clamav-freshclam \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@11.25.0
COPY . .
RUN pnpm install --frozen-lockfile && pnpm db:generate
ENV NODE_ENV=production
ENV CLAMSCAN_PATH=/usr/bin/clamscan
EXPOSE 4000
CMD ["sh", "scripts/start-render-api.sh"]
