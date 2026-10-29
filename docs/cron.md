# Cron Job Configuration for Render

This document explains how to configure Render Cron Jobs to replace the persistent queue worker for classroom sync, SAS attestations, and cNFT diploma minting.

## Overview

The application now uses **Render Cron Jobs** instead of a persistent `queue:work` worker process. Each cron job runs an AdonisJS `ace` command that:

1. Acquires a **global Postgres advisory lock** to prevent overlapping runs
2. Processes a **bounded batch** of records
3. **Exits cleanly** (exit 0) when another run is already active
4. Uses **row-level claim logic** (`UPDATE ... WHERE status IN (...) RETURNING`) to prevent double-processing
5. Tracks **attempt counts** and respects retry limits
6. Paces blockchain transactions with configurable delays

## Required Cron Jobs

Add these three cron services to your Render Blueprint or create them manually in the Render dashboard:

### 1. Classroom Sync (Daily at 08:00 UTC)

```yaml
- type: cron
  name: scholarfi-classroom-sync
  env: docker
  schedule: '0 8 * * *'
  dockerfilePath: ./Dockerfile
  dockerCommand: node ace classroom:sync-all
  envVars:
    - key: NODE_ENV
      value: production
    - key: APP_KEY
      sync: false
    - key: DB_CONNECTION
      value: pg
    - key: DB_HOST
      fromDatabase:
        name: scholarfi-db
        property: host
    - key: DB_PORT
      fromDatabase:
        name: scholarfi-db
        property: port
    - key: DB_USER
      fromDatabase:
        name: scholarfi-db
        property: user
    - key: DB_PASSWORD
      fromDatabase:
        name: scholarfi-db
        property: password
    - key: DB_DATABASE
      fromDatabase:
        name: scholarfi-db
        property: database
```

**Command**: `node ace classroom:sync-all`

**What it does**: Syncs every connected Google Classroom teacher inside this command and then exits. It does not use the queue worker. The teacher button **Sincronizar todo** is a separate path: it runs the same sync inside the API web service.

**Options**:

- `--request-id=<uuid>`: Optional tracing ID

### 2. SAS Attestation Sweep (Every 6 hours)

```yaml
- type: cron
  name: scholarfi-sas-sweep
  env: docker
  schedule: '0 */6 * * *'
  dockerfilePath: ./Dockerfile
  dockerCommand: node ace sas:attest-sweep --limit=20
  envVars:
    - key: NODE_ENV
      value: production
    - key: APP_KEY
      sync: false
    - key: DB_CONNECTION
      value: pg
    - key: DB_HOST
      fromDatabase:
        name: scholarfi-db
        property: host
    - key: DB_PORT
      fromDatabase:
        name: scholarfi-db
        property: port
    - key: DB_USER
      fromDatabase:
        name: scholarfi-db
        property: user
    - key: DB_PASSWORD
      fromDatabase:
        name: scholarfi-db
        property: password
    - key: DB_DATABASE
      fromDatabase:
        name: scholarfi-db
        property: database
    - key: SAS_ENABLED
      value: 'true'
    - key: SAS_ATTEST_DELAY_MS
      value: '1500'
    - key: SOLANA_RPC_URL
      sync: false
    - key: SAS_AUTHORITY_PRIVATE_KEY
      sync: false
    - key: SAS_AUTHORIZED_SIGNER_PRIVATE_KEY
      sync: false
```

**Command**: `node ace sas:attest-sweep`

**What it does**: Finds eligible milestone attestations (pending + failed with attempts < 3), claims them one-by-one, sends on-chain transactions, and paces them with a delay.

**Options**:

- `--limit=<n>`: Max attestations per run (default: 20)
- `--max-attempts=<n>`: Max retry attempts (default: 3)
- `--delay-ms=<ms>`: Delay between transactions (default: from `SAS_ATTEST_DELAY_MS` env, or 1500ms)
- `--institution-id=<id>`: Limit to one institution
- `--no-recover-stale`: Skip stale-processing recovery

**Environment variables**:

- `SAS_ATTEST_DELAY_MS`: Default delay between attestations (milliseconds)

### 3. cNFT Diploma Mint Sweep (Daily at 09:00 UTC)

```yaml
- type: cron
  name: scholarfi-cnft-sweep
  env: docker
  schedule: '0 9 * * *'
  dockerfilePath: ./Dockerfile
  dockerCommand: node ace cnft:mint-sweep --limit=5
  envVars:
    - key: NODE_ENV
      value: production
    - key: APP_KEY
      sync: false
    - key: DB_CONNECTION
      value: pg
    - key: DB_HOST
      fromDatabase:
        name: scholarfi-db
        property: host
    - key: DB_PORT
      fromDatabase:
        name: scholarfi-db
        property: port
    - key: DB_USER
      fromDatabase:
        name: scholarfi-db
        property: user
    - key: DB_PASSWORD
      fromDatabase:
        name: scholarfi-db
        property: password
    - key: DB_DATABASE
      fromDatabase:
        name: scholarfi-db
        property: database
    - key: CNFT_MERKLE_TREE
      sync: false
    - key: CNFT_MINT_DELAY_MS
      value: '2000'
    - key: SOLANA_RPC_URL
      sync: false
    - key: HELIUS_API_KEY
      sync: false
```

**Command**: `node ace cnft:mint-sweep`

**What it does**: Finds outstanding diploma mints (pending + failed with attempts < 3), claims them, mints the cNFT on-chain, and paces mints with a delay.

**Options**:

- `--limit=<n>`: Max mints per run (default: 5)
- `--max-attempts=<n>`: Max retry attempts (default: 3)
- `--delay-ms=<ms>`: Delay between mints (default: from `CNFT_MINT_DELAY_MS` env, or 2000ms)
- `--institution-id=<id>`: Limit to one institution
- `--no-recover-stale`: Skip stale-processing recovery

**Environment variables**:

- `CNFT_MINT_DELAY_MS`: Default delay between mints (milliseconds)

## Locking and Concurrency

### Global Locks

Each command uses a **Postgres advisory lock** to prevent overlapping runs:

- `classroom:sync-all` → lock name: `classroom:sync-all`
- `sas:attest-sweep` → lock name: `sas:attest-sweep`
- `cnft:mint-sweep` → lock name: `cnft:mint-sweep`

When a lock is already held, the command logs "already running" and exits with code 0 (success) so Render doesn't mark the cron job as failed.

**IMPORTANT**: Advisory locks require a **direct database connection** (not PgBouncer in transaction mode). The lock implementation uses session-level advisory locks (`pg_try_advisory_lock`) with a dedicated connection held for the entire run duration. If using PgBouncer, configure it in session mode or provide a direct database URL for cron jobs.

### Row-Level Claims

Before sending any blockchain transaction, the command uses an **atomic UPDATE ... WHERE status IN (eligible) RETURNING** to claim the record:

```sql
UPDATE student_achievement_attestations
SET status = 'processing', attempts = attempts + 1, last_attempt_at = NOW()
WHERE id = ?
  AND status IN ('pending', 'failed')
RETURNING *
```

This ensures **no two processes** can send the same transaction, even if locks fail or multiple cron containers start simultaneously.

### Stale-Processing Recovery

Commands automatically detect records stuck in `processing` status for >30 minutes and:

1. Check if the on-chain PDA/asset exists
2. If yes, mark the DB row `attested`/`confirmed`
3. If no, mark it `failed` for retry

## HTTP Endpoints

The existing HTTP endpoints (`POST /attestations/milestones/run`, `POST /diplomas/mint-best`) **remain unchanged** and now use the same claim logic internally:

- Set status to `processing` + increment attempts before sending the transaction
- No duplicate sends even if the endpoint is called concurrently

## Coexistence with Queue Worker

Classroom sync does not use `queue:work`. Attestations and diploma mints use the cron commands in this document.

**What changes on Render**:

- **Sincronizar todo** runs in the web service. The nightly Classroom sweep, SAS attestations, and cNFT mints are Render cron commands
- The queue worker can still run for other features if needed
- Classroom sync no longer registers a database schedule from `start/scheduler.ts`. The nightly sweep is only `node ace classroom:sync-all`.

**Recommendation**: Do not run `queue:work` for Classroom sync. The button runs in the web service, and the schedule runs as this cron command.

## Testing Locally

Run the commands manually to verify:

```bash
# Classroom sync
node ace classroom:sync-all

# SAS attestations
node ace sas:attest-sweep --limit=5

# cNFT mints
node ace cnft:mint-sweep --limit=2
```

Run them in parallel to test lock behavior:

```bash
node ace sas:attest-sweep &
node ace sas:attest-sweep &
wait
# Second command should log "already running" and exit 0
```

## Follow-Up Work

1. **Leaderboard record_score decoupling**: Currently, the reward transaction includes a leaderboard score update. Move this out of the critical transaction path so blockchain failures don't block score recording.

2. **Remove or gate queue scheduler**: Decide whether to remove `start/scheduler.ts` from production or add an env flag.

3. **Monitoring**: Add alerting for failed cron runs (Render provides logs and status per cron job).

## Migration

The migration `1780000000000_add_attestation_retry_fields.ts` adds:

- `attempts` (integer, default 0)
- `last_attempt_at` (timestamp, nullable)

to both `student_achievement_attestations` and `student_diploma_mints` tables.

Run migrations before deploying:

```bash
node ace migration:run --force
```
