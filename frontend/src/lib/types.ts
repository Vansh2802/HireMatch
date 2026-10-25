export type ProcessingStatus = 'processing' | 'ready' | 'failed';

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };

export type AuthUser = { id: number; email: string; created_at?: string | null };

export type ExperienceEntry = {
  title: string | null;
  company: string | null;
  location: string | null;
  start: string | null;
  end: string | null;
  description: string | null;
};
export type EducationEntry = { degree: string | null; field: string | null; institution: string | null; start: string | null; end: string | null };
export type ProjectEntry = { name: string | null; description: string | null; technologies: string[] };

export type ResumeProfile = {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  skills: string[];
  experiences: ExperienceEntry[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  certifications: string[];
  total_experience_years: number | null;
  experience_years_source: 'date_ranges' | 'stated' | 'user' | null;
};

export type ResumeVersion = {
  id: number;
  version_number: number;
  source: 'upload' | 'edit' | 'legacy';
  status: ProcessingStatus;
  error_message: string | null;
  file_name: string | null;
  file_size: number | null;
  page_count: number | null;
  extraction_method: string | null;
  warnings: string[];
  profile: ResumeProfile | null;
  text_length: number;
  created_at: string;
  raw_text?: string;
};

export type ResumeSummary = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  current_version: ResumeVersion | null;
  version_count: number;
  analysis_count: number;
  best_score: number | null;
};

export type ResumeDetail = ResumeSummary & { current_version: (ResumeVersion & { raw_text: string }) | null; versions: ResumeVersion[] };

export type RequirementCategory = 'skill' | 'experience' | 'education' | 'certification' | 'responsibility' | 'qualification';
export type Importance = 'required' | 'preferred';

export type Requirement = {
  id: string;
  category: RequirementCategory;
  importance: Importance;
  text: string;
  skill: string | null;
  years: number | null;
  degree_level: number | null;
  source_excerpt: string | null;
  uncertain: boolean;
};

export type JobProfile = { seniority: string | null; requirements: Requirement[]; method: 'heuristic' | 'llm' | 'legacy'; warnings: string[] };

export type ApplicationStage = 'interested' | 'preparing' | 'applied' | 'interviewing' | 'completed' | 'archived';

export type Job = {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  url: string | null;
  description: string;
  status: ProcessingStatus;
  error_message: string | null;
  revision: number;
  profile: JobProfile | null;
  stage: ApplicationStage;
  notes: string | null;
  applied_on: string | null;
  follow_up_on: string | null;
  created_at: string;
  updated_at: string;
  analysis_count: number;
  best_score: number | null;
  latest_analysis_id: number | null;
};

export type JobListItem = Omit<Job, 'description' | 'profile' | 'error_message' | 'revision' | 'notes' | 'url'> & { requirement_count: number };

export type RequirementStatus = 'met' | 'partial' | 'not_found' | 'unverifiable';

export type Evidence = { excerpt: string; source: 'resume_text' | 'profile' | 'related_skill' | 'computed'; line: number | null };

export type RequirementResult = {
  id: string;
  category: RequirementCategory;
  importance: Importance;
  text: string;
  source_excerpt: string | null;
  uncertain: boolean;
  status: RequirementStatus;
  credit: number | null;
  evidence: Evidence[];
  note: string;
};

export type ComponentResult = {
  key: string;
  label: string;
  base_weight: number;
  effective_weight: number;
  score: number | null;
  status: 'scored' | 'not_applicable' | 'unverifiable';
  requirement_count: number;
  detail: string;
};

export type ActionItem = {
  requirement_id: string;
  requirement: string;
  importance: Importance;
  status: RequirementStatus;
  priority: 'high' | 'medium' | 'low';
  why: string;
  suggestion: string;
  section: string | null;
};

export type AnalysisResult = {
  scoring_version: string;
  score: number | null;
  verdict: string;
  confidence: 'high' | 'medium' | 'low';
  evidence_coverage: number;
  summary: string;
  components: ComponentResult[];
  requirements: RequirementResult[];
  strengths: string[];
  action_plan: ActionItem[];
  next_steps: string[];
  counts: Record<'total' | 'met' | 'partial' | 'not_found' | 'unverifiable' | 'required_total' | 'required_met', number>;
};

export type LegacyResult = { legacy: true; summary?: string | null; details?: Record<string, unknown> };

export type AnalysisListItem = {
  id: number;
  resume_id: number | null;
  resume_version_id: number | null;
  resume_title: string;
  resume_version_number: number | null;
  job_id: number | null;
  job_title: string;
  job_company: string | null;
  score: number | null;
  verdict: string;
  confidence: string | null;
  scoring_version: string;
  created_at: string;
};

export type Analysis = AnalysisListItem & {
  job_revision: number | null;
  job_snapshot: { title: string; company: string | null; location: string | null; url: string | null; description: string; profile: JobProfile };
  result: AnalysisResult | LegacyResult;
  is_legacy: boolean;
  is_current_resume_version: boolean | null;
  is_current_job_revision: boolean | null;
};

export type Dashboard = {
  counts: { resumes: number; jobs: number; analyses: number };
  average_best_score: number | null;
  average_best_score_jobs: number;
  average_definition: string;
  stages: Record<ApplicationStage, number>;
  recent_analyses: {
    id: number;
    job_title: string | null;
    job_company: string | null;
    resume_title: string;
    resume_version_number: number | null;
    score: number | null;
    verdict: string;
    created_at: string;
  }[];
  follow_ups: { id: number; title: string; company: string | null; stage: ApplicationStage; follow_up_on: string; overdue: boolean }[];
  onboarding: { has_resume: boolean; has_job: boolean; has_analysis: boolean; dismissed: boolean };
};

export type Health = {
  status: string;
  scoring_version: string;
  dependencies: { database: string; llm: string; provider: string; model: string | null };
  limits: { max_upload_size_mb: number; max_job_description_chars: number };
};
