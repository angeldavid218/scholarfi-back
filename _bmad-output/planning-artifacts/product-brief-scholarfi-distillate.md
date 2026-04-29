---
title: "Product Brief Distillate: scholarfi"
type: llm-distillate
source: "product-brief-scholarfi.md"
created: "2026-04-28T21:52:00Z"
purpose: "Token-efficient context for downstream PRD creation"
---

# ScholarFi Product Brief Distillate

## Product Intent (Core)

- Build a sales demo simulator (not production blockchain product) for ScholarFi to prove institutional reward workflow viability.
- Primary objective: demonstrate full happy path from school onboarding to simulated reward posting in under 2 minutes.
- Strategic message: validate governance and operational trust first, blockchain integration later.
- Demo audience: LatAm school stakeholders; app labels and key UX copy must be in Spanish.

## Problem Signals to Preserve

- Early edtech/fintech demos often fail when technical complexity appears before operational value.
- School onboarding frequently suffers from admin time constraints and role/permission confusion.
- Buyers need evidence of control and accountability across user roles before adopting new infrastructure.
- ScholarFi-specific gap: stakeholders must see auditable approval flow, not just gamified points.

## User Roles and Functional Boundaries

- `super_admin`: creates institutions, creates/invites first school admin, activates institution.
- `school_admin`: manages institution users (teacher/student), optionally assigns students to teachers, approves teacher-validated submissions, authorizes rewards.
- `teacher`: creates tasks, reviews submissions, validates/rejects submissions, forwards validated items to admin queue.
- `student`: views active tasks, submits evidence, tracks status, receives simulated balance updates after approval.
- Permission model must be strict per institution (no cross-tenant visibility/actions).

## Canonical Workflow and State Machine

- Canonical flow: `Task -> Submission -> Teacher Validation -> Admin Approval -> Simulated Reward`.
- Submission status set:
  - `pending`
  - `validated_by_teacher`
  - `approved_by_admin`
  - `rewarded`
  - `rejected`
- Enforced transitions:
  - `pending -> validated_by_teacher | rejected`
  - `validated_by_teacher -> approved_by_admin | rejected`
  - `approved_by_admin -> rewarded` (prefer same transaction as reward posting)
- Terminal statuses: `rewarded`, `rejected`.

## MVP Scope Signals (In)

- Auth + RBAC for 4 roles.
- Institution onboarding and activation.
- User creation by role within institution.
- Task creation and active task listing.
- Student evidence submission.
- Teacher validation/rejection.
- School admin approval.
- Reward simulation via stored balances and transaction records.
- Seed data ready for immediate demo run: 1 school, 1 school admin, 1 teacher, 2 students (and optionally pre-baked pending submission).
- UI must clearly show pipeline progression at all times.

## Explicit Out-of-Scope / Rejected for MVP

- No Solana integration yet.
- No wallet connection.
- No real token minting or on-chain transfer.
- No payment processing.
- No advanced reporting/analytics module.
- No complex notification systems (email/SMS/push).
- No over-engineered domain expansions beyond happy path.

## Non-Functional Priorities

- Fast demo execution and deterministic outcomes over feature breadth.
- Simplicity and clarity over configurability.
- Stable seeded environment preferred over dynamic setup complexity.
- Visual hierarchy should make status and next action obvious per role.

## UX/Design Direction Signals

- Design philosophy: "Scholarship meets DeFi" with "Intellectual Ledger" tone.
- Premium editorial feel; avoid standard SaaS box-grid aesthetics.
- No hard 1px divider lines for sectioning; define boundaries via tonal surfaces.
- Tonal layering preferred over heavy shadows.
- Primary CTA can use subtle teal gradient (`primary` -> `primary_container`).
- Glassmorphism reserved for floating elements (modals/nav) only; avoid overuse.
- App labels in Spanish for user-facing UI.
- Keep screens breathable with generous spacing; avoid dense layouts.

## Suggested Spanish Label Anchors

- `Iniciar sesión`
- `Instituciones`
- `Panel de Super Admin`
- `Panel del Administrador Escolar`
- `Panel del Docente`
- `Panel del Estudiante`
- `Tareas activas`
- `Entregas pendientes`
- `Aprobaciones pendientes`
- `Saldo simulado`
- `Pendiente`
- `Validada por docente`
- `Aprobada por administrador`
- `Recompensada`
- `Rechazada`

## Data/Domain Hints for PRD

- Likely core entities:
  - institutions
  - users
  - roles
  - user_roles
  - tasks
  - submissions
  - submission_validations
  - reward_transactions
  - simulated_balances
  - optional teacher_students assignment pivot
- Reward posting should be idempotent (one reward transaction per submission).
- Balance updates should be transactional and consistent with approval events.
- Institution scoping should be mandatory in all list/detail/action endpoints.

## API/Backend Hints for PRD

- REST modules expected:
  - auth
  - institutions
  - users
  - tasks
  - submissions
  - teacher validation
  - admin approval
  - rewards
- Authorization strategy:
  - authentication middleware + role middleware + institution boundary checks.
- Error behavior to preserve:
  - reject invalid state transitions
  - reject cross-institution operations
  - reject duplicate reward posting

## Frontend Architecture Hints for PRD

- Role-based route segmentation (super admin, school admin, teacher, student).
- Protected routes by authentication + role.
- Shared reusable components for:
  - status pipeline
  - task cards
  - submission/approval tables
  - balance and KPI tiles
- Use centralized service layer for API access and token handling.

## Demo Readiness Constraints

- Whole role-switch walkthrough must be executable live in <= 2 minutes.
- Presenter should not need DB/manual setup before each run.
- Seed data must support instant narrative:
  - institution exists or can be created quickly
  - users can log in immediately
  - at least one fast task/submission path can be demonstrated

## Metrics / Acceptance Signals to Carry into PRD

- E2E happy path reproducible in repeated runs.
- Every rewarded submission has explicit teacher + admin governance trail.
- No cross-tenant access across all protected endpoints.
- User-facing status progression always visible and understandable in Spanish.

## Competitive/Context Signals (from discovery)

- External context suggests gamification in education can improve engagement/attendance, but operational implementation quality matters.
- For institutional adoption, ease of onboarding and clear RBAC are critical trust factors.
- Product positioning should emphasize governed workflow and administrative control over novelty claims.

## Open Questions for PRD Stage

- Single submission per task vs multi-attempt policy (MVP currently leans single-attempt for simplicity).
- Late submission behavior (block hard vs allow with "late" flag).
- Exact auth mechanism in AdonisJS for demo (session vs token-first) and refresh strategy.
- Optional teacher-student assignment necessity for v1 demo script.
- Whether admin approval should auto-post reward instantly or allow a final separate "post reward" action.

## Recommended Immediate Next Step

- Run `bmad-create-prd` using:
  - `/_bmad-output/planning-artifacts/product-brief-scholarfi.md`
  - `/_bmad-output/planning-artifacts/product-brief-scholarfi-distillate.md`
- In PRD, preserve strict MVP guardrails and 2-minute demo objective as top-level constraints.
