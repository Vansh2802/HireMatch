"""Run the real Alembic migrations on a throwaway SQLite database populated with legacy data."""

import json
import tempfile
from datetime import datetime
from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config

from app.core.config import settings

BACKEND = Path(__file__).resolve().parents[1]


def _config() -> Config:
    config = Config(str(BACKEND / 'alembic.ini'))
    config.set_main_option('script_location', str(BACKEND / 'alembic'))
    return config


def test_upgrade_converts_legacy_data_without_loss(monkeypatch):
    with tempfile.TemporaryDirectory() as directory:
        url = f'sqlite:///{Path(directory, "legacy.db").as_posix()}'
        monkeypatch.setattr(settings, 'database_url', url)
        config = _config()
        command.upgrade(config, '20241014_02')

        engine = sa.create_engine(url)
        now = datetime(2024, 10, 20, 12, 0, 0)
        with engine.begin() as conn:
            conn.execute(sa.text("INSERT INTO users (id, email, password_hash, created_at) VALUES (1, 'old@example.com', 'x', :now)"), {'now': now})
            conn.execute(sa.text(
                'INSERT INTO evaluations (id, job_title, job_description, structured_job, status, created_at, updated_at, user_id) '
                'VALUES (1, :title, :desc, :job, :status, :now, :now, 1), (2, :title, :desc, NULL, :status, :now, :now, NULL)'
            ), {'title': 'Data Engineer', 'desc': 'Build pipelines', 'status': 'completed', 'now': now,
                'job': json.dumps({'required_skills': ['Python', 'SQL', 'python'], 'preferred_skills': ['Docker'], 'minimum_experience': 3})})
            conn.execute(sa.text(
                'INSERT INTO candidates (evaluation_id, candidate_name, structured_resume, match_score, verdict, evaluation_details, '
                'processing_status, file_name, created_at, updated_at) VALUES '
                "(1, 'Alex Example', :resume, 72, 'Good Match', :details, 'completed', 'alex.pdf', :now, :now), "
                "(1, 'Unparsed Candidate', '{}', NULL, NULL, NULL, 'failed', 'bad.pdf', :now, :now)"
            ), {'now': now, 'resume': json.dumps({'name': 'Alex Example', 'skills': ['Python'], 'total_experience_years': 4}),
                'details': json.dumps({'overall_explanation': 'Good Match based on alignment.'})})

        command.upgrade(config, 'head')

        with engine.connect() as conn:
            jobs = conn.execute(sa.text('SELECT user_id, title, status, profile FROM jobs')).all()
            assert len(jobs) == 1  # the ownerless legacy evaluation was never reachable
            profile = json.loads(jobs[0].profile)
            skills = [r['skill'] for r in profile['requirements'] if r['category'] == 'skill']
            assert skills == ['python', 'sql', 'docker'] and profile['method'] == 'legacy'
            assert all(r['uncertain'] for r in profile['requirements'])
            resumes = conn.execute(sa.text('SELECT id, title FROM resumes')).all()
            assert [r.title for r in resumes] == ['Alex Example']  # failed candidates had no data to keep
            analysis = conn.execute(sa.text('SELECT score, verdict, scoring_version, result FROM analyses')).one()
            assert (analysis.score, analysis.verdict, analysis.scoring_version) == (72, 'Good Match', '1.0')
            assert json.loads(analysis.result)['legacy'] is True
            # Legacy tables are retained untouched.
            assert conn.execute(sa.text('SELECT COUNT(*) FROM candidates')).scalar() == 2
            assert conn.execute(sa.text('SELECT COUNT(*) FROM evaluations')).scalar() == 2

        command.downgrade(config, '20241014_02')
        with engine.connect() as conn:
            assert 'jobs' not in sa.inspect(conn).get_table_names()
            assert conn.execute(sa.text('SELECT COUNT(*) FROM candidates')).scalar() == 2
        command.upgrade(config, 'head')
        engine.dispose()


def test_migrated_schema_matches_models(monkeypatch):
    from app.core.database import Base
    import app.models  # noqa: F401

    with tempfile.TemporaryDirectory() as directory:
        url = f'sqlite:///{Path(directory, "fresh.db").as_posix()}'
        monkeypatch.setattr(settings, 'database_url', url)
        command.upgrade(_config(), 'head')
        engine = sa.create_engine(url)
        inspector = sa.inspect(engine)
        for table in Base.metadata.sorted_tables:
            migrated = {column['name'] for column in inspector.get_columns(table.name)}
            assert set(table.columns.keys()) <= migrated, table.name
            migrated_indexes = {index['name'] for index in inspector.get_indexes(table.name)}
            model_indexes = {index.name for index in table.indexes}
            assert model_indexes <= migrated_indexes, (table.name, model_indexes - migrated_indexes)
        engine.dispose()
