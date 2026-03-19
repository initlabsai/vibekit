FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
EXPOSE 3001
CMD ["bun", "run", "apps/api/src/index.ts"]
