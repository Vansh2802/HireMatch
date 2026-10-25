import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ApiError, SESSION_EXPIRED_EVENT } from './lib/api';
import { useSession } from './lib/auth';
import { AppShell } from './components/AppShell';
import { ToastProvider, useToast } from './components/ui/Toast';
import { ErrorState, Spinner } from './components/ui/States';

const Landing = lazy(() => import('./pages/Landing'));
const Methodology = lazy(() => import('./pages/Methodology'));
const Legal = lazy(() => import('./pages/Legal'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analyze = lazy(() => import('./pages/Analyze'));
const Resumes = lazy(() => import('./pages/Resumes'));
const ResumeDetail = lazy(() => import('./pages/ResumeDetail'));
const Jobs = lazy(() => import('./pages/Jobs'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const Analyses = lazy(() => import('./pages/Analyses'));
const AnalysisDetail = lazy(() => import('./pages/AnalysisDetail'));
const AnalysisReport = lazy(() => import('./pages/AnalysisReport'));
const Compare = lazy(() => import('./pages/Compare'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

const queryClient = createQueryClient();

function FullPageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner label="Loading…" />
    </div>
  );
}

/** Redirects to sign-in when the session is missing or expires mid-session. */
function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.isPending) return <FullPageSpinner />;
  if (session.isError)
    return (
      <div className="mx-auto mt-24 max-w-md px-4">
        <ErrorState error={session.error} onRetry={() => session.refetch()} title="Cannot reach HireMatch" />
      </div>
    );
  if (!session.data) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

function SessionExpiryListener() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useToast();
  useEffect(() => {
    const onExpired = () => {
      if (!client.getQueryData(['me'])) return;
      client.clear();
      client.setQueryData(['me'], null);
      notify('Your session expired. Sign in again to continue.', 'info');
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [client, navigate, location.pathname, notify]);
  return null;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <SessionExpiryListener />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/how-it-works" element={<Methodology />} />
        <Route path="/privacy" element={<Legal kind="privacy" />} />
        <Route path="/terms" element={<Legal kind="terms" />} />
        <Route path="/login" element={<Login mode="login" />} />
        <Route path="/register" element={<Login mode="register" />} />
        <Route path="/analyses/:id/report" element={<RequireAuth><AnalysisReport /></RequireAuth>} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/resumes" element={<Resumes />} />
          <Route path="/resumes/:id" element={<ResumeDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/analyses" element={<Analyses />} />
          <Route path="/analyses/:id" element={<AnalysisDetail />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
