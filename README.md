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
- `POST /api/v1/tasks/:id/sync-classroom` — sync grades and distribute rewards (FIFO until budget = 0)


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

Baseline (no manual tasks — Classroom is the task/reward path):

- `1` active institution (`SFA-DEMO`)
- `1` school admin, `1` teacher, `5` students (with associations + groups)
- Tasks/submissions/rewards come from mock Google Classroom after connect → import → sync

**First-5 milestone demo:** with `GOOGLE_CLASSROOM_MOCK=true`, Matematicas 3A has **5** coursework items. `demo.student1@scholarfi.test` and `student-alpha@school.edu` have grade `8` (≥ default min grade). Import all + sync all rewards those students on all 5 tasks.

After seed/reset, confirm:

1. Run `node ace demo:reset`
2. Confirm deterministic users exist:
  - `demo.super@scholarfi.test` (platform super admin — `/super` for institutions)
  - `demo.admin@scholarfi.test`
  - `demo.teacher@scholarfi.test`
  - `demo.student1@scholarfi.test`
  - `demo.student2@scholarfi.test`
  - `student-alpha@school.edu`
  - `student-beta@school.edu`
  - `student-gamma@school.edu`
3. Confirm deterministic institution code exists: `SFA-DEMO`.

## Solana leaderboard + SAS attestation (Devnet POC)

Requires `SOLANA_RPC_URL` and mint/oracle secrets. If `npm install sas-lib` fails (root-owned `node_modules`), keep `vendor-sas/` (local `npm install sas-lib` there) — the app loads it via `app/services/attestation/sas_sdk.ts`.

```bash
# Leaderboard PDAs (SchoolBoard + StudentScore)
node ace school-score:devnet --points=10

# One-time SAS Credential + achievement + milestone schemas (pin PDAs into .env)
node ace sas:setup

# Manual per-submission attestation smoke (optional; not used on reward path)
node ace sas:attest --institution-id=1 --submission-id=900101 --points=10 --record-score

# Off-sync milestone attestations (MVP: 5 primeras actividades)
node ace sas:attest-milestones
# node ace sas:attest-milestones --institution-id=1
# node ace sas:attest-milestones --student=42
```

With on-chain institutions, `issueRewardForSubmission` best-effort calls `record_score` after a confirmed mint (SchoolBoard + StudentScore). SAS milestone attestations are **not** issued on the sync/reward path — run `sas:attest-milestones` periodically (or after demos).

### Demo seed users


| Role         | Email                          | Password       | Institution             |
| ------------ | ------------------------------ | -------------- | ----------------------- |
| Super Admin  | `demo.super@scholarfi.test`    | `DemoPass123!` | — (platform; no tenant) |
| School Admin | `demo.admin@scholarfi.test`    | `DemoPass123!` | `SFA-DEMO`              |
| Teacher      | `demo.teacher@scholarfi.test`  | `DemoPass123!` | `SFA-DEMO`              |
| Student      | `demo.student1@scholarfi.test` | `DemoPass123!` | `SFA-DEMO`              |
| Student      | `demo.student2@scholarfi.test` | `DemoPass123!` | `SFA-DEMO`              |
| Student      | `student-alpha@school.edu`     | `DemoPass123!` | `SFA-DEMO`              |
| Student      | `student-beta@school.edu`      | `DemoPass123!` | `SFA-DEMO`              |
| Student      | `student-gamma@school.edu`     | `DemoPass123!` | `SFA-DEMO`              |

Classroom mock pilot roster CSV: `fixtures/demo_classroom_roster.csv` (see `docs/google-classroom-setup.md` pilot checklist).



## Frontend pairing

Run the **scholarfi** frontend at `http://localhost:5173` with Vite proxying `/api` → `http://localhost:3333`, or set the frontend `VITE_API_URL` to `http://localhost:3333/api/v1`.
