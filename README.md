# HireMatch

**The Right Resume. The Right Opportunity.**

HireMatch helps job seekers see how well their resume matches a specific job description. It answers five questions:

1. How well does my resume match this job?
2. Which requirements does my resume already evidence?
3. Which important requirements are missing or weakly evidenced?
4. Why did HireMatch produce this result?
5. What should I improve next?

A match score describes how clearly a resume evidences a posting's *stated* requirements. It is not a prediction of interviews, offers or hiring decisions.

## Features

- **Resume library with versions** — upload PDF/DOCX, review what was extracted, correct it (saved as a new version), upload revised files as new versions. Earlier analyses always keep the version they used.
- **Saved jobs** — paste a posting; requirements are extracted with the line they came from, split into required/preferred, and marked *uncertain* when the posting is ambiguous. You can remove misread requirements or change their importance.
- **Explainable analysis** — every requirement is checked against the resume text: *evidenced*, *partly evidenced*, *not found* (not proof you lack it), or *could not check* (excluded from the score). Each finding shows the resume excerpt behind it.
- **Action plan** — prioritised gaps with why they matter and what to do, without encouraging invented experience.
- **History, comparison and reports** — immutable analysis history, side-by-side comparison (same job across resume versions, or one resume across jobs), printable report.
- **Application tracker** — stages (Interested → Archived), applied/follow-up dates and notes per job.
- **Privacy controls** — original files are never stored; delete any record; change password; sign out everywhere; delete the account and all data.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, react-router, lucide-react |
| Backend | FastAPI, Pydantic 2, SQLAlchemy 2, Alembic |
| Database | PostgreSQL 16 (Docker) or SQLite (local development) |
| Document reading | `pypdf`, `python-docx`; structured extraction by OpenRouter (or deterministic built-in rules) |
| Auth | Argon2 password hashes, opaque server-side sessions in HttpOnly SameSite cookies |
| Deploy | Docker Compose: `db` (Postgres), `api` (FastAPI), `web` (nginx serving the SPA and proxying `/api`) |

```
backend/app
├── api/routes        auth, dashboard, resumes, jobs, analyses, health
├── models            User, AuthSession, Resume, ResumeVersion, Job, Analysis
├── schemas           Pydantic request/response and extraction contracts
└── services
    ├── document_parser / file_validation   upload validation and text extraction
    ├── resume_extractor / job_extractor    heuristic + LLM extraction, cross-checked against the text
    ├── skill_normalizer / text_analysis    skill taxonomy, sections, dates, degrees
    ├── matching_service                    deterministic scoring (methodology v2.0)
    ├── processing                          background extraction with persisted status
    └── llm_service                         OpenRouter client (budgets, retries, safe errors)
frontend/src
├── components/ui     design-system primitives (Button, Field, Dialog, Toast, Badge, ScoreDial, …)
├── components        AppShell, PublicLayout, AnalysisParts, ProfileEditor, JobForm, …
├── pages             Landing, Methodology, Login, Dashboard, Analyze, Resumes, Jobs, Analyses, Compare, Settings, …
└── lib               typed API client, types, formatting, polling
```

### Processing model

Uploads are validated and parsed synchronously (fast; bad files are rejected immediately with a clear message). Structured extraction — an LLM call in production — runs as a FastAPI background task; its status (`processing` / `ready` / `failed`) is stored on the record and the UI polls it. Failed extraction can be retried without re-uploading. Work interrupted by a restart is marked failed (retryable) on startup. Scoring itself is pure code and takes milliseconds. Repeating an analysis with identical inputs returns the existing result instead of creating a duplicate.

### Scoring (methodology v2.0)

See the in-app page **How scoring works** (`/how-it-works`). In short: required skills 45%, experience 20%, responsibilities 15%, education & certifications 10%, preferred skills 10%; components with no requirements are excluded and the rest renormalised; uncertain/preferred items count half; unverifiable requirements are excluded rather than scored; below 40% evidence coverage no score is produced. The scoring version is stored with every analysis.

## Run locally

Requirements: Python 3.11+, Node 22+.

```bash
cp .env.example .env            # MOCK_LLM=true works without any AI provider
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements.txt   # macOS/Linux: .venv/bin/pip
```

Backend (from `backend/`):

```bash
cd backend
../.venv/Scripts/python -m alembic upgrade head
../.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

Frontend (in another terminal):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `http://127.0.0.1:8000` (override with `VITE_DEV_API_PROXY`), so the browser talks to one origin.

> The backend reads the repository-root `.env` (or `backend/.env`, which takes priority). With the default `DATABASE_URL`, the SQLite file is created next to where you start the server.

### Docker Compose

```bash
docker compose up --build -d
```

- App: http://localhost:8080 (nginx serves the SPA and proxies `/api`)
- API docs: http://localhost:8000/docs (disabled when `ENVIRONMENT=production`)
- Ports are configurable with `WEB_PORT` / `API_PORT`.

The API runs `alembic upgrade head` on start. Do not use `docker compose down -v` unless you intend to delete the database volume.

### AI provider

Set `MOCK_LLM=false`, `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`). The key stays on the server. Contact details are redacted before resume text is sent. Model output is validated against Pydantic schemas, skills not present in the document are dropped, and requirement excerpts that cannot be found in the posting are marked uncertain. Provider errors are mapped to safe messages; transient failures are retried with backoff inside a total time budget (`LLM_TOTAL_BUDGET_SECONDS`).

## Tests

```bash
cd backend && ../.venv/Scripts/python -m pytest -q     # unit, API, access control, migrations
cd backend && ../.venv/Scripts/python -m ruff check .
cd frontend && npm test                                 # component, routing, API client
cd frontend && npm run build                            # type-check + production build
```

Backend tests always use a throwaway SQLite file and the deterministic extractor — never a developer database or the paid provider (`tests/conftest.py` refuses to run against a non-test database).

## Migrations

`20261025_03_job_seeker_model` adds `resumes`, `resume_versions`, `jobs` and `analyses` and converts data from the earlier recruiter-oriented `evaluations`/`candidates` tables (owned rows only). The legacy tables are left untouched so nothing is lost; drop them in a later migration once you have verified the converted data. Imported analyses are labelled as scoring method v1.0.

## Known limitations

- Skill matching relies on a curated taxonomy with aliases; very new or niche tools may be missed by the built-in rules (the LLM path extracts them, but they are still matched literally).
- Responsibility matching compares wording, so equivalent work described differently may be reported as not found.
- Scanned (image-only) PDFs are rejected; there is no OCR.
- The rate limiter is in-memory and per process; use a shared store for multiple workers.
- Background extraction runs in the API process; a dedicated queue would be needed for high volume.
- No email verification or password reset flow yet.
