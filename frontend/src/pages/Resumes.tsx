import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Upload } from 'lucide-react';
import { api } from '../lib/api';
import { formatRelative } from '../lib/format';
import { pollWhileProcessing } from '../lib/polling';
import { ResumeUploadDialog } from '../components/ResumeUploadDialog';
import { Button } from '../components/ui/Button';
import { ProcessingBadge, ScorePill } from '../components/ui/Badge';
import { Select } from '../components/ui/Field';
import { PageHeader, Pagination, SearchInput, useDebounced } from '../components/ui/Layout';
import { EmptyState, ErrorState, LoadingRows } from '../components/ui/States';

const LIMIT = 20;

export default function Resumes() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated');
  const [offset, setOffset] = useState(0);
  const q = useDebounced(search.trim());
  const query = useQuery({
    queryKey: ['resumes', { q, sort, offset }],
    queryFn: () => api.resumes({ q, sort, limit: LIMIT, offset }),
    placeholderData: (previous) => previous,
    refetchInterval: (current) => (current.state.data?.items.some((r) => r.current_version?.status === 'processing') ? pollWhileProcessing('processing') : false),
  });

  return (
    <>
      <PageHeader
        title="My resumes"
        description="Each resume keeps every version you upload or correct, so earlier analyses always show what they were based on."
        actions={
          <Button icon={<Upload size={16} />} onClick={() => setUploadOpen(true)}>
            Upload resume
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput label="Search resumes" placeholder="Search by name" value={search} onChange={(value) => { setSearch(value); setOffset(0); }} />
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          Sort by
          <Select value={sort} onChange={(event) => setSort(event.target.value)} className="w-auto py-1.5">
            <option value="updated">Recently updated</option>
            <option value="created">Recently added</option>
            <option value="title">Name</option>
          </Select>
        </label>
      </div>

      {query.isPending ? (
        <LoadingRows rows={4} label="Loading resumes" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.total === 0 ? (
        q ? (
          <EmptyState title={`No resumes match “${q}”`} action={<Button variant="secondary" size="sm" onClick={() => setSearch('')}>Clear search</Button>} />
        ) : (
          <EmptyState
            icon={<FileText size={26} />}
            title="Upload your first resume"
            description="Use a text-based PDF or DOCX. You’ll be able to review and correct everything HireMatch reads from it."
            action={<Button onClick={() => setUploadOpen(true)} icon={<Upload size={16} />}>Upload resume</Button>}
          />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-line bg-paper">
            <table className="w-full text-left">
              <caption className="sr-only">Your resumes</caption>
              <thead className="hidden border-b border-line bg-sunk/40 text-sm text-ink-soft md:table-header-group">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Resume</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Current version</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Analyses</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Best match</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {query.data.items.map((resume) => (
                  <tr key={resume.id} className="relative block hover:bg-sunk/40 md:table-row">
                    <td className="block px-4 pt-3 md:table-cell md:px-5 md:py-3">
                      <Link to={`/resumes/${resume.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                        {resume.title}
                      </Link>
                      <p className="truncate text-sm text-ink-faint">{resume.current_version?.file_name}</p>
                    </td>
                    <td className="inline-block px-4 py-1 text-sm md:table-cell md:px-3 md:py-3">
                      <span className="inline-flex items-center gap-2">
                        v{resume.current_version?.version_number ?? '—'}
                        {resume.current_version && resume.current_version.status !== 'ready' && <ProcessingBadge status={resume.current_version.status} />}
                        <span className="text-ink-faint">of {resume.version_count}</span>
                      </span>
                    </td>
                    <td className="tabular inline-block px-2 py-1 text-sm text-ink-soft md:table-cell md:px-3 md:py-3">
                      <span className="md:hidden">· </span>
                      {resume.analysis_count}
                      <span className="md:hidden"> analyses</span>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      <ScorePill score={resume.best_score} />
                    </td>
                    <td className="block px-4 pb-3 text-sm text-ink-faint md:table-cell md:px-5 md:py-3 md:text-right">{formatRelative(resume.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={query.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
      <ResumeUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}
