import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  LayoutDashboard,
  Layers,
  Percent,
  Zap,
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen font-sans">
      {/* ── NAVBAR ── */}
      <header className="absolute inset-x-0 top-0 z-30 border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-white">
              <BriefcaseBusiness size={16} />
            </div>
            <span className="text-lg font-bold tracking-tight text-ivory-50">HireMatch</span>
          </div>

          {/* Nav links */}
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm font-medium text-ivory-100/70 transition hover:text-ivory-50">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-ivory-100/70 transition hover:text-ivory-50">How it works</a>
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-ivory-100/80 transition hover:text-ivory-50">
              Sign in
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-1.5 rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Get started
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="landing-hero relative overflow-hidden pb-20 pt-32">
        {/* Background texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.3) 39px, rgba(255,255,255,0.3) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.3) 39px, rgba(255,255,255,0.3) 40px)',
          }}
        />
        {/* Orange glow accent */}
        <div className="pointer-events-none absolute -left-32 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-brand-600 opacity-[0.08] blur-[80px]" />

        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Left — text */}
            <div className="animate-fade-in">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-600/30 bg-brand-600/10 px-3 py-1.5">
                <Zap size={12} className="text-brand-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-brand-400">AI-powered recruitment</span>
              </div>
              <h1 className="mb-6 font-display text-5xl font-bold leading-[1.1] tracking-tight text-ivory-50 lg:text-6xl">
                Match the right&nbsp;
                <span className="text-brand-500">talent</span>
                &nbsp;to every role
              </h1>
              <p className="mb-8 max-w-md text-lg leading-relaxed text-ivory-100/60">
                HireMatch analyses resumes against your job requirements, scores candidate fit, and surfaces the evidence — so your team makes faster, more informed hiring decisions.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to="/login"
                  className="flex items-center gap-2 rounded bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-700"
                >
                  Start evaluating candidates
                  <ArrowRight size={15} />
                </Link>
                <a
                  href="#how-it-works"
                  className="flex items-center gap-2 text-sm font-medium text-ivory-100/70 transition hover:text-ivory-50"
                >
                  See how it works
                  <ChevronRight size={14} />
                </a>
              </div>

              {/* Proof points */}
              <div className="mt-10 flex flex-wrap gap-6">
                {[
                  'PDF & DOCX support',
                  'Structured skill matching',
                  'Per-candidate evidence',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-ivory-100/60">
                    <CheckCircle2 size={14} className="shrink-0 text-brand-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — visual composition */}
            <div className="animate-slide-up hidden lg:block">
              <HeroDashboardPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="landing-section-ivory py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-xl">
            <p className="eyebrow mb-3">Platform features</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-primary lg:text-4xl">
              Everything your hiring team needs
            </h2>
            <p className="mt-4 text-base text-ink-secondary">
              From resume ingestion to ranked candidate lists — HireMatch handles the evaluation pipeline so recruiters focus on conversations, not spreadsheets.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="border-t border-border-light bg-ivory-200 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-xl">
            <p className="eyebrow mb-3">Workflow</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-primary">
              From job description to ranked shortlist
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <StepCard key={step.title} step={index + 1} {...step} />
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Create your first evaluation
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="landing-hero border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-brand-600 text-white">
              <BriefcaseBusiness size={14} />
            </div>
            <span className="text-sm font-semibold text-ivory-100">HireMatch</span>
          </div>
          <p className="text-xs text-ivory-100/40">AI-powered resume evaluation platform. Candidate data is private to your account.</p>
          <Link to="/login" className="text-xs font-medium text-ivory-100/60 transition hover:text-ivory-100">
            Sign in →
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ── HERO DASHBOARD PREVIEW ── */
function HeroDashboardPreview() {
  return (
    <div className="relative rounded-xl border border-white/10 bg-dark-800 p-5 shadow-2xl">
      {/* Header strip */}
      <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-4">
        <div className="h-2.5 w-2.5 rounded-full bg-error" />
        <div className="h-2.5 w-2.5 rounded-full bg-warning" />
        <div className="h-2.5 w-2.5 rounded-full bg-success" />
        <span className="ml-2 text-xs text-ivory-100/30">Senior Python Engineer — 4 candidates</span>
      </div>

      {/* Candidate rows */}
      <div className="space-y-2.5">
        {previewCandidates.map((c, i) => (
          <div key={i} className="flex items-center justify-between rounded bg-dark-700 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-dark-600 text-xs font-bold text-ivory-100/50">
                {c.initials}
              </div>
              <div>
                <p className="text-xs font-medium text-ivory-100">{c.name}</p>
                <p className="text-2xs text-ivory-100/40">{c.skills}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-16 overflow-hidden rounded-full bg-dark-600`}>
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${c.score}%`, opacity: 0.85 }}
                />
              </div>
              <span className="w-9 text-right text-xs font-semibold tabular-nums text-ivory-100">{c.score}%</span>
              <span
                className={`rounded px-1.5 py-0.5 text-2xs font-medium ${
                  c.verdict === 'Strong match' ? 'bg-success/20 text-green-400' :
                  c.verdict === 'Good match' ? 'bg-brand-500/20 text-brand-400' :
                  'bg-white/5 text-ivory-100/40'
                }`}
              >
                {c.verdict}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer metric */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        {[
          { label: 'Avg. score', value: '72%' },
          { label: 'Processed', value: '4' },
          { label: 'Top match', value: '91%' },
        ].map((m) => (
          <div key={m.label} className="text-center">
            <p className="text-sm font-bold tabular-nums text-ivory-50">{m.value}</p>
            <p className="text-2xs text-ivory-100/30">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const previewCandidates = [
  { name: 'A. Chen', initials: 'AC', skills: 'Python · FastAPI · PostgreSQL', score: 91, verdict: 'Strong match' },
  { name: 'B. Patel', initials: 'BP', skills: 'Python · Django · Redis', score: 78, verdict: 'Good match' },
  { name: 'C. Moreau', initials: 'CM', skills: 'Node.js · TypeScript · AWS', score: 52, verdict: 'Partial' },
  { name: 'D. Silva', initials: 'DS', skills: 'Go · Kubernetes · gRPC', score: 39, verdict: 'Partial' },
];

/* ── FEATURE CARD ── */
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="card p-6 transition-shadow duration-200 hover:shadow-card-hover">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded bg-brand-50 text-brand-600">
        {icon}
      </div>
      <h3 className="mb-2 text-base font-semibold text-ink-primary">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-secondary">{description}</p>
    </div>
  );
}

/* ── STEP CARD ── */
interface StepCardProps {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

function StepCard({ step, title, description, icon }: StepCardProps) {
  return (
    <div className="relative flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
          {step}
        </div>
        <div className="h-px flex-1 bg-border-light" />
      </div>
      <div className="mt-1">
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded bg-ivory-50 text-ink-secondary shadow-sm">
          {icon}
        </div>
        <h3 className="mb-2 text-base font-semibold text-ink-primary">{title}</h3>
        <p className="text-sm leading-relaxed text-ink-secondary">{description}</p>
      </div>
    </div>
  );
}

const features = [
  {
    icon: <FileSearch size={20} />,
    title: 'Automated resume parsing',
    description: 'Upload PDF or DOCX resumes. HireMatch extracts skills, experience, education, and contact details from each document.',
  },
  {
    icon: <Percent size={20} />,
    title: 'Structured match scoring',
    description: 'Each candidate receives a scored evaluation across required skills, experience level, education, and role responsibilities.',
  },
  {
    icon: <Layers size={20} />,
    title: 'Evidence-backed results',
    description: 'Every score references actual resume evidence — not just keyword hits. See which requirements are met, missing, or unverifiable.',
  },
  {
    icon: <BriefcaseBusiness size={20} />,
    title: 'Job requirement extraction',
    description: 'Paste a job description and HireMatch extracts structured requirements: required skills, experience, education, and responsibilities.',
  },
  {
    icon: <LayoutDashboard size={20} />,
    title: 'Hiring dashboard',
    description: 'Track all active evaluations, total candidates analysed, and average match scores across your hiring pipeline in one place.',
  },
  {
    icon: <Zap size={20} />,
    title: 'Fast batch processing',
    description: 'Upload up to 10 resumes at once. Failed files are reported individually — the rest complete successfully regardless.',
  },
];

const steps = [
  {
    icon: <BriefcaseBusiness size={20} />,
    title: 'Define the role',
    description: 'Provide a job title and description. HireMatch extracts required skills, experience, and responsibilities into a structured profile.',
  },
  {
    icon: <FileSearch size={20} />,
    title: 'Upload resumes',
    description: 'Drag and drop PDF or DOCX files. The platform parses each document and extracts a structured candidate profile.',
  },
  {
    icon: <Percent size={20} />,
    title: 'Review ranked results',
    description: 'Candidates are scored and ranked by fit. Open any profile to see matched skills, gaps, and the supporting evidence.',
  },
];
