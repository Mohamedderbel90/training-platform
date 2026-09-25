# Nour Qiyada — Project Instructions

## Project Architecture

Nour Qiyada is composed of:

- Backend: Odoo 19 Community
- Backend addon: `custom_addons/training_management`
- Frontend: Next.js 16 / React 19 / TypeScript
- Database: PostgreSQL
- API: Odoo operational API under `/api/v1/*`
- Localization: Arabic RTL + English LTR

## Architecture Boundaries

### Odoo owns:
- business rules
- permissions
- record rules
- validation
- workflows
- domain models
- survey integration
- reporting
- notifications
- backend API behavior

### Next.js owns:
- operational frontend UX
- pages and routing
- client-side state
- API consumption
- loading/error/empty states
- responsive behavior
- Arabic RTL / English LTR presentation

Do not duplicate Odoo business rules in the frontend.

## Functional Source of Truth

Before implementing or changing business behavior, consult the relevant project documentation:

- BRD
- SRS
- UI Flow
- API Contract
- ERD / Odoo Model Mapping
- PROJECT_SPEC
- DEVELOPMENT_PLAN
- README
- existing code and tests

Do not invent:
- business rules
- statuses
- permissions
- workflows
- fields
- APIs
- roles

If documents conflict, prefer the most recent explicitly approved version.

## Visual Source of Truth

Approved Claude Design prototypes, exported HTML/CSS, screenshots, and approved project assets are the visual source of truth.

Current design reference export:

`Sidebar + Header + Trainee Dashboard-html/`

Use it for visual fidelity when implementing approved screens.

Do not redesign approved pages unless explicitly requested.

## Existing Application Structure

### Backend

`custom_addons/training_management/`

Contains:
- controllers
- Odoo models
- security
- views
- reports
- cron/data
- translations
- backend tests

Controllers must remain thin.

Business logic should live in appropriate Odoo models/services.

### Frontend

`frontend/`

Contains:
- App Router pages
- shared components
- API client/services
- auth/session handling
- dashboard logic
- i18n
- Arabic/English messages
- frontend tests

Reuse existing shared components before creating duplicates.

## General Development Rules

- Preserve working architecture.
- Prefer minimal, focused changes.
- Do not rewrite working modules unnecessarily.
- Do not hard-code production data.
- Do not expose secrets in frontend code.
- Preserve authentication/session behavior.
- Preserve role-based permissions.
- Preserve API contracts unless explicitly approved.
- Use real APIs/data where available.
- Keep mock data isolated and clearly identifiable.
- Do not create disconnected static prototype pages inside the real application.
- Avoid duplicate components and duplicate routes.

## Frontend Requirements

Every frontend change must consider:

- Arabic RTL
- English LTR
- Desktop
- Laptop
- Tablet
- Mobile
- Accessibility
- Loading states
- Error states
- Empty states
- Permission-aware actions

Do not blindly mirror UI with `row-reverse`.
Follow the approved language-specific design behavior.

## Backend Requirements

Follow Odoo 19 best practices:

- use ORM correctly
- preserve access rights
- preserve record rules
- validate server-side
- avoid unnecessary `sudo()`
- keep controllers thin
- keep business rules in backend domain logic
- prefer standard Odoo functionality before custom duplication

## Database Rules

Odoo ORM owns the application schema.

Do not manually modify PostgreSQL schema when the change belongs in Odoo models.

Database-level work should focus on:
- analysis
- integrity
- indexes
- query performance
- migration planning

Never perform destructive database operations without explicit approval.

## Testing and Quality

After meaningful changes, run the relevant available checks.

Frontend:
- lint
- type-check
- Vitest
- build

Backend:
- Odoo tests
- addon lint/checks
- security/API tests

Do not claim success if checks were not actually run.

Fix failures when possible before reporting completion.

## Agent Delegation

Use specialized agents according to responsibility:

- `frontend-engineer`
  - Next.js / React / TypeScript
  - UI implementation
  - Claude Design integration
  - RTL/LTR
  - responsive
  - frontend tests

- `backend-odoo-engineer`
  - Odoo models
  - business logic
  - controllers
  - permissions
  - record rules
  - Odoo tests

- `api-integration-engineer`
  - frontend ↔ Odoo API boundary
  - request/response contracts
  - API client
  - endpoint integration
  - API error handling

- `qa-engineer`
  - regression
  - frontend/backend integration testing
  - routing
  - workflows
  - RTL/LTR
  - responsive checks

- `solution-architect`
  - cross-cutting architecture
  - major refactors
  - module boundaries
  - implementation planning

- `security-reviewer`
  - authentication
  - authorization
  - record isolation
  - API security
  - sensitive-data exposure

- `database-engineer`
  - PostgreSQL performance
  - indexes
  - schema review
  - data integrity
  - migration analysis

For small isolated edits, do not spawn unnecessary agents.

## Important Project Principle

The existing architecture is already established.

Do not reorganize the repository or introduce a new architecture unless there is a concrete technical reason supported by the project requirements.

Prefer improving the current system over replacing it.
