# Akyuu

This repository implements the GitHub Intelligence Agent described in [`/docs`](./docs).
The docs remain the source of truth for scope, architecture, and execution order.

## Current Status

The repository now includes the first runnable vertical slice:

- `pnpm workspace` monorepo
- `apps/web` with `Today`, `Watches`, `Topics`, `Trends`, `History`, `Ask`
- `apps/api` with watch CRUD, topic queries, trend queries, digest queries, feedback/preference endpoints, notification endpoints, ask endpoints, and manual pipeline trigger
- `apps/scheduler` with health check and manual schedule tick
- `apps/worker` with queue handlers for ingest, normalize, topic aggregation, score, trend diff, digest build, and notification delivery preview
- PostgreSQL schema and SQL migration for the first three implementation stages
- Redis + BullMQ queue base
- deterministic digest generation with optional LLM adapter stub

## Implemented Flow

The current end-to-end chain is:

1. Create a `RepoWatch`, `TopicWatch`, or `TrendWatch`
2. Trigger `/api/v1/pipeline/run`
3. Worker fetches repo/trending data
4. Raw data is normalized into canonical events and trend snapshots
5. Events are scored and matched into topic evidence / topic updates
6. A daily digest is built and saved
7. Web reads the latest digest, topics, trends, feedback, and ask history from API
8. Users can ask a deterministic follow-up question grounded on digest and topic evidence
9. Users can leave explicit worthwhile / not worthwhile feedback on digest items
10. Feedback updates a workspace-level preference profile and reranks future recommended items
11. Digest delivery attempts are written to `outbound_notification` and surfaced in the Web UI

## Tech Stack

- Node.js `24 LTS`
- TypeScript
- `pnpm workspace`
- Next.js
- Fastify
- PostgreSQL
- Redis + BullMQ
- Drizzle ORM for schema/query modeling

## Local Development

### 1. Install dependencies

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install
```

### 2. Start infrastructure

```bash
pnpm db:up
pnpm db:migrate
pnpm db:seed
```

Default dev ports:

- Postgres: `15432`
- Redis: `16379`
- API: `3001`
- Scheduler: `3002`
- Worker: `3003`
- Web: `3100`

### 3. Start apps

Use separate terminals:

```bash
pnpm dev:worker
pnpm dev:api
pnpm dev:scheduler
pnpm dev:web
```

### 4. Open the product

- Web: `http://localhost:3100/today`
- API health: `http://localhost:3001/health`
- Scheduler health: `http://localhost:3002/health`
- Worker health: `http://localhost:3003/health`

## Manual Verification

### Create watches

From the Web UI on `/watches`, create:

- one `RepoWatch`, for example `nodejs/node`
- one `TopicWatch`, for example `Node Runtime` with repo binding `nodejs/node`
- one `TrendWatch`, for example `global`

### Trigger the pipeline

Use the button on `/today`, or call:

```bash
curl -X POST http://localhost:3001/api/v1/pipeline/run \
  -H "content-type: application/json" \
  -d '{}'
```

Then refresh `/today` to see the latest digest.

### Ask a follow-up

Open `/ask` and submit a question such as:

- `今天最值得看的 3 个 PR 是什么？`
- `Node Runtime 最近有没有推进？`

The answer is stored in `question_session` / `answer_record` and rendered back in the Ask page.

### Review trends and feedback

- Open `/trends` to inspect the latest trend diff cards and snapshot items
- Use the `Worthwhile` / `Not Worthwhile` actions on `/today` and `/history`
- Recent feedback is stored in `feedback` and shown back on the Today page
- Daily, weekly, and monthly digests can be generated from Today and opened from History detail pages
- Delivery preview records can be inspected on `/delivery`
- Explicit feedback updates the workspace preference profile shown on `/today`

## Environment Variables

See [`.env.example`](./.env.example) for the full list.

Key variables:

- `DATABASE_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `DEFAULT_USER_EMAIL`
- `DEFAULT_WORKSPACE_SLUG`
- `GITHUB_TOKEN`
- `OPENAI_API_KEY`

`GITHUB_TOKEN` is optional for the current public-source flow, but strongly recommended to avoid low unauthenticated limits.

## Quality Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Known Gaps

The current slice is intentionally limited. It does **not** yet include:

- real outbound email / Slack / Telegram delivery providers
- GitHub App installation flow
- team collaboration or user-level personalization

Those remain in the later roadmap and ADRs under [`docs/`](./docs).
