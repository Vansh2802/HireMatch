import { PublicPage } from '../components/PublicLayout';
import { RequirementStatusBadge } from '../components/ui/Badge';
import { STATUS_META } from '../lib/format';
import type { RequirementStatus } from '../lib/types';

const WEIGHTS = [
  { label: 'Required skills', weight: 45, detail: 'Each skill the posting requires.' },
  { label: 'Experience', weight: 20, detail: 'Stated minimum years compared with your dated roles.' },
  { label: 'Responsibilities', weight: 15, detail: 'Key duties compared with the work you describe.' },
  { label: 'Education & certifications', weight: 10, detail: 'Degree level and named certifications.' },
  { label: 'Preferred skills', weight: 10, detail: '“Nice to have” skills.' },
];

const CREDIT: Record<RequirementStatus, string> = {
  met: 'Full credit. The resume contains the skill (or one that clearly implies it, e.g. PostgreSQL for SQL), or the stated years/degree are met.',
  partial: 'Half credit, or a proportion for experience (3 of 5 years = 60%). Used for closely related skills, skills only in your edited profile, and partial overlap.',
  not_found: 'No credit. A reader of your resume would not see this. It is not proof that you lack it.',
  unverifiable: 'Excluded from the score. Your resume does not contain what is needed to check it (for example, roles without dates).',
};

export default function Methodology() {
  return (
    <PublicPage title="How scoring works">
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="type-condensed text-4xl font-semibold">How HireMatch scores a resume</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Scoring method version 2.0. The score is calculated in application code from the rules below. The AI model, when used, only helps read documents; it never sets
          or adjusts the score.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">1. Requirements are read from the posting</h2>
          <p className="mt-2 text-ink-soft">
            Each requirement keeps the sentence it came from. Items under headings such as “Nice to have” are preferred. When a posting has no clear requirements section, or
            says “or equivalent”, the item is marked <em>uncertain</em> and counts half as much. You can remove misread requirements or change required/preferred yourself.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">2. Each requirement gets a status</h2>
          <dl className="mt-4 space-y-3">
            {(Object.keys(STATUS_META) as RequirementStatus[]).map((status) => (
              <div key={status} className="grid gap-1 rounded-lg border border-line bg-paper p-4 sm:grid-cols-[11rem_1fr] sm:gap-4">
                <dt>
                  <RequirementStatusBadge status={status} />
                </dt>
                <dd className="text-sm text-ink-soft">{CREDIT[status]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">3. Requirements are grouped and weighted</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-paper">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Base weights of scoring components</caption>
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Component</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Base weight</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">What it covers</th>
                </tr>
              </thead>
              <tbody>
                {WEIGHTS.map((row) => (
                  <tr key={row.label} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-2.5 font-medium">{row.label}</th>
                    <td className="tabular px-4 py-2.5">{row.weight}%</td>
                    <td className="px-4 py-2.5 text-ink-soft">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-ink-soft">
            If a posting has no requirements of a type (for example no degree requirement), that component is left out and the remaining weights are scaled up so they still add
            to 100%. Within a component, uncertain and preferred items count half.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">4. Coverage and confidence</h2>
          <p className="mt-2 text-ink-soft">
            <strong className="text-ink">Evidence coverage</strong> is the weighted share of requirements that could be checked at all. Below 40% no score is given (“Insufficient
            evidence”). Confidence is high only when coverage is at least 85% and the posting has enough clearly stated requirements.
          </p>
          <p className="mt-2 text-ink-soft">
            Verdicts: 75 and above is <strong className="text-ink">Strong alignment</strong>, 50–74 <strong className="text-ink">Partial alignment</strong>, below 50{' '}
            <strong className="text-ink">Low alignment</strong>.
          </p>
        </section>

        <section className="mt-8 rounded-lg border border-line bg-sunk/60 p-5">
          <h2 className="text-xl font-semibold">Limitations</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-soft">
            <li>The score measures how clearly your resume evidences stated requirements. It does not predict interviews, offers or any employer’s decision.</li>
            <li>Skill matching uses a curated list of skills and their common aliases. Unusual or very new tools may be missed.</li>
            <li>Responsibility matching compares wording, so the same work described in very different words may be counted as not found.</li>
            <li>Experience totals count all dated roles, not only directly relevant ones.</li>
            <li>Scores from different method versions are not directly comparable; HireMatch labels the version on every result.</li>
          </ul>
        </section>
      </article>
    </PublicPage>
  );
}
