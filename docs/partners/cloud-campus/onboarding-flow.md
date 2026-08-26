# Onboarding flow

Recommended sequence when Cloud Campus onboards a new school into ScholarFi.

## Sequence

1. **Login** as the Cloud Campus `super_admin` service account  
   `POST /api/v1/auth/login`

2. **Create institution** (school)  
   `POST /api/v1/institutions` with `{ "name", "code" }`  
   New institutions start in `draft` status.

3. **Activate institution**  
   `PATCH /api/v1/institutions/:id/status` with `{ "status": "active" }`

4. **Enable custodial wallets** (optional but recommended for rewards)  
   `PATCH /api/v1/institutions/:id/crypto-wallets` with `{ "enabled": true }`  
   Backfills wallets for existing students in that school.

5. **Bootstrap school admin**  
   `POST /api/v1/institutions/:id/bootstrap-school-admin`  
   Creates the first `school_admin` user for the institution.

6. **Login as school admin**  
   `POST /api/v1/auth/login` with the bootstrapped admin credentials.

7. **Provision users**  
   `POST /api/v1/institutions/users` for teachers and students.

8. **Optional roster setup**  
   Create subjects/groups and sync membership — see [Groups and roster](groups-and-roster).

## Example curl (steps 1–5)

```bash
BASE=http://localhost:3333/api/v1
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"cloud-campus-integration@example.com","password":"Secret123!"}' \
  | jq -r '.data.token')

INST=$(curl -s -X POST "$BASE/institutions" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Cloud Campus Pilot School","code":"CC-PILOT-001"}' \
  | jq -r '.data.id')

curl -X PATCH "$BASE/institutions/$INST/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"active"}'

curl -X PATCH "$BASE/institutions/$INST/crypto-wallets" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true}'

curl -X POST "$BASE/institutions/$INST/bootstrap-school-admin" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Pilot Admin","email":"admin@pilot-school.edu","password":"AdminPass123!"}'
```

## Idempotency notes

- Institution `code` must be globally unique.
- User `email` must be globally unique across ScholarFi.
- Re-running bootstrap with the same email returns `409 EMAIL_TAKEN`.
