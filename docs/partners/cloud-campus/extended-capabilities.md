# Extended capabilities

Beyond school/user/wallet onboarding, Cloud Campus may integrate with these ScholarFi areas.

## Available today

| Capability | Endpoint | Role |
|------------|----------|------|
| Allocate institution credits | `POST /institutions/:id/credit-pool/allocate` | super_admin |
| View institution credit pool | `GET /institutions/:id/credit-pool` | super_admin |
| View own school credit pool | `GET /institutions/credit-pool` | school_admin |
| Student reward balance | `GET /students/:studentId/balance` | school_admin |
| Student transactions | `GET /students/:studentId/transactions` | school_admin |
| Student leaderboard | `GET /leaderboard/students` | student, teacher, school_admin |
| Token health | `GET /token/health` | school_admin, super_admin |

Credits fund the reward economy inside ScholarFi. Cloud Campus typically does not post rewards directly in v1; schools use ScholarFi teacher/admin flows for tasks and submissions.

## Student-facing flows (informational)

These endpoints serve the ScholarFi product UI. Cloud Campus may deep-link or embed later:

- `GET /tasks/available` — student task list
- `GET /rewards/balance` — student token balance
- `GET /rewards/history` — institution reward history (school_admin)
- `POST /auth/register-student` — student account claim

## Planned / out of scope for v1

| Item | Notes |
|------|-------|
| `POST /integrations/cloud-campus/sync-roster` | Bulk roster sync with `external_source: cloud_campus` |
| Partner API keys | v1 uses Bearer tokens from service account |
| Webhooks (reward posted, wallet created) | Not implemented |
| OpenAPI spec | Manual partner docs for now |
| Task/submission import from Cloud Campus | Requires product design |

## Natural next integrations

1. **Roster sync** — push Cloud Campus class rosters; ScholarFi upserts users/groups tagged `cloud_campus`.
2. **Credit funding** — super_admin allocates credits when a school joins Cloud Campus billing.
3. **Leaderboard embed** — read-only leaderboard API for Cloud Campus dashboards.
4. **Wallet notifications** — webhook when `walletPublicKey` is assigned to a student.

Contact ScholarFi to prioritize these items.
