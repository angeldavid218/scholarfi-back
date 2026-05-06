# ScholarFi Backend (`scholarfi-back`)

AdonisJS + TypeScript API for the ScholarFi demo simulator.

## Prerequisites

- Node.js 22+ (or current active LTS)
- npm 11+
- PostgreSQL 15+ (for `DB_CONNECTION=pg`)

## First-Run Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment template:

```bash
cp .env.example .env
```

3. Set required values in `.env`:

- `APP_KEY` (generate using `node ace generate:key`)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`

4. Run migrations:

```bash
node ace migration:run
```

5. Start the API:

```bash
npm run dev
```

Default API URL: `http://localhost:3333`

## Script Matrix

- `npm run dev` - Start API in HMR mode for local development
- `npm run build` - Build production bundle
- `npm run lint` - Lint codebase with ESLint
- `npm run typecheck` - Run TypeScript checks without emitting files
- `npm run test` - Run backend test suite (Japa)

## Demo Operations (Epic 6)

Use deterministic demo commands for sales/demo readiness.

```bash
# Seed only when DB is empty
node ace demo:seed

# Reset to deterministic baseline every time
node ace demo:reset
```

Default deterministic dataset:

- `1` active institution (`SFA-DEMO`)
- `1` school admin, `1` teacher, `2` students
- teacher/student associations for both students
- rich task + submission mix by default: **8** teacher tasks (7 active, 1 closed), **4** submissions in the teacher validation queue (`pending`), **2** in the school-admin queue (`validated` after teacher sign-off), plus **2** open tasks with no submission yet; includes the original approved submission + posted reward + balance for student 1 (skip all tasks/submissions with `node ace demo:reset --starter` / `node ace demo:seed --starter`)

Reset documentation:

1. Run `node ace demo:reset`
2. Confirm deterministic users exist:
   - `demo.super@scholarfi.test` (platform super admin — `/super` for institutions)
   - `demo.admin@scholarfi.test`
   - `demo.teacher@scholarfi.test`
   - `demo.student1@scholarfi.test`
   - `demo.student2@scholarfi.test`
3. Confirm deterministic institution code exists: `SFA-DEMO`.

### Demo Seed Users (quick login reference)

After `node ace demo:seed` or `node ace demo:reset`, use these credentials:

| Role | Email | Password | Institution |
|---|---|---|---|
| Super Admin | `demo.super@scholarfi.test` | `DemoPass123!` | — (platform; no tenant) |
| School Admin | `demo.admin@scholarfi.test` | `DemoPass123!` | `SFA-DEMO` |
| Teacher | `demo.teacher@scholarfi.test` | `DemoPass123!` | `SFA-DEMO` |
| Student | `demo.student1@scholarfi.test` | `DemoPass123!` | `SFA-DEMO` |
| Student | `demo.student2@scholarfi.test` | `DemoPass123!` | `SFA-DEMO` |

