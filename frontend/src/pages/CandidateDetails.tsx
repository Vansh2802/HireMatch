import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  GraduationCap,
  Mail,
  Phone,
  TrendingUp,
  User,
  XCircle,
} from 'lucide-react';
import { fetchCandidate } from '../lib/api';

interface StructuredResume {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  skills?: string[];
  total_experience_years?: number | null;
  experiences?: Array<{ company?: string; title?: string; duration?: string; description?: string }>;
  education?: Array<{ institution?: string; degree?: string; field?: string; year?: string }>;
  certifications?: string[];
  notes?: string[];
}

interface EvaluationDetails {
  score?: number;
  verdict?: string;
  matching_skills?: string[];
  missing_skills?: string[];
  preferred_skills_found?: string[];
  unverified_requirements?: string[];
  strengths?: string[];
  areas_for_review?: string[];
  overall_explanation?: string;
  relevant_experience_evidence?: string[];
  details?: Record<string, unknown>;
}

interface CandidateData {
  id: number;
  candidate_name: string;
  email?: string | null;
  phone?: string | null;
  match_score?: number | null;
  verdict?: string | null;
  processing_status: string;
  error_message?: string | null;
  evaluation_id?: number;
  structured_resume?: StructuredResume;
  evaluation_details?: EvaluationDetails;
  file_name?: string | null;
}

export default function CandidateDetails() {
  const { id } = useParams();
  const candidateId = Number(id ?? 0);
  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: () => fetchCandidate(candidateId),
    enabled: Boolean(id),
  });

  if (isLoading) return <CandidateSkeleton />;

  if (error || !rawData) {
    return (
      <div className="alert-error" role="alert">
        {error instanceof Error ? error.message : 'Unable to load candidate.'}
      </div>
    );
  }

  const data = rawData as unknown as CandidateData;
  const resume = (data.structured_resume ?? {}) as StructuredResume;
  const evalDetails = (data.evaluation_details ?? {}) as EvaluationDetails;

  const score = data.match_score ?? evalDetails.score ?? null;
  const scoreColor =
    score === null ? '' : score >= 70 ? 'text-success' : score >= 45 ? 'text-warning' : 'text-error';
  const scoreBg =
    score === null ? 'bg-ivory-200' : score >= 70 ? 'bg-success-light' : score >= 45 ? 'bg-warning-light' : 'bg-error-light';

  const evaluationId = data.evaluation_id;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      {evaluationId && (
        <Link
          to={`/evaluations/${evaluationId}`}
          className="btn-ghost inline-flex gap-1.5 p-0 text-xs text-ink-muted"
        >
          <ArrowLeft size={12} />
          Back to evaluation
        </Link>
      )}

      {/* Profile header */}
      <div className="card p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {/* Avatar placeholder */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl font-bold text-brand-600">
              {(data.candidate_name || 'C').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="page-heading">{data.candidate_name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-secondary">
                {(data.email || resume.email) && (
                  <a href={`mailto:${data.email || resume.email}`} className="flex items-center gap-1.5 transition hover:text-brand-600">
                    <Mail size={13} />
                    {data.email || resume.email}
                  </a>
                )}
                {(data.phone || resume.phone) && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} />
                    {data.phone || resume.phone}
                  </span>
                )}
                {resume.total_experience_years && (
                  <span className="flex items-center gap-1.5">
                    <TrendingUp size={13} />
                    {resume.total_experience_years}+ years experience
                  </span>
                )}
              </div>
              {data.file_name && (
                <p className="mt-2 text-xs text-ink-muted">Source: {data.file_name}</p>
              )}
            </div>
          </div>

          {/* Score */}
          {score !== null && (
            <div className={`shrink-0 rounded-lg ${scoreBg} px-5 py-4 text-center`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-secondary">Match score</p>
              <p className={`mt-1 text-4xl font-bold tabular-nums ${scoreColor}`}>{score}%</p>
              {(data.verdict || evalDetails.verdict) && (
                <p className="mt-1 text-sm font-medium text-ink-secondary">{data.verdict || evalDetails.verdict}</p>
              )}
            </div>
          )}
        </div>

        {/* Overall explanation */}
        {evalDetails.overall_explanation && (
          <p className="mt-5 border-t border-border-light pt-4 text-sm leading-relaxed text-ink-secondary">
            {evalDetails.overall_explanation}
          </p>
        )}
      </div>

      {/* Failed state */}
      {data.processing_status === 'failed' && (
        <div className="alert-error flex items-start gap-2" role="alert">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Processing failed</p>
            {data.error_message && <p className="mt-0.5 text-sm">{data.error_message}</p>}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Matching skills */}
        {(evalDetails.matching_skills?.length ?? 0) > 0 || (evalDetails.missing_skills?.length ?? 0) > 0 ? (
          <div className="card p-5">
            <h2 className="section-heading mb-4 flex items-center gap-2">
              <Award size={16} className="text-brand-600" />
              Skills assessment
            </h2>

            {evalDetails.matching_skills && evalDetails.matching_skills.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-success">
                  <CheckCircle2 size={12} />
                  Matching skills ({evalDetails.matching_skills.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {evalDetails.matching_skills.map((skill) => (
                    <span key={skill} className="status-chip status-completed">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {evalDetails.missing_skills && evalDetails.missing_skills.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-error">
                  <XCircle size={12} />
                  Missing required skills ({evalDetails.missing_skills.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {evalDetails.missing_skills.map((skill) => (
                    <span key={skill} className="status-chip status-failed">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {evalDetails.preferred_skills_found && evalDetails.preferred_skills_found.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-warning">
                  Preferred skills found ({evalDetails.preferred_skills_found.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {evalDetails.preferred_skills_found.map((skill) => (
                    <span key={skill} className="status-chip status-processing">{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : resume.skills && resume.skills.length > 0 ? (
          <div className="card p-5">
            <h2 className="section-heading mb-4 flex items-center gap-2">
              <Award size={16} className="text-brand-600" />
              Skills
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {resume.skills.map((skill) => (
                <span key={skill} className="status-chip status-pending">{skill}</span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Strengths & areas for review */}
        {((evalDetails.strengths?.length ?? 0) > 0 || (evalDetails.areas_for_review?.length ?? 0) > 0) && (
          <div className="card p-5">
            <h2 className="section-heading mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-600" />
              Evaluation summary
            </h2>

            {evalDetails.strengths && evalDetails.strengths.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold text-success">Strengths</p>
                <ul className="space-y-1.5">
                  {evalDetails.strengths.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm text-ink-secondary">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evalDetails.areas_for_review && evalDetails.areas_for_review.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-warning">Areas for review</p>
                <ul className="space-y-1.5">
                  {evalDetails.areas_for_review.map((a) => (
                    <li key={a} className="flex items-start gap-2 text-sm text-ink-secondary">
                      <AlertCircle size={13} className="mt-0.5 shrink-0 text-warning" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evalDetails.unverified_requirements && evalDetails.unverified_requirements.length > 0 && (
              <div className="mt-4 border-t border-border-light pt-4">
                <p className="mb-2 text-xs font-semibold text-ink-secondary">Unverified requirements</p>
                <ul className="space-y-1 text-sm text-ink-muted">
                  {evalDetails.unverified_requirements.map((r) => (
                    <li key={r} className="capitalize">{r}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-muted italic">
                  These could not be verified from the resume text alone and may require confirmation.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Experience */}
      {resume.experiences && resume.experiences.length > 0 && (
        <div className="card p-5">
          <h2 className="section-heading mb-4 flex items-center gap-2">
            <User size={16} className="text-brand-600" />
            Work experience
          </h2>
          <div className="space-y-4">
            {resume.experiences.map((exp, i) => (
              <div key={i} className="flex gap-4">
                <div className="mt-1 flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-brand-500" />
                  {i < resume.experiences!.length - 1 && <div className="mt-1 w-px flex-1 bg-border-light" />}
                </div>
                <div className="min-w-0 pb-4">
                  <p className="font-semibold text-ink-primary">{exp.title || 'Role'}</p>
                  <p className="text-sm text-ink-secondary">{exp.company}{exp.duration ? ` · ${exp.duration}` : ''}</p>
                  {exp.description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{exp.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {resume.education && resume.education.length > 0 && (
        <div className="card p-5">
          <h2 className="section-heading mb-4 flex items-center gap-2">
            <GraduationCap size={16} className="text-brand-600" />
            Education
          </h2>
          <div className="space-y-3">
            {resume.education.map((edu, i) => (
              <div key={i}>
                <p className="font-medium text-ink-primary">{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p>
                <p className="text-sm text-ink-secondary">{edu.institution}{edu.year ? ` · ${edu.year}` : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {resume.certifications && resume.certifications.length > 0 && (
        <div className="card p-5">
          <h2 className="section-heading mb-3">Certifications</h2>
          <div className="flex flex-wrap gap-2">
            {resume.certifications.map((cert) => (
              <span key={cert} className="status-chip bg-ivory-200 text-ink-secondary">{cert}</span>
            ))}
          </div>
        </div>
      )}

      {/* Experience evidence */}
      {evalDetails.relevant_experience_evidence && evalDetails.relevant_experience_evidence.length > 0 && (
        <div className="card p-5">
          <h2 className="section-heading mb-4">Supporting evidence</h2>
          <ul className="space-y-2">
            {evalDetails.relevant_experience_evidence.map((evidence, i) => (
              <li key={i} className="rounded bg-ivory-100 px-3 py-2 text-sm leading-relaxed text-ink-secondary">
                "{evidence}"
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted italic">
            Evidence is extracted directly from the resume text. AI evaluation should be verified by a recruiter.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-ink-muted text-center pb-4">
        AI-generated evaluation scores and skill assessments should be treated as a screening aid, not a definitive assessment. Always verify with a human reviewer.
      </p>
    </div>
  );
}

/* ── SKELETON ── */
function CandidateSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="card p-6 flex gap-4">
        <div className="skeleton h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="skeleton h-24 w-24 rounded-lg" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5"><div className="skeleton h-32 w-full" /></div>
        <div className="card p-5"><div className="skeleton h-32 w-full" /></div>
      </div>
    </div>
  );
}
