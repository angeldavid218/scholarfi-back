# Authentication

ScholarFi API authentication uses **Bearer access tokens** issued after email/password login.

## Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "cloud-campus-integration@your-domain.com",
  "password": "<service-account-password>"
}
```

**Success (200)**

```json
{
  "data": {
    "token": "oat_....",
    "type": "bearer",
    "user": {
      "id": 1,
      "email": "cloud-campus-integration@your-domain.com",
      "fullName": "Cloud Campus Integration"
    }
  }
}
```

## Authenticated requests

Send the token on every request:

```http
Authorization: Bearer oat_....
```

## Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer oat_....
```

Revokes the current access token.

## Service account bootstrap (ScholarFi ops)

ScholarFi creates the Cloud Campus integration account once per environment:

```bash
node ace partner:bootstrap-cloud-campus \
  --email=cloud-campus-integration@your-domain.com \
  --password='StrongPassw0rd!'
```

If `--password` is omitted, a random password is generated and printed once.

The command assigns the **super_admin** role. Store credentials in your secret manager; ScholarFi does not retain the generated password.

## Token lifetime

Access tokens remain valid until revoked via logout or manual revocation. Implement token refresh by calling `POST /auth/login` again when requests return `401`.

## Error envelope

Failed requests return:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "requestId": "..."
  }
}
```
