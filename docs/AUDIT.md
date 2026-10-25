# HireMatch — Repository Audit (baseline)

Audit date: 2026-10-25 · Branch `master` @ `7b433f5` · Working tree clean before changes.

## 1. Current architecture

| Layer | Implementation (verified) |
|---|---|
| Frontend | React 19 + TypeScript 6 + Vite 8, Tailwind 3, TanStack Query 5, react-router 7, lucide-react, recharts (unused by most pages) |
| Backend | FastAPI 0.115, Pydantic 2.9, SQLAlchemy 2.0, Alembic 1.13 |
| Database | SQLite for local runs, PostgreSQL 16 in Docker Compose |
| AI | OpenRouter chat completions via `httpx`, plus a deterministic "mock" mode |
| Parsing | `pypdf` and `python-docx`, files read in memory (bounded) and never stored |
| Auth | Argon2 password hashes, opaque server-side sessions in HttpOnly cookies |
| Deploy | `backend/Dockerfile`, `docker-compose.yml` (db + api only — no frontend service) |
| CI | GitHub Actions: ruff, pytest, vitest, vite build |

Data model: `users`, `auth_sessions`, `evaluations` (a job posting), `candidates` (a resume scored against that one posting).

## 2. Working functionality (baseline checks)

- Backend: `pytest` **26 passed**; `ruff check` clean.
- Frontend: `vitest` **6 passed**; `tsc && vite build` succeeds (371 kB JS).
- Register/login/logout with hashed passwords and HttpOnly sessions; private routes scoped by `user_id`.
- PDF/DOCX validation (extension, magic bytes, DOCX zip-structure checks, bounded reads).
- OpenRouter client with bounded retries, error classes and a single JSON repair attempt.

## 3. Broken or incomplete functionality

1. **Product identity mismatch.** The whole data model and UI are recruiter-oriented ("rank candidates", "Start evaluating candidates", "Confirm role-specific nuances with recruiter"). HireMatch's primary user is a job seeker evaluating *their own* resume. A resume could not exist apart from a single job, and could not be reused against other jobs.
2. **No resume entity or versions.** Resumes only exist as `candidates` rows inside one evaluation. Users cannot rename, edit extracted data, re-use, or see which version an analysis used.
3. **Raw resume text is discarded**, so no analysis can show resume evidence excerpts and nothing can be re-scored.
4. **Fabricated job requirements in mock/heuristic mode:** `preferred_skills = ['sql', 'docker']` is hard-coded for every job; minimum experience is only detected for the literal strings "3+ years" / "minimum 3 years"; seniority defaults to "mid-level".
5. **Responsibility score penalises missing data:** in heuristic mode the resume has no experience descriptions, so responsibility alignment is `0.0` (a scored zero) instead of "not verifiable", dragging every score down.
6. **Experience years heuristic** takes the maximum "N years" number anywhere in the text (e.g. "10 years of company history" in a summary).
7. **LLM prompts do not describe the output schema.** All Pydantic fields have defaults, so a model returning an unrelated JSON object validates as an empty profile — a silent failure that produces misleading scores.
8. **Evidence is not evidence:** `relevant_experience_evidence` is just the first 200 chars of each experience description, unrelated to any requirement.
9. **No source evidence for job requirements**, no required/preferred distinction from the source text, no uncertainty marker.
10. **No scoring version stored**, so historical results cannot be interpreted after methodology changes.
11. **CSV export returns JSON containing CSV** and is recruiter-oriented; there is no printable report.
12. Resume text above 12,000 characters is rejected outright (normal 3-page resumes can exceed this).
13. Dashboard "average score" mixes candidates of different jobs with no definition.

## 4. Security findings

| # | Finding | Severity |
|---|---|---|
| S1 | Ownership checks exist on evaluations/candidates (good). No IDOR found. | — |
| S2 | No CSRF defence beyond `SameSite=Lax`; no Origin check on state-changing requests. | Medium |
| S3 | Provider configuration errors (e.g. "OPENROUTER_API_KEY is not configured") are returned to the browser verbatim. | Low |
| S4 | No request-size guard before multipart parsing; oversized bodies are fully received before the bounded reader rejects them. | Medium |
| S5 | Encrypted PDFs are not detected explicitly. | Low |
| S6 | Rate limit is per IP+path only; no per-account login throttling. | Low |
| S7 | No way to delete an account or all data; no "sign out everywhere". | Medium (privacy) |
| S8 | Session rows never purged; no session rotation on password change (no password change exists). | Low |
| S9 | OpenAPI docs always exposed; no environment flag. | Low |
| S10 | Full resume text, including contact details, is sent to the LLM provider. | Medium (privacy) |
| S11 | No secrets found in tracked files or Git history; `.env` is ignored. | — |

## 5. UI / UX problems

- Recruiter copy throughout; landing page says "Match the right talent to every role".
- Navigation only exposes Dashboard / New Evaluation / Settings; there is no place to manage resumes or jobs.
- Results page ranks candidates rather than explaining one resume against one job.
- No explanation of methodology, no "not found vs. confirmed missing" distinction, no source excerpts.
- `*` route silently renders Dashboard for unknown URLs (no 404).
- Fonts are imported twice (CSS `@import` and `<link>`).

## 6. Missing product capabilities

Resume library with versions and editing · saved jobs with editable requirements · analysis history with immutable snapshots · resume-vs-many-jobs comparison · skill-gap action plan · printable report · application tracker · onboarding · search/filter/pagination · privacy controls (delete data/account) · methodology page.

## 7. Test and deployment gaps

- No tests for cross-user access on most endpoints, scoring edge cases, migrations, or extraction quality.
- No browser E2E tests; no frontend tests beyond render smoke tests.
- Docker Compose has no frontend service; the frontend must be run separately against a cross-origin API.
- No migration test; migrations were only run implicitly in Compose.

## 8. Prioritised implementation plan

1. **Core domain model (P0):** `resumes`, `resume_versions`, `jobs`, `analyses` tables with an Alembic migration that preserves and converts legacy `evaluations`/`candidates` data (legacy tables retained, not dropped).
2. **Extraction & scoring engine v2 (P0):** section-aware heuristic extraction, larger skill taxonomy with aliases and related-skill families, requirement objects with source excerpts and uncertainty flags, deterministic versioned scoring with evidence coverage and an explicit insufficient-evidence state, deterministic explanations and action plan.
3. **LLM hardening (P0):** schema-in-prompt, JSON mode, total time budget, contact-detail redaction, LLM output cross-checked against document text, safe error messages.
4. **Processing reliability (P0):** parse synchronously (fast, immediate validation errors), run extraction in a background task with persisted status, frontend polling, stale-job recovery, retry without re-upload, idempotent analysis creation.
5. **Security (P1):** Origin check for unsafe methods, body-size guard, encrypted PDF detection, safe error mapping, per-account login throttling, password change, sign-out-everywhere, account and data deletion, security headers, docs flag.
6. **Frontend (P1):** design tokens + shared component library, new app shell and routes (Overview, Analyze, Resumes, Jobs, Analyses, Compare, Settings), results page with evidence and action plan, printable report, landing + methodology + privacy pages.
7. **Verification (P1):** backend unit/API/migration tests, frontend component tests, browser walkthrough, Docker build/start, Postgres migration of legacy data.

## 9. Acceptance criteria per workstream

| Workstream | Acceptance criteria |
|---|---|
| Domain model | Migration upgrades a populated legacy DB (SQLite and Postgres) without data loss; every private table has an owner FK and index; editing a resume or job never changes a stored analysis. |
| Scoring | Deterministic for equal input; weights sum to 1 and renormalise only over applicable components; unverifiable data never scores 0 or 100; no requirements → no score; stores `scoring_version`; regression tests cover empty, none/full overlap, aliases, partial experience, malformed LLM output. |
| Extraction | No fabricated requirements; each requirement keeps its source line; preferred vs required from section headings; LLM output validated and cross-checked against text. |
| Reliability | Upload returns quickly; extraction status persisted and pollable; failures are visible with a retry; no duplicate analyses on repeated clicks. |
| Security | Cross-user access to every resource returns 404; uploads validated server-side; secrets never reach the browser; account deletion removes all user data. |
| Frontend | Every nav item leads to a working page; loading/empty/error states everywhere; no fake data; mobile layout without horizontal scroll; keyboard-accessible dialogs. |
| Quality | pytest, ruff, vitest, tsc, vite build pass; Docker image builds and starts; browser walkthrough of the main journey passes. |
