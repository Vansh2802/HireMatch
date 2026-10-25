import type { ApplicationStage, RequirementCategory, RequirementStatus } from './types';

export function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, options);
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const STAGES: { value: ApplicationStage; label: string; hint: string }[] = [
  { value: 'interested', label: 'Interested', hint: 'Saved to consider' },
  { value: 'preparing', label: 'Preparing', hint: 'Tailoring your resume' },
  { value: 'applied', label: 'Applied', hint: 'Application sent' },
  { value: 'interviewing', label: 'Interviewing', hint: 'In the interview process' },
  { value: 'completed', label: 'Completed', hint: 'Process finished' },
  { value: 'archived', label: 'Archived', hint: 'No longer pursuing' },
];
export const stageLabel = (stage: ApplicationStage) => STAGES.find((s) => s.value === stage)?.label ?? stage;

export const STATUS_META: Record<RequirementStatus, { label: string; short: string; tone: 'met' | 'partial' | 'missing' | 'unknown'; description: string }> = {
  met: { label: 'Evidenced', short: 'Evidenced', tone: 'met', description: 'The resume clearly shows this.' },
  partial: { label: 'Partly evidenced', short: 'Partial', tone: 'partial', description: 'Related or incomplete evidence was found.' },
  not_found: { label: 'Not found in resume', short: 'Not found', tone: 'missing', description: 'The resume does not show this. That is not proof you lack it.' },
  unverifiable: { label: 'Could not check', short: 'Unchecked', tone: 'unknown', description: 'The resume lacks the information needed to check this; it is excluded from the score.' },
};

export const CATEGORY_LABEL: Record<RequirementCategory, string> = {
  skill: 'Skill',
  experience: 'Experience',
  education: 'Education',
  certification: 'Certification',
  responsibility: 'Responsibility',
  qualification: 'Qualification',
};

export function scoreTone(score: number | null | undefined): 'met' | 'partial' | 'missing' | 'unknown' {
  if (score === null || score === undefined) return 'unknown';
  if (score >= 75) return 'met';
  if (score >= 50) return 'partial';
  return 'missing';
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
