# syntax=docker/dockerfile:1
# Game server image: runs the TypeScript sources directly with Node's built-in type stripping (no bundler),
# as non-root on distroless (no shell, no package manager). The only runtime dependency is `ws`.

FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace @calindra-strike/server --omit=dev --ignore-scripts --no-audit --no-fund
COPY shared shared
COPY server server

FROM gcr.io/distroless/nodejs24-debian12:nonroot@sha256:14d42e2511532589a7c7e01a753667a74fcc96266e137e8125006b87b0c32d0a
WORKDIR /app
COPY --from=build --chown=nonroot:nonroot /app /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=7350
USER nonroot
EXPOSE 7350
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:7350/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["server/src/index.ts"]
