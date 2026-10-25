"""Job-seeker domain model: resumes, resume versions, jobs and analyses.

Legacy ``evaluations``/``candidates`` rows that have an owner are converted:

* each legacy evaluation becomes a saved job (requirements marked as legacy/uncertain),
* each successfully processed legacy candidate becomes a resume with one version
  (the original document text was never stored, so ``raw_text`` is empty),
* each scored legacy candidate becomes an analysis with ``scoring_version = '1.0'``.

The legacy tables are left untouched so nothing is lost; they can be dropped in a later
migration once the converted data has been verified. Rows without an owner (created
before authentication existed) were never reachable and are not converted.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = '20261025_03'
down_revision = '20241014_02'
branch_labels = None
depends_on = None

LEGACY_NOTE = (
    'Imported from an earlier version of HireMatch. The original document text was not kept, '
    'so evidence excerpts are unavailable. Upload the file again for a full analysis.'
)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _json(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    user_columns = {column['name'] for column in inspector.get_columns('users')}
    if 'onboarding_dismissed_at' not in user_columns:
        op.add_column('users', sa.Column('onboarding_dismissed_at', sa.DateTime(), nullable=True))

    if 'resumes' not in tables:
        op.create_table(
            'resumes',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE', name='fk_resumes_user_id_users'), nullable=False),
            sa.Column('title', sa.String(200), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
        )
        op.create_index('ix_resumes_user_id', 'resumes', ['user_id'])

    if 'resume_versions' not in tables:
        op.create_table(
            'resume_versions',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('resume_id', sa.Integer(), sa.ForeignKey('resumes.id', ondelete='CASCADE', name='fk_resume_versions_resume_id_resumes'), nullable=False),
            sa.Column('version_number', sa.Integer(), nullable=False),
            sa.Column('source', sa.String(20), nullable=False),
            sa.Column('status', sa.String(20), nullable=False),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('file_name', sa.String(255), nullable=True),
            sa.Column('file_size', sa.Integer(), nullable=True),
            sa.Column('file_sha256', sa.String(64), nullable=True),
            sa.Column('page_count', sa.Integer(), nullable=True),
            sa.Column('raw_text', sa.Text(), nullable=False),
            sa.Column('profile', sa.JSON(), nullable=True),
            sa.Column('warnings', sa.JSON(), nullable=True),
            sa.Column('extraction_method', sa.String(20), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('processing_started_at', sa.DateTime(), nullable=True),
            sa.Column('processed_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('resume_id', 'version_number', name='uq_resume_versions_resume_number'),
        )
        op.create_index('ix_resume_versions_resume_id', 'resume_versions', ['resume_id'])
        op.create_index('ix_resume_versions_file_sha256', 'resume_versions', ['file_sha256'])

    if 'jobs' not in tables:
        op.create_table(
            'jobs',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE', name='fk_jobs_user_id_users'), nullable=False),
            sa.Column('title', sa.String(200), nullable=False),
            sa.Column('company', sa.String(200), nullable=True),
            sa.Column('location', sa.String(200), nullable=True),
            sa.Column('url', sa.String(1000), nullable=True),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('status', sa.String(20), nullable=False),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('revision', sa.Integer(), nullable=False),
            sa.Column('profile', sa.JSON(), nullable=True),
            sa.Column('processing_started_at', sa.DateTime(), nullable=True),
            sa.Column('stage', sa.String(20), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('applied_on', sa.Date(), nullable=True),
            sa.Column('follow_up_on', sa.Date(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
        )
        op.create_index('ix_jobs_user_id', 'jobs', ['user_id'])
        op.create_index('ix_jobs_user_updated', 'jobs', ['user_id', 'updated_at'])

    if 'analyses' not in tables:
        op.create_table(
            'analyses',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE', name='fk_analyses_user_id_users'), nullable=False),
            sa.Column('resume_id', sa.Integer(), sa.ForeignKey('resumes.id', ondelete='CASCADE', name='fk_analyses_resume_id_resumes'), nullable=False),
            sa.Column('resume_version_id', sa.Integer(), sa.ForeignKey('resume_versions.id', ondelete='CASCADE', name='fk_analyses_resume_version_id_resume_versions'), nullable=False),
            sa.Column('job_id', sa.Integer(), sa.ForeignKey('jobs.id', ondelete='SET NULL', name='fk_analyses_job_id_jobs'), nullable=True),
            sa.Column('job_revision', sa.Integer(), nullable=True),
            sa.Column('job_snapshot', sa.JSON(), nullable=False),
            sa.Column('resume_title', sa.String(200), nullable=False),
            sa.Column('resume_version_number', sa.Integer(), nullable=True),
            sa.Column('score', sa.Integer(), nullable=True),
            sa.Column('verdict', sa.String(40), nullable=False),
            sa.Column('confidence', sa.String(10), nullable=True),
            sa.Column('scoring_version', sa.String(20), nullable=False),
            sa.Column('result', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.UniqueConstraint('user_id', 'resume_version_id', 'job_id', 'job_revision', 'scoring_version', name='uq_analyses_inputs'),
        )
        for name, columns in (
            ('ix_analyses_user_id', ['user_id']),
            ('ix_analyses_resume_id', ['resume_id']),
            ('ix_analyses_resume_version_id', ['resume_version_id']),
            ('ix_analyses_job_id', ['job_id']),
            ('ix_analyses_user_created', ['user_id', 'created_at']),
        ):
            op.create_index(name, 'analyses', columns)

    if {'evaluations', 'candidates'} <= tables:
        _convert_legacy_data(bind)


def _legacy_job_profile(structured: dict | None) -> dict:
    from app.services.skill_normalizer import normalize_skill, skill_label

    structured = structured or {}
    requirements: list[dict] = []

    def add(**kwargs):
        requirements.append({
            'id': f'r{len(requirements) + 1}', 'importance': 'required', 'skill': None, 'years': None,
            'degree_level': None, 'source_excerpt': None, 'uncertain': True, **kwargs,
        })

    seen: set[str] = set()
    for importance, key in (('required', 'required_skills'), ('preferred', 'preferred_skills')):
        for value in structured.get(key) or []:
            if not isinstance(value, str) or not value.strip():
                continue
            skill = normalize_skill(value)
            if skill in seen:
                continue
            seen.add(skill)
            add(category='skill', importance=importance, text=skill_label(skill)[:500], skill=skill[:120])
    years = structured.get('minimum_experience')
    if isinstance(years, (int, float)) and 0 < years <= 40:
        add(category='experience', text=f'{years:g}+ years of relevant experience', years=float(years))
    for value in (structured.get('education_requirements') or [])[:2]:
        if isinstance(value, str) and value.strip():
            add(category='education', text=value.strip()[:500])
    for value in (structured.get('relevant_certifications') or [])[:5]:
        if isinstance(value, str) and value.strip():
            add(category='certification', text=value.strip()[:500])
    for value in (structured.get('responsibilities') or [])[:10]:
        if isinstance(value, str) and len(value.strip()) > 3:
            add(category='responsibility', text=value.strip()[:500])
    return {
        'seniority': structured.get('seniority') if isinstance(structured.get('seniority'), str) else None,
        'requirements': requirements,
        'method': 'legacy',
        'warnings': [
            'Imported from an earlier version of HireMatch. These requirements could not be traced to lines of the '
            'description and are marked uncertain. Use "Re-extract requirements" for an up-to-date analysis.'
        ],
    }


def _legacy_resume_profile(structured: dict | None) -> dict:
    structured = structured or {}

    def text(value, limit):
        return value.strip()[:limit] if isinstance(value, str) and value.strip() else None

    years = structured.get('total_experience_years')
    return {
        'name': text(structured.get('name'), 200),
        'email': text(structured.get('email'), 320),
        'phone': text(structured.get('phone'), 60),
        'location': None,
        'headline': None,
        'summary': None,
        'skills': [s.strip()[:120] for s in structured.get('skills') or [] if isinstance(s, str) and s.strip()][:200],
        'experiences': [
            {'title': text(e.get('role'), 300), 'company': text(e.get('company'), 300), 'location': None,
             'start': text(e.get('duration'), 40), 'end': None, 'description': text(e.get('description'), 6000)}
            for e in structured.get('experiences') or [] if isinstance(e, dict)
        ][:60],
        'education': [
            {'degree': text(e.get('degree'), 300), 'field': text(e.get('field'), 300), 'institution': text(e.get('institution'), 300),
             'start': None, 'end': text(e.get('period'), 40)}
            for e in structured.get('education') or [] if isinstance(e, dict)
        ][:20],
        'projects': [
            {'name': text(p.get('name'), 300), 'description': text(p.get('description'), 4000),
             'technologies': [t[:120] for t in p.get('technologies') or [] if isinstance(t, str)][:50]}
            for p in structured.get('projects') or [] if isinstance(p, dict)
        ][:40],
        'certifications': [c.strip()[:120] for c in structured.get('certifications') or [] if isinstance(c, str) and c.strip()][:60],
        'total_experience_years': float(years) if isinstance(years, (int, float)) and 0 <= years <= 60 else None,
        'experience_years_source': 'stated' if isinstance(years, (int, float)) else None,
    }


def _convert_legacy_data(bind) -> None:
    meta = sa.MetaData()
    evaluations = sa.Table('evaluations', meta, autoload_with=bind)
    candidates = sa.Table('candidates', meta, autoload_with=bind)
    if 'user_id' not in evaluations.c:
        return
    resumes = sa.table('resumes', sa.column('id', sa.Integer), sa.column('user_id', sa.Integer), sa.column('title', sa.String),
                       sa.column('created_at', sa.DateTime), sa.column('updated_at', sa.DateTime))
    versions = sa.table('resume_versions', *(sa.column(name, type_) for name, type_ in (
        ('id', sa.Integer), ('resume_id', sa.Integer), ('version_number', sa.Integer), ('source', sa.String), ('status', sa.String),
        ('file_name', sa.String), ('raw_text', sa.Text), ('profile', sa.JSON), ('warnings', sa.JSON), ('extraction_method', sa.String),
        ('created_at', sa.DateTime), ('processed_at', sa.DateTime))))
    jobs = sa.table('jobs', *(sa.column(name, type_) for name, type_ in (
        ('id', sa.Integer), ('user_id', sa.Integer), ('title', sa.String), ('description', sa.Text), ('status', sa.String),
        ('revision', sa.Integer), ('profile', sa.JSON), ('stage', sa.String), ('created_at', sa.DateTime), ('updated_at', sa.DateTime))))
    analyses = sa.table('analyses', *(sa.column(name, type_) for name, type_ in (
        ('user_id', sa.Integer), ('resume_id', sa.Integer), ('resume_version_id', sa.Integer), ('job_id', sa.Integer),
        ('job_revision', sa.Integer), ('job_snapshot', sa.JSON), ('resume_title', sa.String), ('resume_version_number', sa.Integer),
        ('score', sa.Integer), ('verdict', sa.String), ('confidence', sa.String), ('scoring_version', sa.String),
        ('result', sa.JSON), ('created_at', sa.DateTime))))

    owned = bind.execute(sa.select(evaluations).where(evaluations.c.user_id.isnot(None)).order_by(evaluations.c.id)).mappings().all()
    for evaluation in owned:
        created = evaluation['created_at'] or _now()
        profile = _legacy_job_profile(_json(evaluation['structured_job']))
        job_id = bind.execute(jobs.insert().values(
            user_id=evaluation['user_id'], title=(evaluation['job_title'] or 'Untitled job')[:200],
            description=evaluation['job_description'] or '', status='ready', revision=1, profile=profile,
            stage='interested', created_at=created, updated_at=evaluation['updated_at'] or created,
        ).returning(jobs.c.id)).scalar_one()

        rows = bind.execute(
            sa.select(candidates).where(candidates.c.evaluation_id == evaluation['id'], candidates.c.processing_status == 'completed')
            .order_by(candidates.c.id)
        ).mappings().all()
        for candidate in rows:
            c_created = candidate['created_at'] or created
            title = (candidate['candidate_name'] or candidate['file_name'] or 'Imported resume')[:200]
            resume_id = bind.execute(resumes.insert().values(
                user_id=evaluation['user_id'], title=title, created_at=c_created, updated_at=c_created,
            ).returning(resumes.c.id)).scalar_one()
            version_id = bind.execute(versions.insert().values(
                resume_id=resume_id, version_number=1, source='legacy', status='ready', file_name=candidate['file_name'],
                raw_text='', profile=_legacy_resume_profile(_json(candidate['structured_resume'])), warnings=[LEGACY_NOTE],
                extraction_method='legacy', created_at=c_created, processed_at=c_created,
            ).returning(versions.c.id)).scalar_one()
            details = _json(candidate['evaluation_details']) or {}
            bind.execute(analyses.insert().values(
                user_id=evaluation['user_id'], resume_id=resume_id, resume_version_id=version_id, job_id=job_id, job_revision=1,
                job_snapshot={'title': evaluation['job_title'], 'company': None, 'location': None, 'url': None,
                              'description': evaluation['job_description'], 'profile': profile},
                resume_title=title, resume_version_number=1, score=candidate['match_score'],
                verdict=(candidate['verdict'] or 'Legacy result')[:40], confidence=None, scoring_version='1.0',
                result={'legacy': True, 'summary': details.get('overall_explanation'), 'details': details},
                created_at=c_created,
            ))


def downgrade() -> None:
    # Converted legacy data is still present in the untouched legacy tables.
    for index in ('ix_analyses_user_created', 'ix_analyses_job_id', 'ix_analyses_resume_version_id', 'ix_analyses_resume_id', 'ix_analyses_user_id'):
        op.drop_index(index, table_name='analyses')
    op.drop_table('analyses')
    op.drop_index('ix_jobs_user_updated', table_name='jobs')
    op.drop_index('ix_jobs_user_id', table_name='jobs')
    op.drop_table('jobs')
    op.drop_index('ix_resume_versions_file_sha256', table_name='resume_versions')
    op.drop_index('ix_resume_versions_resume_id', table_name='resume_versions')
    op.drop_table('resume_versions')
    op.drop_index('ix_resumes_user_id', table_name='resumes')
    op.drop_table('resumes')
    with op.batch_alter_table('users') as batch:
        batch.drop_column('onboarding_dismissed_at')
