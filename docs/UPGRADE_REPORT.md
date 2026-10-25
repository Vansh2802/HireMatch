# HireMatch upgrade report

Date: 2026-10-25 · Baseline `master@7b433f5` · Changes are uncommitted in the working tree.
The baseline audit, risks and acceptance criteria are in [AUDIT.md](AUDIT.md).

## 1. Defects found in the original code

| Area | Defect |
|---|---|
| Product | Built for recruiters (one job → many candidates, "rank candidates"); a job seeker could not keep a resume and reuse it across jobs. |
| Data | No resume entity or versions; raw resume text discarded, so no evidence could be shown or re-scored; no scoring version stored. |
| Extraction | Heuristic job extraction **fabricated** `preferred_skills = ['sql','docker']` for every job; years of experience only detected for the literal "3+ years"; `normalize_text` collapsed all newlines, destroying sections; phone regex matched year ranges ("2019 - 2021"); "Scrum Master" read as a master's degree. |
| Scoring | Missing resume data scored as 0 for responsibilities (should be "unverifiable"); "evidence" was the first 200 chars of each role, unrelated to requirements. |
| LLM | Prompts never described the output schema; any JSON object validated as an empty profile (silent garbage). Provider config errors (env-var names) were returned to users. |
| Security | No Origin/CSRF defence beyond SameSite; no request-size guard before multipart parsing; encrypted PDFs not detected; no account/data deletion; no password change or sign-out-everywhere; Docker image copied local `*.db` files (user data) into the image. |
| UX | Recruiter copy, unknown routes silently rendered the dashboard, no methodology, no "not found vs missing" distinction. |

Defects found **during** this upgrade and fixed (by testing): list-numbering stripper ate the "5" in "5+ years"; "About the role" intros parsed as duties; "Analytics" in a company name read as a skill; role header above the date line not split; password field missing its label; CSS grid/fieldset overflow at 375 px; nginx dropped security headers in `location` blocks; nginx forwarded `Host` without the port, so the CSRF Origin check rejected same-origin requests on non-80 ports; live LLM returned whole sentences as single "skills" (score 71 instead of 79).

## 2. Preserved

FastAPI + Pydantic + SQLAlchemy + Alembic backend; React + TypeScript + Vite + Tailwind + TanStack Query frontend; PostgreSQL in Compose; OpenRouter client (hardened, same interface); Argon2 + opaque HttpOnly session auth; PDF/DOCX parsing libraries; all existing data (converted by migration, legacy tables kept).

## 3. UI / UX

- Design system: CSS-variable tokens (obsidian/ivory/burnt-orange + four semantic requirement states), Instrument Sans with a condensed width axis for numerals/titles, two radii, shared primitives (`Button`, `Field`, `Input/Textarea/Select`, `Badge`, `Dialog`/`ConfirmDialog` on native `<dialog>`, `Toast`, `InfoTip`, `Skeleton`/`EmptyState`/`ErrorState`, `UploadZone`, `ScoreDial`/`Meter`, `Pagination`, `SearchInput`).
- App shell: dark navigation rail, mobile drawer (Escape closes), skip link, focus moved to content on navigation, session-expiry redirect with return path.
- Pages: Landing (no fake stats; sample preview labelled as sample), How scoring works, Privacy, Terms, Sign in/up, Overview (real metrics + onboarding), Analyze (choose/upload resume + choose/paste job with live progress), My resumes, Resume detail (extracted details, corrections editor, document text, versions, analyses across jobs), Jobs & applications (stage tabs, inline stage change), Job detail (requirement review/editing, tracker, analyses, description), Analysis history (filters, select to compare), Analysis result (score, coverage, confidence, breakdown, evidence ledger, action plan), printable report, Compare, Settings & privacy, 404.
- Per-page code splitting: entry bundle 371 kB → 240 kB.

## 4. New features (all backed by real API logic)

Resume library with immutable versions and profile corrections · saved jobs with requirement review (remove/required↔preferred, new revision) · evidence-based analyses with immutable job snapshots · idempotent analysis creation · analysis history with search/filter/sort/pagination · comparison (same job across versions; one resume across jobs; warns on mixed scoring versions) · gap action plan · printable report (print stylesheet / Save as PDF) · application tracker (stages, dates, notes, follow-ups on Overview) · onboarding checklist (dismissal persisted) · settings: change password, sign out everywhere, delete account · duplicate-upload detection.

## 5. Backend, database and AI

- **Schema** (migration `20261025_03`): `resumes`, `resume_versions`, `jobs`, `analyses`, `users.onboarding_dismissed_at`. Owner FKs with `ON DELETE CASCADE`; `analyses.job_id ON DELETE SET NULL` (snapshot keeps history readable); unique constraints for version numbers and analysis inputs; indexes on all owner/filter columns. SQLite foreign keys enforced via PRAGMA.
- **Processing:** synchronous parse/validation, background extraction with persisted status, retry endpoints, stale-work expiry on startup, revision checks so late tasks never overwrite newer edits.
- **Scoring v2.0:** see README / `/how-it-works`. Deterministic, versioned, renormalised weights, uncertain/preferred half weight, unverifiable excluded, coverage-gated "Insufficient evidence", explanations derived from the same results.
- **Skill taxonomy:** ~150 skills with aliases, case-sensitive ambiguous words (Excel, Swift, Rust…), related families (partial credit) and implications (PostgreSQL ⇒ SQL).
- **LLM:** schema in prompt + JSON mode + temperature 0; Pydantic validation + one repair; bounded retries only for transient errors inside a total time budget; 401/402/403/404 fail fast; in-body provider errors detected; contact details redacted before sending; skills not in the document dropped (with a user-visible note); untraceable requirement excerpts marked uncertain; sentence "skills" split; safe `public_message` for every error.

## 6. Security

Origin check on unsafe methods; body-size guard before parsing; DOCX zip-bomb/path checks; encrypted/scanned PDF rejection; filename sanitisation; login throttling per client+account; uniform login timing for unknown accounts; session rotation on login, revoke-all on password change, sign-out everywhere; account deletion cascades all data; security headers (API: CSP `default-src 'none'`, `no-store`; nginx: CSP, frame-deny, etc.); docs hidden in production; validation errors summarised without echoing internals; Docker: `.dockerignore` (no DBs/secrets/tests), non-root user, healthcheck. Patched `fastapi 0.115.12` (Starlette 0.46.2) and `python-multipart 0.0.20`. No secrets in tracked files or Git history; `.env.example` holds placeholders only.

## 7. Files

Backend: `app/main.py`, `core/{config,database,rate_limit}.py`, `api/dependencies.py`, `api/routes/{auth,health,resumes,jobs,analyses,dashboard}.py`, `models/{auth,resume,job,analysis}.py`, `schemas/{auth,resume,job,analysis,common}.py`, `services/{document_parser,file_validation,skill_normalizer,text_analysis,resume_extractor,job_extractor,matching_service,processing,llm_service,auth_service}.py`, new migration, `Dockerfile`, `.dockerignore`, tests. Removed: recruiter routes/models/repositories (`evaluations`, `candidates`, `scoring_service`).
Frontend: `index.html`, `tailwind.config.js`, `tsconfig.json`, `vite.config.ts`, `src/index.css`, `src/App.tsx`, `src/lib/*`, `src/components/**`, `src/pages/*` (all rewritten), tests, `Dockerfile`, `nginx.conf`, `security-headers.conf`. Removed unused `recharts` and `zod`.
Root: `docker-compose.yml` (adds `web`, configurable ports, removes unused upload volumes), `.env.example`, CI workflow, README, `docs/`.

## 8. Migrations and environment changes

- Run `alembic upgrade head` (Compose does this automatically). Converts owned legacy rows; legacy tables are retained.
- New/changed env vars: `ENVIRONMENT`, `EXPOSE_API_DOCS`, `LLM_TOTAL_BUDGET_SECONDS`, `LLM_MAX_INPUT_CHARS`, `SESSION_TTL_DAYS`, `MAX_RESUMES_PER_USER`, `MAX_JOBS_PER_USER`, `LOGIN_ATTEMPTS_PER_15_MINUTES`, `PROCESSING_STALE_MINUTES`, `API_PORT`, `WEB_PORT`; defaults changed: `MAX_PAGES_PER_DOCUMENT` 80→30, `MAX_JOB_DESCRIPTION_CHARS` 12k→20k, `MAX_RESUME_TEXT_CHARS` 12k→40k (truncated with warning instead of rejected). `UPLOAD_DIR`/`TEMP_DIR` removed (files were never stored).
- The frontend now calls the API same-origin (`/api`); `VITE_API_URL` is only needed for a separately hosted API.
- Existing Compose volumes `resume_parser_ai_uploads_data` / `_temp_data` are no longer used (left in place, not deleted).

## 9. Commands run and results

| Command | Result |
|---|---|
| Baseline `pytest` / `ruff` / `vitest` / `npm run build` | 26 passed / clean / 6 passed / OK |
| `cd backend && pytest -q` | **92 passed** (scoring edge cases, extraction, LLM client incl. mocked failures, API journey, cross-user access on every endpoint, uploads, auth/security, processing, Alembic migration incl. legacy conversion + downgrade, schema-vs-model check) |
| `ruff check .` | All checks passed |
| `npm test` | **28 passed** (API client, Dashboard, Analysis result, Analyze workflow, Sign-in, Compare, routing/auth) |
| `npm run build` (includes `tsc` with `noUnusedLocals`) | OK, entry 240 kB (75 kB gzip) |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `docker compose build` + `up --wait` (project `hirematch_e2e`) | db/api/web healthy |
| Postgres migration with seeded legacy rows | converted job (4 requirements), resume, v1.0 analysis (72, "Good Match"); legacy rows kept |
| API journey through nginx (Docker) | register 201 · upload 202 · job ready · analysis 201 (score 79) · cross-site POST 403 · other user 404 · 12 MB upload 413 |
| Live OpenRouter (`openai/gpt-4o-mini`, synthetic data) | job extraction 6–8 s (18 requirements, all excerpts traceable), resume extraction 7–10 s, score 79 — matches deterministic mode |

## 10. Browser verification (built-in browser, Vite dev server + isolated API/DB)

Register → Analyze (upload PDF + paste job) → result in <1 s (deterministic mode) → reload persisted → Overview metrics → resume details (8 years from dated roles, mismatch warning vs stated 6) → tracker saved and persisted → profile correction created v2 → "newer version" notice on v1 analysis → re-run (82) → Compare highlights Kubernetes change → report → history → settings → 404 → sign-out redirect with return path → second account sees "Not found" for first user's analysis and resume → malformed inputs (no file, short description, scanned PDF) show clear errors with form state kept → no horizontal overflow at 375 px on 14 pages; mobile drawer opens/closes. No console errors from current code. Screenshots were **not** captured because the browser pane was hidden during the session.

## 11. Remaining limitations

See README "Known limitations": taxonomy-based skill matching, wording-based responsibility matching, no OCR, per-process rate limiter, in-process background tasks, no email verification/password reset. Mobile layouts verified by automated overflow checks rather than visual review.

## 12. Manual follow-ups (priority order)

1. Review and commit the changes (nothing has been committed).
2. Back up the existing `resume_parser_ai_postgres_data` volume before running the new migration on it.
3. Visually review the UI (screenshots were not captured) and adjust copy/branding as desired.
4. For a public deployment: HTTPS with `SESSION_COOKIE_SECURE=true`, `ENVIRONMENT=production`, a shared rate-limit store, email verification and password reset.
5. After verifying converted data, add a migration that drops the legacy `evaluations`/`candidates` tables.
6. Optionally add Playwright browser tests to CI (the browser journey here was run interactively).
