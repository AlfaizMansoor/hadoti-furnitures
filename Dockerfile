# Build the application, then serve it from a slim runtime image.
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock* bunfig.toml* ./
RUN bun install --frozen-lockfile || bun install

COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", ".output/server/index.mjs"]
