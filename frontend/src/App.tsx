import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import CreateEvaluation from './pages/CreateEvaluation';
import UploadResumes from './pages/UploadResumes';
import EvaluationResults from './pages/EvaluationResults';
import CandidateDetails from './pages/CandidateDetails';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Landing from './pages/Landing';
import { currentUser, logout } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
});

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/evaluations/new', label: 'New Evaluation', icon: FileText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

/* ── SIDEBAR ── */
function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleLogout = async () => {
    await logout();
    await qc.invalidateQueries({ queryKey: ['me'] });
    navigate('/login');
  };

  return (
    <div className="flex h-full flex-col border-r border-border-light bg-ivory-50">
      {/* Brand */}
      <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-brand-600 text-white">
            <BriefcaseBusiness size={15} />
          </div>
          <div className="leading-none">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-secondary">AI Hiring</p>
            <p className="text-sm font-bold text-ink-primary">HireMatch</p>
          </div>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} className="btn-ghost p-1.5 text-ink-secondary">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Navigation</p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const isActive =
              to === '/dashboard'
                ? location.pathname === '/dashboard' || location.pathname === '/'
                : location.pathname.startsWith(to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  onClick={onClose}
                  className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={16} className="shrink-0" />
                  {label}
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-600 nav-link-dot" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border-light p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="nav-link w-full text-ink-secondary hover:text-error"
        >
          <LogOut size={16} className="shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}

/* ── MOBILE DRAWER ── */
function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-dark-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-72 animate-slide-up shadow-2xl">
        <Sidebar onClose={onClose} />
      </div>
    </>
  );
}

/* ── AUTH SHELL ── */
function AuthenticatedShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const authQuery = useQuery({
    queryKey: ['me'],
    queryFn: currentUser,
    retry: false,
    enabled: location.pathname !== '/login' && location.pathname !== '/',
  });

  useEffect(() => {
    if (
      location.pathname !== '/login' &&
      location.pathname !== '/' &&
      authQuery.error
    ) {
      navigate('/login', { replace: true });
    }
  }, [authQuery.error, location.pathname, navigate]);

  // Public routes — no auth required
  if (location.pathname === '/login') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  if (location.pathname === '/') {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
      </Routes>
    );
  }

  // Protected routes
  if (authQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory-100">
        <div className="flex flex-col items-center gap-3 text-ink-secondary">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-light border-t-brand-600" />
          <p className="text-sm">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (authQuery.error) {
    return null; // redirect effect fires
  }

  return (
    <div className="flex min-h-screen bg-ivory-100">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile nav */}
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile only */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border-light bg-ivory-50/90 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            className="btn-ghost p-1.5"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-600 text-white">
              <BriefcaseBusiness size={12} />
            </div>
            <span className="text-sm font-bold text-ink-primary">HireMatch</span>
          </div>
          <div className="w-8" aria-hidden="true" />
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/evaluations/new" element={<CreateEvaluation />} />
            <Route path="/evaluations/:id" element={<EvaluationResults />} />
            <Route path="/evaluations/:id/upload" element={<UploadResumes />} />
            <Route path="/candidates/:id" element={<CandidateDetails />} />
            <Route path="/settings" element={<Settings />} />
            {/* Legacy route redirect */}
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthenticatedShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
