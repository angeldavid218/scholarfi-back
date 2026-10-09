# Users

After bootstrapping a school admin, Cloud Campus provisions teachers and students at the institution scope.

## Provision user

```http
POST /api/v1/institutions/users
Authorization: Bearer <school_admin_token>
Content-Type: application/json

{
  "fullName": "Ana García",
  "email": "ana.garcia@pilot-school.edu",
  "password": "StudentPass123!",
  "role": "student"
}
```

**Role:** `school_admin` (must belong to the target institution)

| Field    | Type   | Rules                                |
| -------- | ------ | ------------------------------------ |
| fullName | string | 2–180 chars                          |
| email    | string | valid email, globally unique         |
| password | string | 8–32 chars                           |
| role     | enum   | `teacher`, `student`, `school_admin` |

**Response (200)**

```json
{
  "data": {
    "id": 44,
    "email": "ana.garcia@pilot-school.edu",
    "fullName": "Ana García",
    "institutionId": 12,
    "isActive": true,
    "role": "student",
    "walletPublicKey": "7xKX...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

`walletPublicKey` is included for students when the institution has crypto wallets enabled. It is `null` when wallets are disabled or for non-student roles.

## List institution users

```http
GET /api/v1/institutions/users?page=1&perPage=25&search=Ana
Authorization: Bearer <school_admin_token>
```

**Role:** `school_admin`

**Response (200)**

```json
{
  "data": {
    "items": [
      {
        "id": 44,
        "email": "ana.garcia@pilot-school.edu",
        "fullName": "Ana García",
        "roles": ["student"],
        "walletPublicKey": "7xKX..."
      }
    ],
    "meta": {
      "total": 1,
      "perPage": 25,
      "currentPage": 1,
      "lastPage": 1
    }
  }
}
```

`walletPublicKey` appears on student rows when crypto wallets are enabled for the institution.

## Assign role

```http
PATCH /api/v1/institutions/users/:userId/role
Authorization: Bearer <school_admin_token>
Content-Type: application/json

{ "role": "teacher" }
```

**Role:** `school_admin`

Promoting a user to `student` creates a wallet when crypto wallets are enabled.

## Link teacher and student

```http
POST /api/v1/institutions/teacher-students
Authorization: Bearer <school_admin_token>
Content-Type: application/json

{
  "teacherId": 30,
  "studentId": 44
}
```

**Role:** `school_admin`

## Student self-registration (claim flow)

Students provisioned without a password they chose can claim their account:

```http
POST /api/v1/auth/register-student
Content-Type: application/json

{
  "email": "ana.garcia@pilot-school.edu",
  "registrationNumber": "MAT-2026-001",
  "password": "StudentPass123!",
  "passwordConfirmation": "StudentPass123!"
}
```

**Auth:** public (no token)

## Errors

| Status | Code                         | When                       |
| ------ | ---------------------------- | -------------------------- |
| 403    | `INSTITUTION_SCOPE_REQUIRED` | Admin not tied to a school |
| 403    | `INSTITUTION_INACTIVE`       | School not active          |
| 409    | `EMAIL_TAKEN`                | Email already exists       |
