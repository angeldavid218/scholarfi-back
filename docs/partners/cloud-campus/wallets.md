# Wallets

ScholarFi uses **custodial Solana wallets** per student when crypto wallets are enabled for an institution. Cloud Campus does not manage private keys; ScholarFi stores encrypted secrets server-side.

## Enable crypto wallets

```http
PATCH /api/v1/institutions/:id/crypto-wallets
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{ "enabled": true }
```

**Role:** `super_admin`

**Response (200)**

```json
{
  "data": {
    "id": 12,
    "name": "Cloud Campus Pilot School",
    "code": "CC-PILOT-001",
    "status": "active",
    "cryptoWalletsEnabled": true,
    "walletsBackfilled": 3,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

`walletsBackfilled` counts existing students who received a wallet during enablement.

## When wallets are created

| Event                                              | Wallet created?                    |
| -------------------------------------------------- | ---------------------------------- |
| Enable crypto wallets on institution               | Backfill for all existing students |
| Provision new student (`POST /institutions/users`) | Yes, if crypto enabled             |
| Assign `student` role to existing user             | Yes, if crypto enabled             |
| Provision teacher or school_admin                  | No                                 |

## Reading wallet public keys

After provisioning or listing users, read `walletPublicKey` from the response (students only, when crypto is enabled).

In **mock** mode (`TOKEN_MODE=mock`), wallets use an internal ledger; `walletPublicKey` may be `null` even though a balance row exists.

In **solana** mode (`TOKEN_MODE=solana`), `walletPublicKey` is the student's on-chain public address.

## Token health check

```http
GET /api/v1/token/health
Authorization: Bearer <school_admin_or_super_admin_token>
```

Use to verify token/Solana configuration in an environment.

## Security notes

- Never log or expose wallet private keys — they are not returned by the API.
- Disable crypto wallets only when coordinated with ScholarFi ops; disabling does not delete existing wallet records.
