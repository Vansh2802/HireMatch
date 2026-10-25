import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Columns2, History } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { Button, LinkButton } from '../components/ui/Button';
import { Badge, ScorePill } from '../components/ui/Badge';
import { Select } from '../components/ui/Field';
import { PageHeader, Pagination, SearchInput, useDebounced } from '../components/ui/Layout';
import { EmptyState, ErrorState, LoadingRows } from '../components/ui/States';

const LIMIT = 20;
const VERDICTS = ['Strong alignment', 'Partial alignment', 'Low alignment', 'Insufficient evidence', 'Insufficient information'];

export default function Analyses() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [verdict, setVerdict] = useState('');
  const [sort, setSort] = useState('created');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const q = useDebounced(search.trim());
  const query = useQuery({
    queryKey: ['analyses', { q, verdict, sort, offset }],
    queryFn: () => api.analyses({ q, verdict: verdict || undefined, sort, limit: LIMIT, offset }),
    placeholderData: (previous) => previous,
  });

  const toggle = (id: number) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length >= 4 ? current : [...current, id]));
  const filtered = Boolean(q || verdict);

  return (
    <>
      <PageHeader
        title="Analysis history"
        description="Every analysis is saved exactly as it was produced, including the job and resume version it used."
        actions={<LinkButton to="/analyze">New analysis</LinkButton>}
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput label="Search analyses" placeholder="Search job, company or resume" value={search} onChange={(value) => { setSearch(value); setOffset(0); }} />
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
          <label className="flex items-center gap-2">
            Result
            <Select value={verdict} onChange={(event) => { setVerdict(event.target.value); setOffset(0); }} className="w-auto py-1.5">
              <option value="">Any</option>
              {VERDICTS.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </label>
          <label className="flex items-center gap-2">
            Sort by
            <Select value={sort} onChange={(event) => setSort(event.target.value)} className="w-auto py-1.5">
              <option value="created">Newest</option>
              <option value="score">Highest score</option>
            </Select>
          </label>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink bg-obsidian px-4 py-2.5 text-ink-inverse lg:top-3">
          <p className="text-sm">{selected.length} selected{selected.length < 2 ? ' — select at least 2 to compare' : ''}{selected.length === 4 ? ' (maximum)' : ''}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-ink-inverse-soft hover:bg-obsidian-soft hover:text-ink-inverse" onClick={() => setSelected([])}>Clear</Button>
            <Button size="sm" icon={<Columns2 size={14} />} disabled={selected.length < 2} onClick={() => navigate(`/compare?ids=${selected.join(',')}`)}>Compare</Button>
          </div>
        </div>
      )}

      {query.isPending ? (
        <LoadingRows rows={5} label="Loading analyses" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.total === 0 ? (
        filtered ? (
          <EmptyState title="No analyses match these filters" action={<Button variant="secondary" size="sm" onClick={() => { setSearch(''); setVerdict(''); }}>Clear filters</Button>} />
        ) : (
          <EmptyState icon={<History size={26} />} title="No analyses yet" description="Run your first analysis to see how a resume matches a job." action={<LinkButton to="/analyze">Analyze a resume</LinkButton>} />
        )
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
            {query.data.items.map((analysis) => {
              const checked = selected.includes(analysis.id);
              return (
                <li key={analysis.id} className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${checked ? 'bg-accent-wash/30' : ''}`}>
                  <input
                    type="checkbox"
                    aria-label={`Select analysis of ${analysis.job_title} for comparison`}
                    checked={checked}
                    disabled={!checked && selected.length >= 4}
                    onChange={() => toggle(analysis.id)}
                    className="h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
                  />
                  <ScorePill score={analysis.score} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/analyses/${analysis.id}`} className="block truncate font-medium hover:underline">
                      {analysis.job_title}
                      {analysis.job_company && <span className="font-normal text-ink-soft"> at {analysis.job_company}</span>}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                      <span>{analysis.verdict}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{analysis.resume_title} v{analysis.resume_version_number}</span>
                      {!analysis.scoring_version.startsWith('2.') && <Badge tone="unknown">Earlier method</Badge>}
                      {analysis.job_id === null && <Badge>Job deleted</Badge>}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-sm text-ink-faint sm:block">{formatDate(analysis.created_at)}</span>
                </li>
              );
            })}
          </ul>
          <Pagination total={query.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </>
      )}
    </>
  );
}
