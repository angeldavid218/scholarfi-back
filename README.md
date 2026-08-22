# ScholarFi Backend (`scholarfi-back`)

AdonisJS 7 + TypeScript API for the ScholarFi demo simulator. All app routes are under **`/api/v1`**.

## Prerequisites

- Node.js 22+ (or current active LTS)
- npm 11+
- PostgreSQL 15+ (default connection: `pg` in `config/database.ts`)

## First-run setup

1. Install dependencies:

```bash
npm install
```


1. Copy environment template:


```bash
cp .env.example .env
```

1. Set required values in `.env`:

- `APP_KEY` — generate with `node ace generate:key`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` (see CI in `.github/workflows/ci.yml` for a local example)
- `CORS_ORIGIN` — comma-separated frontend origins for **production** (dev allows all origins). Example:

  `CORS_ORIGIN=http://localhost:5173,https://scholarfi.netlify.app`

1. Run migrations:

```bash
node ace migration:run
```

1. Start the API:

```bash
npm run dev
```

Default API URL: `http://localhost:3333`

## Script matrix

- `npm run dev` — API with HMR
- `npm run queue:work` — `@adonisjs/queue` worker (`node ace queue:work`)
- `npm run build` — production build (`node ace build`)
- `npm start` — run built app (`node bin/server.js` after `build`)
- `npm run lint` — ESLint
- `npm run format` — Prettier
- `npm run typecheck` — TypeScript (`tsc --noEmit`)
- `npm run test` — Japa test suite

## Google Classroom connector

See [docs/google-classroom-setup.md](docs/google-classroom-setup.md) for GCP OAuth setup and pilot checklist.

Teacher endpoints (require `GOOGLE_*` env vars):

- `POST /api/v1/integrations/google-classroom/connect` — start OAuth
- `GET /api/v1/integrations/google-classroom/callback` — OAuth callback (no auth)
- `GET /api/v1/integrations/google-classroom/status` — connection status
- `DELETE /api/v1/integrations/google-classroom/disconnect`
- `GET /api/v1/integrations/google-classroom/courses`
- `GET /api/v1/integrations/google-classroom/courses/:courseId/coursework`
- `POST /api/v1/tasks/from-classroom` — import rewarded GC assignment
- `POST /api/v1/tasks/:id/sync-classroom` — enqueue Classroom sync (202 + `runId`; rewards run in a worker)
- `POST /api/v1/integrations/google-classroom/sync-all` — enqueue sync for every active Classroom task (202 + `runs`)
- `GET /api/v1/classroom-sync-runs/:runId` — poll sync job status/result

### Classroom sync worker (`@adonisjs/queue`)

Sync no longer blocks the HTTP request. Grades/rewards run via `SyncClassroomTaskJob` on `@adonisjs/queue` (Database adapter by default):

1. Start the API: `npm run dev` (or `npm start`) — also upserts the nightly `nightly-classroom-sync` schedule (02:00 America/Mexico_City)
2. Start the worker in a second terminal: `npm run queue:work` (`node ace queue:work --queue=classroom`) — processes per-task jobs **and** due cron schedules

| `QUEUE_DRIVER` | Behavior |
|----------------|----------|
| `database` (default outside tests) | Enqueue to DB queue tables; requires `npm run queue:work` |
| `sync` (default in tests) | Process the job inline in the API process (no worker) |


| Area | Prefix | Roles (high level) |
|------|--------|-------------------|
| Auth | `/auth` | signup, login, logout |
| Institutions | `/institutions` | super admin: list/create/status/bootstrap; school admin: users, roles, teacher–student links |
| Tasks | `/tasks` | teacher CRUD/summary; student available tasks |
| Submissions | `/submissions` | student submit; teacher/admin queues and actions |
| Rewards | `/rewards` | student balance; school admin post/history |
| Account | `/account/profile` | all authenticated roles |

Bearer token auth (`Authorization: Bearer …`) after `POST /auth/login`.

## Production notes

- **PostgreSQL SSL:** when `NODE_ENV=production`, the `pg` client enables SSL (`rejectUnauthorized: false`) for managed hosts (e.g. Railway, Render).
- **CORS:** in production, only origins listed in `CORS_ORIGIN` are allowed (default fallback: `https://scholarfi.netlify.app`). In development, all origins are allowed.

## Demo operations (Epic 6)

Deterministic demo data for sales/demos:

```bash
# Seed only when DB is empty
node ace demo:seed

# Reset to deterministic baseline every time
node ace demo:reset
```

Baseline (no Classroom tasks yet — teacher imports them and chooses reward credits):

- `1` active institution (`SFA-DEMO`)
- `1` school admin, `1` teacher, `2` students (with associations + groups)
- `3` internal marketplace rewards (entrada al cine 500, beca de transporte ONG, kit de útiles)
- Tasks/rewards: teacher uses **Usar Classroom de demo** (or real Google OAuth) → imports coursework with chosen reward → sync students → sync tasks
- When `TOKEN_MODE=solana`, `SFA-DEMO` is seeded with `cryptoWalletsEnabled: true` so diploma/SAS UIs are not blocked

**Demo Classroom flow** (`GOOGLE_CLASSROOM_MOCK=true`, no Google account):

1. Sign in at `/login` with a demo role chip (or `demo.teacher@scholarfi.test` / `DemoPass123!`)
2. `/teacher/integraciones` → **Usar Classroom de demo** (skips Google OAuth)
3. Import **Matematicas 3A** (both items) and set **reward credits** + min grade
4. Optional: **Sincronizar estudiantes** (links the fixture roster)
5. **Sincronizar** / **Sincronizar todo** to issue rewards from mock grades (runs inline; no queue worker)

External evaluators (no Google account): see [scholarfi/docs/judge-instructions.md](../scholarfi/docs/judge-instructions.md) (English and Spanish).

Matematicas 3A has **2** coursework items. `sofia.hernandez@scholarfi.test` and `valentina.rojas@school.edu` have grade `8` (≥ default min grade) so they earn on sync.

**Sync students:** provisions roster emails from `fixtures/demo_students.ts` (updates display names, links existing accounts).

After seed/reset, confirm:

1. Run `node ace demo:reset`
2. Confirm deterministic users exist:
  - `demo.super@scholarfi.test` (platform super admin — `/super` for institutions)
  - `demo.admin@scholarfi.test`
  - `demo.teacher@scholarfi.test`
  - `sofia.hernandez@scholarfi.test` — Sofia Hernandez
  - `valentina.rojas@school.edu` — Valentina Rojas
3. Confirm deterministic institution code exists: `SFA-DEMO`.
4. Run the Classroom flow above (no tasks are pre-imported).
## Solana leaderboard + SAS attestation (Devnet POC)

Requires `SOLANA_RPC_URL` and mint/oracle secrets. Attestation code imports `sas-lib` from `node_modules` via `app/services/attestation/sas_sdk.ts`.

```bash
# Leaderboard PDAs (SchoolBoard + StudentScore)
node ace school-score:devnet --points=10

# One-time SAS Credential + achievement + milestone schemas (pin PDAs into .env)
node ace sas:setup

# Manual per-submission attestation smoke (optional; not used on reward path)
node ace sas:attest --institution-id=1 --submission-id=900101 --points=10 --record-score

# Off-sync milestone attestations (MVP: 2 primeras actividades)
node ace sas:attest-milestones
# node ace sas:attest-milestones --institution-id=1
# node ace sas:attest-milestones --student=42
```

With on-chain institutions, `issueRewardForSubmission` best-effort calls `record_score` after a confirmed mint (SchoolBoard + StudentScore). SAS milestone attestations are **not** issued on the sync/reward path — run `sas:attest-milestones` periodically (or after demos).

## Compressed NFT diplomas (outstanding student)

Mints a Metaplex Bubblegum **cNFT** to the current ranking #1 student's custodial wallet. Backend signs with `MINT_AUTHORITY_SECRET` (no browser wallet).

1. `SOLANA_RPC_URL` must be **DAS-capable** (Helius or similar). `https://api.devnet.solana.com` does not support DAS.
2. Fund the mint-authority wallet with extra SOL for tree rent.
3. Create the merkle tree once and pin the address:

```bash
node ace cnft:setup-tree
# then set CNFT_MERKLE_TREE=<printed address> in .env
```

4. Institution must have `cryptoWalletsEnabled` and `TOKEN_MODE=solana`.
5. School admin: `GET /api/v1/diplomas/preview-best` then `POST /api/v1/diplomas/mint-best`.
6. Student: `GET /api/v1/diplomas/me`. Metadata: `GET /api/v1/public/diplomas/:id.json`.

### Demo seed users


| Role         | Name              | Email                            | Password         | Institution             |
| ------------ | ----------------- | -------------------------------- | ---------------- | ----------------------- |
| Super Admin  | Demo Super Admin  | `demo.super@scholarfi.test`      | `DemoPass123!`   | — (platform; no tenant) |
| School Admin | Demo School Admin | `demo.admin@scholarfi.test`      | `DemoPass123!`   | `SFA-DEMO`              |
| Teacher      | Demo Teacher      | `demo.teacher@scholarfi.test`    | `DemoPass123!`   | `SFA-DEMO`              |
| Student      | Sofia Hernandez   | `sofia.hernandez@scholarfi.test` | `DemoPass123!`   | `SFA-DEMO`              |
| Student      | Valentina Rojas   | `valentina.rojas@school.edu`     | `DemoPass123!`   | `SFA-DEMO`              |

Classroom mock pilot roster CSV: `fixtures/demo_classroom_roster.csv` (see `docs/google-classroom-setup.md` pilot checklist).



## Frontend pairing

Run the **scholarfi** frontend at `http://localhost:5173` with Vite proxying `/api` → `http://localhost:3333`, or set the frontend `VITE_API_URL` to `http://localhost:3333/api/v1`.
