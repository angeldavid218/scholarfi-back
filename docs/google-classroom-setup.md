# Google Classroom connector — GCP setup

One-time configuration in Google Cloud Console for ScholarFi's read-only Classroom integration.

## 1. Create or select a GCP project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (e.g. `scholarfi-classroom`) or select an existing one.

## 2. Enable the Classroom API

**APIs & Services → Library** → search **Google Classroom API** → **Enable**.

## 3. OAuth consent screen (Internal)

For a single Google Workspace for Education domain:

1. **APIs & Services → OAuth consent screen**
2. User type: **Internal**
3. Fill app name, support email, developer contact
4. Add scopes:

- `https://www.googleapis.com/auth/classroom.courses.readonly`
- `https://www.googleapis.com/auth/classroom.rosters.readonly`
- `https://www.googleapis.com/auth/classroom.coursework.students.readonly`
- `https://www.googleapis.com/auth/classroom.profile.emails`
- `https://www.googleapis.com/auth/userinfo.email`

## 4. OAuth client (Web application)

**APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**

| Field                         | Development                                                           | Production                                                         |
| ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Authorized JavaScript origins | `http://localhost:5173`                                               | Your frontend URL                                                  |
| Authorized redirect URIs      | `http://localhost:3333/api/v1/integrations/google-classroom/callback` | `https://<api-host>/api/v1/integrations/google-classroom/callback` |

Copy the **Client ID** and **Client secret** into `scholarfi-back/.env`.

## 5. ScholarFi backend `.env`

```env
GOOGLE_CLIENT_ID=<from GCP>
GOOGLE_CLIENT_SECRET=<from GCP>
GOOGLE_REDIRECT_URI=http://localhost:3333/api/v1/integrations/google-classroom/callback
GOOGLE_OAUTH_SCOPES=https://www.googleapis.com/auth/classroom.courses.readonly,https://www.googleapis.com/auth/classroom.rosters.readonly,https://www.googleapis.com/auth/classroom.coursework.students.readonly,https://www.googleapis.com/auth/classroom.profile.emails,https://www.googleapis.com/auth/userinfo.email
INTEGRATION_TOKEN_ENCRYPTION_KEY=<32+ char secret>
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
# Optional: password assigned when Sync students provisions Classroom roster accounts
# CLASSROOM_STUDENT_DEFAULT_PASSWORD=scholarfi-pass
# Local/dev / judge sandbox without a Google account:
# GOOGLE_CLASSROOM_MOCK=true
# Requires INTEGRATION_TOKEN_ENCRYPTION_KEY only (no GOOGLE_CLIENT_*).
# Teacher: POST /connect upserts a fixture integration. Login exposes GET /api/v1/public/demo-config.
```

Generate encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

Evaluator walkthrough (English and Spanish): [scholarfi/docs/judge-instructions.md](../../scholarfi/docs/judge-instructions.md).

## 6. Classroom sync worker (`@adonisjs/queue`)

`POST /tasks/:id/sync-classroom` dispatches `SyncClassroomTaskJob` and returns `202` with a `runId`. The teacher UI polls `GET /classroom-sync-runs/:runId`.

`POST /integrations/google-classroom/sync-all` enqueues the same per-task job for **every active Google Classroom task** owned by the teacher (not only the current UI page) and returns `202` with `{ tasks, runs: [{ runId, taskId, status, deduped }] }`. **Sincronizar todo** on `/teacher` uses this endpoint.

A nightly orchestrator (`SyncAllClassroomTasksJob`) runs the same bulk enqueue for every teacher with a connected Classroom integration. It is registered on API boot in `start/scheduler.ts`:

```ts
await SyncAllClassroomTasksJob.schedule({})
  .id('nightly-classroom-sync')
  .cron('0 2 * * *')
  .timezone('America/Mexico_City')
  .run()
```

Override with `CLASSROOM_NIGHTLY_SYNC_CRON` / `CLASSROOM_NIGHTLY_SYNC_TIMEZONE` if needed. Default is 02:00 America/Mexico_City so grade sync stays off daytime CPU.

When `QUEUE_DRIVER=database` (default outside tests), run the official Adonis worker alongside the API:

```bash
npm run queue:work
# equivalent: node ace queue:work --queue=classroom
```

You should see `Starting worker for queues: classroom`. If it says `default` only, Classroom jobs will sit queued forever.

## 6b. Sync students (auto-registration)

`POST /integrations/google-classroom/sync-students` (teacher, Classroom connected) lists every course the teacher can access, upserts ScholarFi groups, and for each roster email:

- **New email** → creates an **active** student with `CLASSROOM_STUDENT_DEFAULT_PASSWORD` (default `scholarfi-pass`), no matrícula
- **Pending student** → activates with that default password and links to the class
- **Active student** → links to the class only (password unchanged)

Students then log in with email + default password and change it from the header user menu (`PATCH /account/password`).

When `GOOGLE_CLASSROOM_MOCK=true`, roster emails come from fixtures in `fixtures/demo_students.ts`:

| Name | Email | Seeded by |
|------|-------|-----------|
| Sofia Hernandez | `sofia.hernandez@scholarfi.test` | `demo:reset` |
| Valentina Rojas | `valentina.rojas@school.edu` | `demo:reset` |

## 7. Pilot checklist

Before testing end-to-end:

- [ ] Admin allocated teacher credit budget (`/admin/presupuesto-docentes`)
- [ ] Teacher connected Classroom (`/teacher/integraciones`) — mock mode: **Usar Classroom de demo** (no Google account)
- [ ] Teacher clicked **Sincronizar estudiantes** on `/teacher` (or students already exist with matching Classroom emails)
- [ ] Pilot GC course has assignments with numeric `maxPoints` and graded `assignedGrade` values
- [ ] `npm run queue:work` is running (unless `QUEUE_DRIVER=sync` **or** `GOOGLE_CLASSROOM_MOCK=true`, which syncs inline) — required for real Classroom per-task sync, **Sincronizar todo**, and the nightly cron
- [ ] Teacher imports coursework and clicks **Sincronizar** on the Classroom-linked task (or **Sincronizar todo** for every active Classroom task)

## Notes

- ScholarFi only **reads** grades from assignments created in the Classroom UI (no write scopes required).
- `classroom.profile.emails` is required so roster responses include student `emailAddress` (used to link Classroom `profile.id` to ScholarFi users). After adding it, teachers must **disconnect and reconnect** Classroom so Google re-consents.
- Rewards are issued in ScholarFi completion order (`submitted_at` ASC) until the teacher budget reaches zero.
- Minimum grade is an absolute score (`assignedGrade >= minGrade`).
