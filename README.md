# HireMatch

HireMatch is an AI-powered resume evaluation and job matching platform. It lets recruiters or hiring teams:

- create a job evaluation
- upload candidate resumes in PDF or DOCX format
- extract structured resume and job details
- score candidates against the role
- rank and review candidate fit
- review candidate-level explanations and raw extraction data

## Tech stack

- Backend: FastAPI + SQLAlchemy + Pydantic + SQLite (local dev)
- AI enrichment: Groq-compatible model access with a mock fallback mode
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
├── hirematch.db
├── pyproject.toml
└── src/
    └── resume_parser_ai/
```

## Environment variables

Copy `.env.example` to `.env` and update the values as needed:

```env
APP_NAME=HireMatch
DATABASE_URL=sqlite:///./hirematch.db
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

- If `GROQ_API_KEY` is empty, the app falls back to deterministic mock data so local development can still run.
- `DATABASE_URL` can be switched to PostgreSQL for a production deployment later.

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

## Known limitations

- File storage is local-disk based rather than production cloud storage.
- The Groq integration is optional and can be mocked locally.
- Resume parsing is heuristic and best-effort; it is suitable for local prototypes and internal tooling.
- The application currently uses SQLite for local development and may need a production-ready database setup before wider deployment.

## Manual setup notes

1. Create a `.env` file from `.env.example`.
2. Install Python dependencies in the project virtual environment.
3. Install frontend dependencies with `npm install` in the `frontend` directory.
4. Start the backend and frontend in separate terminals.
5. Open the frontend in the browser and create an evaluation to begin uploading candidate documents.
