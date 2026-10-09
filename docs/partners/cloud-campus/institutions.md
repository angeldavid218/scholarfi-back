# Institutions (schools)

In ScholarFi, a school is an **institution**. Cloud Campus uses `super_admin` credentials for institution lifecycle operations.

## List institutions

```http
GET /api/v1/institutions
Authorization: Bearer <super_admin_token>
```

**Role:** `super_admin`

**Response (200)**

```json
{
  "data": [
    {
      "id": 12,
      "name": "Cloud Campus Pilot School",
      "code": "CC-PILOT-001",
      "status": "active",
      "cryptoWalletsEnabled": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

## Create institution

```http
POST /api/v1/institutions
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "name": "Cloud Campus Pilot School",
  "code": "CC-PILOT-001"
}
```

**Role:** `super_admin`

| Field | Type   | Rules              |
| ----- | ------ | ------------------ |
| name  | string | 2–180 chars        |
| code  | string | 2–50 chars, unique |

**Response (200):** institution object with `status: "draft"`.

**Errors**

| Status | Code                     | When                |
| ------ | ------------------------ | ------------------- |
| 409    | `INSTITUTION_CODE_TAKEN` | Code already exists |

## Update status

```http
PATCH /api/v1/institutions/:id/status
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{ "status": "active" }
```

**Role:** `super_admin`

Allowed values: `active`, `inactive`.

Provisioning users requires `active` status.

## Bootstrap school admin

```http
POST /api/v1/institutions/:id/bootstrap-school-admin
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "fullName": "Pilot Admin",
  "email": "admin@pilot-school.edu",
  "password": "AdminPass123!"
}
```

**Role:** `super_admin`

Creates a user with the `school_admin` role scoped to the institution.

**Errors**

| Status | Code                    | When                     |
| ------ | ----------------------- | ------------------------ |
| 404    | `INSTITUTION_NOT_FOUND` | Invalid institution id   |
| 409    | `EMAIL_TAKEN`           | Email already registered |
