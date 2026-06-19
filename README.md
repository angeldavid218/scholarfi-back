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

2. Copy the environment template:

```bash
cp .env.example .env
```

3. Set required values in `.env`:

- `APP_KEY` — generate with `node ace generate:key`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` (see CI in `.github/workflows/ci.yml` for a local example)
- `CORS_ORIGIN` — comma-separated frontend origins for **production** (dev allows all origins). Example:

  `CORS_ORIGIN=http://localhost:5173,https://scholarfi.netlify.app`

4. Run migrations:

```bash
node ace migration:run
```

5. Start the API:

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

## API overview (`/api/v1`)

| Area | Prefix | Roles (high level) |
|------|--------|-------------------|
| Auth | `/auth` | signup, login, logout |
| Institutions | `/institutions` | super admin: list/create/status/bootstrap; school admin: users, roles, teacher–student links, funding balance |
| Funding programs | `/funding-programs` | NGO admin: programs and school budget allocations |
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

# Institution + users only (no tasks/submissions/rewards)
node ace demo:reset --starter
node ace demo:seed --starter
```

Default rich dataset (without `--starter`):

- `1` active institution (`SFA-DEMO`)
- `1` NGO (`NGO-DEMO` — ScholarFi Demo Foundation) with NGO admin user
- `1` active funding program (`Demo Scholarship Program 2026`) with **50,000** credits fully allocated and **released** to `SFA-DEMO` (school can approve rewards immediately)
- `1` school admin, `1` teacher, `2` students (with associations)
- **8** teacher tasks (7 active, 1 closed), **4** submissions in teacher queue (`pending`), **2** in school-admin queue (`validated`), **2** open tasks without submission; includes approved submission + posted reward + balance for student 1 (50 credits already debited from school funding)

After seed/reset, confirm:

1. Institution code `SFA-DEMO`
2. NGO code `NGO-DEMO`
3. Users below (password `DemoPass123!`)

### Demo seed users

| Role | Email | Password | Scope |
|------|-------|----------|-------|
| Super Admin | `demo.super@scholarfi.test` | `DemoPass123!` | Platform (`/super` in frontend) |
| NGO Admin | `demo.ngo@scholarfi.test` | `DemoPass123!` | `NGO-DEMO` (`/ngo` in frontend) |
| School Admin | `demo.admin@scholarfi.test` | `DemoPass123!` | `SFA-DEMO` (`/admin` in frontend) |
| Teacher | `demo.teacher@scholarfi.test` | `DemoPass123!` | `SFA-DEMO` |
| Student | `demo.student1@scholarfi.test` | `DemoPass123!` | `SFA-DEMO` |
| Student | `demo.student2@scholarfi.test` | `DemoPass123!` | `SFA-DEMO` |

### Demo funding snapshot

After `node ace demo:reset`, the school admin dashboard should show roughly **49,950** credits disponible (50,000 allocated minus 50 already used by the starter approved submission). The NGO dashboard shows the same program with utilization under budget distribution.

## Frontend pairing

Run the **scholarfi** frontend at `http://localhost:5173` with Vite proxying `/api` → `http://localhost:3333`, or set the frontend `VITE_API_URL` to `http://localhost:3333/api/v1`.
