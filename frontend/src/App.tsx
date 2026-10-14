import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { Activity, BriefcaseBusiness, FileText, LayoutDashboard, Settings as SettingsIcon } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import CreateEvaluation from './pages/CreateEvaluation';
import UploadResumes from './pages/UploadResumes';
import EvaluationResults from './pages/EvaluationResults';
import CandidateDetails from './pages/CandidateDetails';
import Settings from './pages/Settings';

const queryClient = new QueryClient();

function AppShell() {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/evaluations/new', label: 'Create Evaluation', icon: FileText },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <BriefcaseBusiness size={20} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">AI hiring</p>
              <h1 className="text-xl font-semibold">HireMatch</h1>
            </div>
          </div>
          <nav className="hidden items-center gap-3 md:flex">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-500 hover:text-brand-700">
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600">
            <Activity size={16} className="text-brand-600" />
            Live backend
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/evaluations/new" element={<CreateEvaluation />} />
          <Route path="/evaluations/:id" element={<EvaluationResults />} />
          <Route path="/evaluations/:id/upload" element={<UploadResumes />} />
          <Route path="/candidates/:id" element={<CandidateDetails />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
