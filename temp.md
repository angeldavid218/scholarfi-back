You are BMAD Method acting as Product Manager, Architect, UX Expert, and Full-Stack Tech Lead.

I want to build a sales demo simulator for ScholarFi, an education rewards platform. The goal is to simulate the onboarding of schools and the full academic reward flow using React.js on the frontend and AdonisJS on the backend.

This simulator is not connected to Solana yet. Tokens and rewards are simulated for demo purposes.

Project goal:
Create a happy path where a school can be onboarded, users can be created by role, teachers can create academic tasks, students can submit task completions, teachers can validate submissions, and school admins can approve rewards to simulate token distribution.

Main roles:

1. Super Admin
2. School Admin
3. Teacher
4. Student

Happy path:

Super Admin:

- Logs into the system
- Creates a new institution/school
- Creates or invites the first School Admin
- School becomes active and ready to operate

School Admin:

- Logs into the institution dashboard
- Registers teachers
- Registers students
- Optionally assigns students to teachers
- Later acts as an external validator for teacher-approved submissions
- Approves rewards before simulated tokens are sent

Teacher:

- Logs in
- Creates academic tasks
- Defines title, description, reward amount, and optional due date
- Views student submissions
- Validates completed submissions
- Sends validated submissions to the School Admin approval queue

Student:

- Logs in
- Views available active tasks
- Completes a task by submitting simple evidence
- Waits for teacher validation and admin approval
- Receives simulated reward tokens after approval

Core workflow:
Task → Submission → Teacher Validation → Admin Approval → Simulated Reward

Submission statuses:

- pending
- validated_by_teacher
- approved_by_admin
- rewarded
- rejected

Demo requirements:

- The entire flow should be easy to demonstrate in under 2 minutes
- No real blockchain integration
- No real token minting
- No real wallet connection required
- Rewards should be stored as simulated token balances
- The UI should clearly show progress through the validation pipeline
- The system should support seed data for one demo school, one admin, one teacher, and two students

Tech stack:
Frontend:

- React.js
- TypeScript
- React Router
- A clean component-based architecture
- Role-based dashboards
- Simple but polished UI

Backend:

- AdonisJS
- TypeScript
- PostgreSQL
- Lucid ORM
- Authentication
- Role-based access control
- REST API

What I need you to produce:

1. Product Brief

- Define the simulator purpose
- Define the user roles
- Define the core value proposition
- Define what is in scope and out of scope for the demo

2. User Flows

- Create the happy path for each role
- Include step-by-step flows
- Include edge cases only if they are critical

3. Data Model

- Design the database entities
- Include tables for institutions, users, roles, tasks, submissions, validations, and rewards
- Include the main fields and relationships
- Keep the model simple enough for an MVP simulator

4. API Design

- Define REST endpoints for:
  - Auth
  - Institutions
  - Users
  - Tasks
  - Submissions
  - Teacher validation
  - Admin approval
  - Rewards
- Include request and response examples

5. Frontend Architecture

- Define pages/routes by role
- Define reusable components
- Define API services
- Define protected routes and role-based navigation

6. Backend Architecture

- Define AdonisJS modules/controllers/services
- Define middleware for authentication and authorization
- Define Lucid models and migrations
- Define seeders for demo data

7. Implementation Plan

- Break the work into milestones
- Prioritize the fastest path to a working demo
- Include the order in which the frontend and backend should be built

8. Acceptance Criteria

- Define what must be true for the simulator to be considered complete
- Include role-specific success criteria

Important constraints:

- Keep it MVP-focused
- Avoid overengineering
- Do not add blockchain integration yet
- Do not add payments
- Do not add complex reporting
- Prioritize a smooth demo experience
- Prefer simple CRUD and clear state transitions

- use spanish language for labels on the app because this demo is for latin american schools

Sidenotes:
I attached some images as inspirations for the UI/UX design.

design notes :

# Design System Philosophy: Scholarship meets DeFi

This design system is a bespoke framework crafted to bridge the prestigious, archival world of academia with the fluid, high-velocity landscape of decentralized finance. It moves beyond the "standard SaaS" aesthetic to create an editorialized fintech experience that feels authoritative, transparent, and sophisticated.

## 1. Overview & Creative North Star: "The Intellectual Ledger"

The Creative North Star for this system is **"The Intellectual Ledger."**

We are not building a simple dashboard; we are curating a modern archive of value. The design breaks the traditional "box-and-grid" template through **Intentional Asymmetry** and **Tonal Depth**. By utilizing wide margins, dramatic typography scales, and overlapping surface layers, we mimic the layout of a premium academic journal while maintaining the responsiveness of a cutting-edge DeFi protocol.

The goal is "Quiet Authority." We achieve this by letting negative space do the heavy lifting, ensuring that every piece of data feels like a curated entry in a prestigious ledger.

---

## 2. Colors: The Depth of Knowledge

Our palette is anchored in the deep, scholarly Teal of the **Primary** and **Primary Container** tokens, balanced by a sophisticated spectrum of "Paper" neutrals.

### The "No-Line" Rule

To maintain a premium, editorial feel, **1px solid borders are prohibited for sectioning.** Boundaries must be defined solely through background color shifts or subtle tonal transitions. For example, a `surface-container-low` section should sit directly against a `surface` background to define its territory without the "cheapness" of a stroke.

### Surface Hierarchy & Nesting

Treat the UI as a series of physical layers—like stacked sheets of vellum or architectural glass.

- Use the `surface-container` tiers (Lowest to Highest) to create a sense of focus.
- **Nesting:** Place a `surface-container-lowest` card (the "brightest" white) onto a `surface-container-low` background to create a soft, natural lift. This tactile stacking replaces the need for heavy shadows.

### The "Glass & Gradient" Rule

To inject the "DeFi" innovation into the academic base, use **Glassmorphism** for floating elements (e.g., Modals, Navigation Bars). Use semi-transparent `surface` colors with a `backdrop-blur` of 12px–20px.

- **Signature Textures:** Apply subtle linear gradients from `primary` (#004042) to `primary_container` (#00595c) on main CTAs to provide a "lit from within" glow that feels high-tech and polished.

---

## 3. Typography: Editorial Precision

We utilize **Plus Jakarta Sans** for its geometric clarity and modern humanist feel. Our type scale is intentionally dramatic to create a sense of hierarchy found in high-end periodicals.

- **Display (Display-LG 3.5rem):** Reserved for high-impact data points like Total Value Locked (TVL) or Scholarship yields. It should feel monumental.
- **Headlines (Headline-MD 1.75rem):** Used for section titles. These should have generous leading to feel "airy."
- **Body (Body-LG 1rem):** Our workhorse. Always prioritize readability with a high-contrast `on_surface` (#191c1c) color.
- **Labels (Label-MD 0.75rem):** Used for micro-data and DeFi tags. These are often paired with `primary` tokens to highlight actionable metadata.

The hierarchy is designed to guide the eye from "The Big Picture" (Display) down to the "Granular Detail" (Label) without visual friction.

---

## 4. Elevation & Depth: Tonal Layering

We eschew traditional Material shadows in favor of **Tonal Layering.** Depth is a product of color math, not just light source simulation.

- **The Layering Principle:** Stacking `surface-container-lowest` on `surface-container-low` creates a "High-End Paper" effect.
- **Ambient Shadows:** If an element must float (like a dropdown), use an extra-diffused shadow.
  - _Spec:_ `0px 12px 32px rgba(25, 28, 28, 0.06)`.
  - The shadow is never black; it is a tinted version of `on_surface` to mimic natural ambient light.
- **The "Ghost Border" Fallback:** If a container requires a boundary for accessibility, use the **Ghost Border**: the `outline_variant` token at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components: Precision Utilitarianism

### Buttons

- **Primary:** Gradient fill (`primary` to `primary_container`), `on_primary` text. Use `lg` (0.5rem) or `full` (9999px) roundedness for a pill shape that feels modern.
- **Tertiary:** No background, `primary` text. Use for low-emphasis actions like "View Source" or "Read Research."

### Input Fields

- Forbid traditional "box" inputs. Use a "Submerged" style: a `surface-container-high` background with a `sm` (0.125rem) bottom-border using the `primary` token that activates on focus.

### Cards & Lists

- **The No-Divider Rule:** Forbid 1px dividers between list items. Use vertical white space (using the 1.5rem / 2rem scale) or subtle alternating background shifts (`surface` to `surface-container-low`) to distinguish items.
- **Scholarship Cards:** Should utilize a `surface-container-lowest` fill with a `primary` "accent tab" (4px width) on the left side to denote "Trust/Verified" status.

### Custom DeFi Components

- **Yield Tickers:** Use `tertiary` (#282a8c) for secondary financial metrics to distinguish "Growth" data from "Trust" data.
- **Asset Tags:** Small, semi-transparent `primary_fixed_dim` chips with `on_primary_fixed` text for high legibility in dense data environments.

---

## 6. Do’s and Don’ts

### Do

- **Do** use asymmetrical layouts (e.g., a wide left column for content and a slim right column for metadata).
- **Do** leverage the "Paper" feel of the `background` (#f8faf9) to create a sense of calm.
- **Do** use the `0.5rem (lg)` roundedness as your primary corner radius for a friendly yet structured feel.

### Don't

- **Don't** use pure black (#000000) for anything. Always use `on_surface` (#191c1c).
- **Don't** use standard "Drop Shadows" from default software presets. Always use the Ambient Shadow spec.
- **Don't** crowd the interface. If a screen feels full, increase the `surface` padding. Scholarly work requires room to breathe.
- **Don't** use high-saturation "Neon" colors for DeFi alerts. Use the `error` (#ba1a1a) and `tertiary` tokens to keep the tone academic.

Output format:
Use BMAD-style structured documentation.
Make the result practical enough to start implementation immediately.
