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
- AI enrichment: Groq-compatible model access with explicit deterministic mock mode
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
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
MAX_UPLOAD_SIZE_MB=10
MAX_PAGES_PER_DOCUMENT=80
UPLOAD_DIR=uploads
TEMP_DIR=temp
MOCK_LLM=true
```

Notes:

- `MOCK_LLM=true` always uses deterministic local extraction and reports `llm: mock` from the health endpoint.
- `MOCK_LLM=false` requires `GROQ_API_KEY`; provider failures are reported as failed processing instead of fake successful analysis.
- `DATABASE_URL` is used by direct local backend runs. Compose overrides it with the PostgreSQL service hostname `db`.
- Never commit `.env`, uploaded resumes, temporary files, or database files.

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

The health response reports application status plus non-secret database and LLM states, for example `database: ok` and `llm: mock`.

## Backend tests

```bash
cd .
$env:PYTHONPATH='backend'
.\.venv\Scripts\python.exe -m pytest backend/tests -q
```

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
- The Groq integration is optional and can be mocked locally.
- Resume parsing is heuristic and best-effort; it is suitable for local prototypes and internal tooling.
- Local file storage is volume-backed in Compose but is not yet object storage or multi-tenant storage.
- The application has no authentication or authorization; it is a local prototype and must not be exposed as a shared production service.
- Uploaded text is treated as untrusted input, but a production deployment should add stronger isolation, retention, and provider-side prompt controls.

## Troubleshooting

- `Failed to fetch`: check `http://localhost:8000/api/health`, confirm the API container is `Up`, and verify `VITE_API_URL` points to the browser-reachable API URL.
- PostgreSQL port conflict: the Compose database is intentionally not published to host port `5432`; stop another Compose project only if it is competing for the API port `8000`.
- API exits on startup: inspect `docker compose logs --tail=200 api`; common causes are invalid environment values or a database that is not healthy yet.
- Upload processing fails: check the per-file result in the response, then inspect the API logs. Invalid, empty, corrupt, oversized, and unsupported files are recorded individually.

## Manual setup notes

1. Create a `.env` file from `.env.example`.
2. Install Python dependencies in the project virtual environment.
3. Install frontend dependencies with `npm install` in the `frontend` directory.
4. Start the backend and frontend in separate terminals.
5. Open the frontend in the browser and create an evaluation to begin uploading candidate documents.
