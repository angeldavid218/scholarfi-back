# Errors and limits

## Error envelope

All API errors follow this shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {},
    "requestId": "..."
  }
}
```

Include `requestId` when contacting ScholarFi support.

## Common codes

| Code                         | HTTP | Meaning                                 |
| ---------------------------- | ---- | --------------------------------------- |
| `UNAUTHORIZED`               | 401  | Missing or invalid Bearer token         |
| `FORBIDDEN_ROLE`             | 403  | Authenticated but wrong role            |
| `INSTITUTION_SCOPE_REQUIRED` | 403  | School admin not tied to an institution |
| `INSTITUTION_INACTIVE`       | 403  | School must be active                   |
| `INSTITUTION_NOT_FOUND`      | 404  | Invalid institution id                  |
| `EMAIL_TAKEN`                | 409  | Email already registered                |
| `INSTITUTION_CODE_TAKEN`     | 409  | Institution code already exists         |
| `VALIDATION_ERROR`           | 422  | Request body failed validation          |

## Pagination

List endpoints such as `GET /institutions/users` accept:

| Param   | Default | Max |
| ------- | ------- | --- |
| page    | 1       | —   |
| perPage | 10      | 100 |

## Rate limits

No hard rate limits are enforced in v1. Cloud Campus should:

- Serialize institution onboarding (avoid duplicate parallel creates for the same `code`)
- Retry 5xx responses with exponential backoff
- Cache Bearer tokens until `401`

## Idempotency

| Operation             | Idempotent? | Notes                                    |
| --------------------- | ----------- | ---------------------------------------- |
| Create institution    | No          | Unique `code` required                   |
| Provision user        | No          | Unique `email` required                  |
| Enable crypto wallets | Yes         | Re-enabling is safe; backfill runs again |
| Sync group members    | Yes         | Replaces membership set                  |

## Data constraints

- Emails are globally unique across ScholarFi.
- Institution codes are globally unique.
- Student registration numbers are unique within an institution.
- Passwords: 8–32 characters.
