export type EvaluationItem = {
  id: number;
  job_title: string;
  status: string;
  created_at: string;
  updated_at: string;
  candidate_count: number;
  average_score?: number;
};

export type CandidateSummary = {
  id: number;
  candidate_name: string;
  match_score?: number | null;
  verdict?: string | null;
  processing_status: string;
  email?: string | null;
  error_message?: string | null;
};

export type EvaluationDetail = {
  id: number;
  job_title: string;
  job_description: string;
  structured_job?: Record<string, unknown> | null;
  status: string;
  candidates: CandidateSummary[];
};
