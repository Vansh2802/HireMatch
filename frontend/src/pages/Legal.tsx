import { Link } from 'react-router-dom';
import { PublicPage } from '../components/PublicLayout';

export default function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  return kind === 'privacy' ? <Privacy /> : <Terms />;
}

function Privacy() {
  return (
    <PublicPage title="Privacy">
      <article className="mx-auto max-w-prose px-4 py-12 sm:px-6">
        <h1 className="type-condensed text-4xl font-semibold">Privacy and your data</h1>
        <p className="mt-3 text-ink-soft">This page describes what this HireMatch installation actually does with your information.</p>
        <h2 className="mt-8 text-xl font-semibold">What is stored</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-soft">
          <li>Your email address and a one-way hash of your password.</li>
          <li>The text extracted from resumes you upload, the structured details read from it, and any corrections you make.</li>
          <li>Job descriptions you save, their extracted requirements, and your application notes and dates.</li>
          <li>Analyses, including a copy of the job and resume details they were based on.</li>
        </ul>
        <h2 className="mt-8 text-xl font-semibold">What is not stored</h2>
        <p className="mt-2 text-ink-soft">The original uploaded file is read in memory and discarded after its text is extracted.</p>
        <h2 className="mt-8 text-xl font-semibold">AI processing</h2>
        <p className="mt-2 text-ink-soft">
          If the server is configured to use an AI model, resume and job text is sent to that provider to read the documents. Email addresses, phone numbers and links are
          removed from resume text before it is sent. The model never sets your score.
        </p>
        <h2 className="mt-8 text-xl font-semibold">Deleting your data</h2>
        <p className="mt-2 text-ink-soft">
          You can delete any resume, job or analysis from its page. Deleting a resume also deletes the analyses made from it. Deleting your account in{' '}
          <Link to="/settings" className="link">Settings</Link> permanently removes everything listed above.
        </p>
      </article>
    </PublicPage>
  );
}

function Terms() {
  return (
    <PublicPage title="Terms of use">
      <article className="mx-auto max-w-prose px-4 py-12 sm:px-6">
        <h1 className="type-condensed text-4xl font-semibold">Terms of use</h1>
        <ul className="mt-6 list-disc space-y-3 pl-5 text-ink-soft">
          <li>HireMatch provides decision support for job seekers. Match scores describe how a resume evidences a job description’s stated requirements; they are not a guarantee or prediction of interviews, offers or employment.</li>
          <li>Only upload documents you are entitled to use. Do not upload other people’s resumes without their permission.</li>
          <li>Suggestions are general guidance. Never add skills, credentials or experience to your resume that you do not have.</li>
          <li>HireMatch does not submit applications or contact employers on your behalf.</li>
          <li>
            See <Link to="/privacy" className="link">Privacy</Link> for how your data is handled and deleted.
          </li>
        </ul>
      </article>
    </PublicPage>
  );
}
