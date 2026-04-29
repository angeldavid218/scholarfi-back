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

