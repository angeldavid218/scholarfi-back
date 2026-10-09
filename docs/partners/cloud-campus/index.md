# Cloud Campus · ScholarFi Partner API

This guide describes how Cloud Campus integrates with the ScholarFi backend to onboard schools, users, and custodial student wallets.

## Base URL

All API routes are prefixed with `/api/v1`.

| Environment | Example base URL               |
| ----------- | ------------------------------ |
| Local       | `http://localhost:3333/api/v1` |
| Production  | Provided by ScholarFi ops      |

## Versioning

ScholarFi uses path-based versioning (`/api/v1`). Breaking changes will ship under a new version prefix.

## Integration model (v1)

Cloud Campus authenticates with a dedicated **super_admin service account** provisioned by ScholarFi. That account can:

- Create and activate schools (institutions)
- Enable custodial crypto wallets per school
- Bootstrap the first school admin for each school

Day-to-day user provisioning runs as the **school_admin** for that institution.

## Documentation map

- [Authentication](authentication) — login, Bearer tokens, service account bootstrap
- [Onboarding flow](onboarding-flow) — end-to-end school setup
- [Institutions](institutions) — create and manage schools
- [Users](users) — bootstrap admins and provision teachers/students
- [Wallets](wallets) — enable custodial wallets and read public keys
- [Groups and roster](groups-and-roster) — subjects, groups, membership
- [Extended capabilities](extended-capabilities) — credits, balances, future sync
- [Errors and limits](errors-and-limits) — error envelope, common codes

## Support

Contact your ScholarFi integration contact for credentials, environment URLs, and production allowlisting.
