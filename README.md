# HireMatch

HireMatch is an AI-powered resume evaluation and job matching platform. It lets recruiters or hiring teams:

- create a job evaluation
- upload candidate resumes in PDF or DOCX format
- extract structured resume and job details
- score candidates against the role
- rank and review candidate fit
- review candidate-level explanations and raw extraction data

## Tech stack

- Backend: FastAPI + SQLAlchemy + Pydantic
- Database: SQLite for direct local development, PostgreSQL 16 for Docker Compose
- AI enrichment: OpenRouter-compatible chat completions with explicit deterministic mock mode
- Authentication: Argon2 password hashes with server-side opaque sessions in HttpOnly cookies
- Parsing: `pypdf` and `python-docx`
- Frontend: React + TypeScript + Vite + Tailwind CSS + TanStack Query
- Testing: pytest for backend and Vitest for frontend

## Project structure

```text
.
├── .env.example
├── .env
├── README.md
├── backend/
│   ├── alembic/
│   ├── app/
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── alembic.ini
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── vitest.config.ts
├── pyproject.toml
└── src/
    └── resume_parser_ai/
```

## Environment variables

Copy `.env.example` to `.env` and update the values as needed:

```env
APP_NAME=HireMatch
DATABASE_URL=sqlite:///./hirematch.db
POSTGRES_DB=hirematch
POSTGRES_USER=hirematch
POSTGRES_PASSWORD=change-me-for-shared-environments
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=http://localhost:5173
LLM_PROVIDER=openrouter
LLM_TIMEOUT_SECONDS=30
SESSION_COOKIE_NAME=hirematch_session
SESSION_COOKIE_SECURE=false
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
MAX_UPLOAD_SIZE_MB=10
MAX_FILES_PER_REQUEST=10
MAX_PAGES_PER_DOCUMENT=80
MAX_JOB_DESCRIPTION_CHARS=12000
MAX_RESUME_TEXT_CHARS=12000
RATE_LIMIT_PER_MINUTE=20
UPLOAD_DIR=uploads
TEMP_DIR=temp
MOCK_LLM=true
```

Notes:

- `MOCK_LLM=true` always uses deterministic local extraction and reports `llm: mock` from the health endpoint.
- `MOCK_LLM=false` requires `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`; provider failures are reported as failed processing instead of fake successful analysis.
- Obtain an API key from OpenRouter and keep it server-side. Never use a `VITE_` variable for this key.
- The configured model must be an OpenRouter model identifier available to your account. The default is `openai/gpt-4o-mini`; change `OPENROUTER_MODEL` without editing code.
- `DATABASE_URL` is used by direct local backend runs. Compose overrides it with the PostgreSQL service hostname `db`.
- Never commit `.env`, uploaded resumes, temporary files, or database files.
- Set `SESSION_COOKIE_SECURE=true` behind HTTPS in shared/production environments.

## Run the backend

From the repository root:

```bash
$env:PYTHONPATH='backend'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

If you are using a Unix-like shell:

```bash
export PYTHONPATH=backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite app will usually run on `http://localhost:5173`.

For a non-default API location, set `VITE_API_URL` in `frontend/.env.local`. The default is `http://localhost:8000`.

The first screen is the login/register flow. Passwords are hashed server-side; session tokens are opaque, stored as hashes in the database, and sent to the browser only as HttpOnly cookies. Private evaluations and candidates are filtered by owner on the backend.

## Docker Compose

Docker Desktop must be running. From the repository root:

```powershell
docker compose config
docker compose up --build -d
docker compose ps
docker compose logs --tail=200 api
docker compose logs --tail=200 db
```

The API container waits for PostgreSQL health, runs `alembic upgrade head`, and then starts FastAPI. PostgreSQL is private to the Compose network and persists in the `postgres_data` volume. The API is exposed at `http://localhost:8000`; the separately started Vite frontend uses that host URL.

Stop the stack without deleting data:

```powershell
docker compose down
```

Do not use `docker compose down -v` unless you explicitly intend to remove the database and uploaded-file volumes.

## Health and API documentation

- Root: `http://localhost:8000/`
- Health: `http://localhost:8000/api/health`
- OpenAPI UI: `http://localhost:8000/docs`

The health response reports application status plus non-secret database and LLM states, including provider, configured model, mock/configuration state, and `provider_connectivity: unknown`. It does not make a paid provider request during health checks.

## Scoring model

Scores are deterministic decision-support signals, not hiring decisions. When the corresponding job criterion is present, the default weights are:

- Required skills: 40%
- Experience: 25%
- Responsibility alignment: 20%
- Education and certifications combined: 10%
- Preferred skills: 5%

Unavailable criteria are excluded and the remaining applicable weights are normalized. Missing evidence is reported as unverified rather than treated as proof of absence or qualification. Scores are clamped to 0-100 and verdict thresholds are consistent with the final score.

## Backend tests

```bash
cd .
$env:PYTHONPATH='backend'
.\.venv\Scripts\python.exe -m pytest backend/tests -q
```

Tests force `MOCK_LLM=true` and use an isolated ignored SQLite database, so they do not depend on developer credentials or existing application data.

## Frontend tests

```bash
cd frontend
npm test
```

## Build check

```bash
cd frontend
npm run build
```

## Migrations

Compose runs migrations automatically. For direct local backend work, set `DATABASE_URL` and run from `backend`:

```powershell
alembic -c alembic.ini upgrade head
```

## Known limitations

- File storage is local-disk based rather than production cloud storage.
- OpenRouter integration is optional for local development and can be replaced by explicit mock mode.
- Resume parsing is heuristic and best-effort; it is suitable for local prototypes and internal tooling.
- Local file storage is volume-backed in Compose but is not yet object storage or multi-tenant storage.
- Authentication is suitable for this single-service prototype, but public deployment still needs HTTPS, secret management, account recovery, email verification, and operational session revocation controls.
- The local in-memory rate limiter is per process and is not a distributed limiter across multiple workers.
- Uploaded text is treated as untrusted input, but a production deployment should add stronger isolation, retention, and provider-side prompt controls.

## Troubleshooting

- `Failed to fetch`: check `http://localhost:8000/api/health`, confirm the API container is `Up`, and verify `VITE_API_URL` points to the browser-reachable API URL.
- PostgreSQL port conflict: the Compose database is intentionally not published to host port `5432`; stop another Compose project only if it is competing for the API port `8000`.
- API exits on startup: inspect `docker compose logs --tail=200 api`; common causes are invalid environment values or a database that is not healthy yet.
- OpenRouter authentication/model errors: verify `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and `LLM_PROVIDER=openrouter`; the key is only read by the backend.
- Structured-output errors: use a model that can follow JSON-only prompts. The client strips JSON fences, validates Pydantic schemas, and performs one bounded repair attempt.
- Upload processing fails: check the per-file result in the response, then inspect the API logs. Invalid, empty, corrupt, oversized, and unsupported files are recorded individually.

## Manual setup notes

1. Create a `.env` file from `.env.example`.
2. Install Python dependencies in the project virtual environment.
3. Install frontend dependencies with `npm install` in the `frontend` directory.
4. Start the backend and frontend in separate terminals.
5. Open the frontend in the browser and create an evaluation to begin uploading candidate documents.
