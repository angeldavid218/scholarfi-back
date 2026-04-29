---
title: "Product Brief: scholarfi"
status: "complete"
created: "2026-04-28T21:45:00Z"
updated: "2026-04-28T21:45:00Z"
inputs:
  - "User-provided product vision and constraints (chat)"
  - "Design system notes: Scholarship meets DeFi (chat)"
  - "Web context: K-12 gamification outcomes and school onboarding/RBAC adoption barriers"
---

# Product Brief: ScholarFi Demo Simulator

## Executive Summary

ScholarFi Demo Simulator is a sales-ready, role-based simulation environment that demonstrates how schools can operationalize academic rewards from onboarding to reward issuance without blockchain dependency. The product is designed to make ScholarFi's institutional workflow tangible in a live meeting: a school is activated, users are created by role, academic tasks are assigned and completed, submissions are validated, and simulated token rewards are approved and posted.

The simulator addresses the core adoption gap in education fintech demos: decision-makers need to understand governance, accountability, and operational fit before they evaluate infrastructure complexity. By removing wallets, minting, and network dependencies, the demo highlights the value proposition that matters now: transparent academic incentive operations with clear roles and auditable status transitions.

This MVP is optimized for a <2 minute happy-path walkthrough for LatAm schools, with Spanish labels in the UI and deterministic seed data. It is intentionally narrow, credible, and easy to run repeatedly by sales and partnerships teams.

## The Problem

Education buyers and school operators often reject early product demos when implementation details overshadow day-to-day workflow value. In today's landscape, school onboarding suffers from administrative time constraints, role ambiguity, and configuration friction. If a demo requires blockchain setup, wallets, or external integrations, the sales narrative breaks before institutional trust is established.

For ScholarFi specifically, the challenge is proving that academic actions can be converted into governed rewards in a way that feels operationally safe to school leadership. Stakeholders must see:

- Clear role boundaries (Super Admin, School Admin, Teacher, Student)
- A controlled approval chain for rewards
- Visible progress and accountability at each stage
- Practical onboarding with minimal setup overhead

Without this simulator, sales cycles depend on conceptual explanation instead of experiential evidence.

## The Solution

Build a full-stack simulator (React + AdonisJS + PostgreSQL) that reproduces ScholarFi's institutional reward lifecycle in a controlled, non-blockchain environment.

Core flow:

1. Super Admin creates and activates a school.
2. School Admin creates teacher and student users.
3. Teacher creates task with reward amount.
4. Student submits completion evidence.
5. Teacher validates submission.
6. School Admin approves reward.
7. Student receives simulated token balance update.

All transitions are explicit, role-gated, and surfaced in the UI through a status pipeline:

`pending -> validated_by_teacher -> approved_by_admin -> rewarded` (or `rejected`).

The system stores simulated balances and reward transactions to mimic treasury behavior while avoiding blockchain coupling.

## What Makes This Different

- Governed educational rewards, not generic gamification.
- Sales-first realism with minimal setup, optimized for short live demos.
- Trust-oriented flow visibility with auditable submission stages.
- De-risked adoption path by validating operations before integration complexity.
- LatAm-ready presentation layer with Spanish labels and region-fit narrative.

## Who This Serves

### Primary Users

- School decision-makers who need confidence in governance and operational feasibility.
- School admins who need straightforward user management and final approval authority.
- Teachers who need quick task creation and efficient validation workflows.
- Students who need clear completion expectations and visible reward outcomes.

### Internal Users

- Sales and partnerships teams needing deterministic, repeatable demos.
- Implementation teams needing a stable pre-blockchain process reference.

## Success Criteria

### Demo Effectiveness Metrics

- End-to-end happy path completes in <= 2 minutes.
- Presenter can execute the same flow in three consecutive runs without manual fixes.
- At least one full reward cycle reaches `rewarded` in each demo run.

### Product Workflow Metrics

- 100% of reward credits originate from admin-approved submissions.
- 0 cross-institution data access in role-protected endpoints.
- 100% of state transitions conform to the defined status machine.

### User Clarity Metrics

- Every role dashboard shows the next actionable step.
- Pipeline state is visible to users in Spanish at all times.
- Seeded users can log in and execute role actions without extra setup.

## Scope

### In Scope (MVP)

- Authentication and RBAC for 4 roles.
- Institution onboarding (create + activate).
- School user management (teacher/student creation).
- Teacher task creation and listing.
- Student evidence submission.
- Teacher validation and rejection handling.
- School Admin approval and reward posting.
- Simulated balances + reward transaction log.
- Spanish UI labels and role-based dashboards.
- Seed data: 1 school, 1 school admin, 1 teacher, 2 students.

### Explicitly Out of Scope

- Solana integration and wallet connectivity.
- Real token minting/transfers.
- Payment rails and financial settlement.
- Advanced analytics/reporting suite.
- Complex notification orchestration (email/SMS/push).

## Go-to-Market Role in Sales Cycle

This simulator acts as a mid-funnel conversion asset:

- Before technical diligence: demonstrates institutional value and governance model.
- During stakeholder alignment: gives admins and educators role-specific confidence.
- Before integration phase: establishes process buy-in before blockchain roadmap discussion.

Recommended usage:

- Standardized 2-minute script in discovery and solution demos.
- Role-switched walkthrough to address objections in real time.
- Follow-up artifact to transition from interest to implementation scoping.

## Key Risks and Mitigations

- Risk: Demo appears fake without blockchain.  
  Mitigation: Position as deliberate workflow simulation before infrastructure activation.

- Risk: Admin setup burden slows the flow.  
  Mitigation: Deterministic seed data, shortcut paths, minimal required fields.

- Risk: Role confusion in presentations.  
  Mitigation: Role-specific dashboards and pipeline-centric information architecture.

- Risk: Scope creep into production concerns.  
  Mitigation: Keep explicit out-of-scope guardrails in all planning and sprint docs.

## Vision (2-3 Years)

If successful, the simulator becomes the operational foundation for production ScholarFi rollout:

- Simulated balances evolve into on-chain settlement.
- Institutional approvals map to policy-driven smart contract workflows.
- Reward lifecycle expands beyond tasks into broader achievement indicators.
- Dashboards evolve from workflow visibility to outcomes and impact analytics.

Long-term direction remains consistent: make student achievement economically visible and institutionally governable, starting with trust-first operations and then progressing to decentralized reward infrastructure.
