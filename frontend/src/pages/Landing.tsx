import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleDashed, CircleHelp, FileSearch, ListChecks, MinusCircle, PencilLine, Scale } from 'lucide-react';
import { useSession } from '../lib/auth';
import { PublicFooter, PublicHeader } from '../components/PublicLayout';
import { LinkButton } from '../components/ui/Button';

const SAMPLE_ROWS = [
  { requirement: 'Python', source: 'Strong Python and FastAPI or Django experience', status: 'met', evidence: 'Designed and built REST APIs in Python and FastAPI…' },
  { requirement: '5+ years of experience', source: '5+ years of professional software engineering experience', status: 'met', evidence: 'About 8 years, calculated from the dated roles' },
  { requirement: 'PostgreSQL', source: 'Experience with PostgreSQL and SQL', status: 'met', evidence: 'Migrated reporting workloads from MySQL to PostgreSQL…' },
  { requirement: 'Kubernetes', source: 'Hands-on experience with Docker and Kubernetes', status: 'not_found', evidence: 'Not found in the resume' },
  { requirement: 'Kafka', source: 'Experience with Kafka or other event streaming systems', status: 'not_found', evidence: 'Not found · preferred, lower weight' },
] as const;

const STATUS_STYLE = {
  met: { icon: CheckCircle2, darkColor: 'text-[#8BCFA5]', label: 'Evidenced' },
  not_found: { icon: MinusCircle, darkColor: 'text-[#F2A398]', label: 'Not found' },
} as const;

function SampleLedger() {
  return (
    <div className="overflow-hidden rounded-lg border border-obsidian-line bg-obsidian-soft text-ink-inverse shadow-pop">
      <div className="flex items-center justify-between border-b border-obsidian-line px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Senior Backend Engineer</p>
          <p className="text-xs text-ink-inverse-soft">Example analysis with sample data</p>
        </div>
        <div className="text-right">
          <p className="type-condensed tabular text-4xl font-semibold leading-none">79</p>
          <p className="text-xs text-ink-inverse-soft">Strong alignment</p>
        </div>
      </div>
      <ul>
        {SAMPLE_ROWS.map((row) => {
          const style = STATUS_STYLE[row.status];
          const Icon = style.icon;
          return (
            <li key={row.requirement} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-obsidian-line/70 px-4 py-2.5 last:border-0 sm:grid-cols-[11rem_6.5rem_1fr]">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.requirement}</p>
                <p className="hidden truncate text-xs text-ink-inverse-soft sm:block">“{row.source}”</p>
              </div>
              <p className={`flex items-center gap-1 text-xs font-medium ${style.darkColor}`}>
                <Icon size={13} aria-hidden="true" /> {style.label}
              </p>
              <p className="col-span-2 truncate text-xs text-ink-inverse-soft sm:col-span-1 sm:text-sm">{row.evidence}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const STEPS = [
  { title: 'Upload your resume', body: 'PDF or DOCX. HireMatch extracts your skills, roles, dates and education, and shows you what it read so you can correct it.' },
  { title: 'Add the job description', body: 'Paste the posting. Each requirement is pulled out with the exact line it came from, split into required and preferred where the posting says so.' },
  { title: 'Review the evidence', body: 'Every requirement is checked against your resume: evidenced, partly evidenced, not found, or not checkable — with the resume line that supports it.' },
  { title: 'Improve and re-run', body: 'Work through a prioritised gap list, upload the revised resume as a new version, and compare the two analyses side by side.' },
];

export default function Landing() {
  const { data: user } = useSession();
  useEffect(() => {
    document.title = 'HireMatch — See how your resume matches a job';
  }, []);
  const primary = user ? '/analyze' : '/register';

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader dark />
      <main id="main">
        <section className="bg-obsidian text-ink-inverse">
          <div className="mx-auto grid max-w-page gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-center lg:gap-14 lg:pb-24 lg:pt-16">
            <div>
              <h1 className="type-condensed text-4xl font-semibold leading-[1.02] text-ink-inverse sm:text-5xl lg:text-6xl">
                Read your resume the way a job description does.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-inverse-soft">
                HireMatch checks each requirement in a specific job posting against what your resume actually says. You see the line that proves each match, the
                requirements it can’t find, and what to improve before you apply.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton to={primary} variant="primary">
                  {user ? 'Analyze a resume' : 'Analyze my resume'}
                </LinkButton>
                <LinkButton to="/how-it-works" variant="secondary" className="border-obsidian-line bg-transparent text-ink-inverse hover:bg-obsidian-soft">
                  How scoring works
                </LinkButton>
              </div>
              <p className="mt-6 text-sm text-ink-inverse-soft">Free to use. Your original file isn’t stored, and you can delete everything at any time.</p>
            </div>
            <SampleLedger />
          </div>
        </section>

        <section aria-labelledby="workflow-title" className="mx-auto max-w-page px-4 py-16 sm:px-6">
          <h2 id="workflow-title" className="type-condensed text-3xl font-semibold">From posting to a better resume in four steps</h2>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bg-paper p-5">
                <span className="type-condensed tabular text-3xl font-semibold text-accent">{index + 1}</span>
                <h3 className="mt-2 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features-title" className="border-y border-line bg-paper">
          <div className="mx-auto max-w-page px-4 py-16 sm:px-6">
            <h2 id="features-title" className="type-condensed text-3xl font-semibold">Built around evidence, not guesswork</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              <Feature icon={<FileSearch size={20} />} title="Requirements with their source">
                Skills, years of experience, degrees, certifications and key responsibilities are extracted from the posting, each tied to the sentence it came from. Ambiguous
                items are marked uncertain and count for less.
              </Feature>
              <Feature icon={<ListChecks size={20} />} title="A gap list you can act on">
                Missing and weakly evidenced requirements become a prioritised action plan: why it matters for this role, where in your resume to look, and what to change —
                without inventing experience you don’t have.
              </Feature>
              <Feature icon={<PencilLine size={20} />} title="Versions you control">
                Correct what was extracted, upload revised resumes as new versions, and compare analyses over time. Earlier results never change behind your back.
              </Feature>
            </div>
          </div>
        </section>

        <section aria-labelledby="honest-title" className="mx-auto grid max-w-page gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Scale size={22} className="text-accent" aria-hidden="true" />
            <h2 id="honest-title" className="type-condensed mt-3 text-3xl font-semibold">What the score means — and what it doesn’t</h2>
            <p className="mt-3 max-w-prose text-ink-soft">
              The match score is calculated in code from fixed, published weights. It measures how clearly your resume evidences a posting’s stated requirements. It is not a
              prediction of whether you will be interviewed or hired.
            </p>
            <Link to="/how-it-works" className="link mt-4 inline-block">
              Read the full scoring method
            </Link>
          </div>
          <ul className="space-y-4">
            <Limit icon={<MinusCircle size={18} className="text-missing" />} title="“Not found” isn’t “missing”">
              If a skill doesn’t appear in your resume, HireMatch says so. It never assumes you lack it — only that a reader of your resume can’t see it.
            </Limit>
            <Limit icon={<CircleHelp size={18} className="text-unknown" />} title="Unknowns are excluded, not guessed">
              When your resume lacks the information to check something (such as dated roles), that requirement is left out of the score rather than scored 0 or 100.
            </Limit>
            <Limit icon={<CircleDashed size={18} className="text-partial" />} title="Too little evidence means no score">
              If most requirements can’t be checked, you get “Insufficient evidence” instead of a falsely precise number.
            </Limit>
          </ul>
        </section>

        <section className="bg-obsidian">
          <div className="mx-auto flex max-w-page flex-col items-start gap-5 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="type-condensed text-3xl font-semibold text-ink-inverse">Check your resume against the next job you want.</h2>
              <p className="mt-2 text-ink-inverse-soft">It takes a resume file and a job description. Nothing else.</p>
            </div>
            <LinkButton to={primary} variant="primary">
              {user ? 'Analyze a resume' : 'Create a free account'}
            </LinkButton>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="flex h-9 w-9 items-center justify-center rounded bg-accent-wash text-accent-text">{icon}</div>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 text-ink-soft">{children}</p>
    </div>
  );
}

function Limit({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-lg border border-line bg-paper p-4">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-ink-soft">{children}</p>
      </div>
    </li>
  );
}
